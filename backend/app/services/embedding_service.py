"""
苏格拉底之窗 - Embedding Service
Supports any OpenAI-compatible embedding API.
"""
import asyncio
import logging
from typing import List
import httpx
from app.config import settings
from app.services.exceptions import (
    ExternalServiceError, extract_api_error, describe_exception as _describe,
)

logger = logging.getLogger("Socratess_window")


class EmbeddingService:
    """Generate embeddings via OpenAI-compatible API."""

    def __init__(
        self,
        base_url: str = None,
        api_key: str = None,
        model: str = None,
        dimensions: int = None,
        batch_size: int = None,
        max_retries: int = None,
    ):
        self.base_url = (base_url or settings.embed_api_base).rstrip("/")
        self.api_key = api_key if api_key is not None else settings.embed_api_key
        self.model = model or settings.embed_model
        self.dimensions = dimensions if dimensions is not None else settings.embed_dimensions
        # Many providers cap how many texts one /embeddings call accepts
        # (e.g. DashScope's OpenAI-compatible mode allows at most 10).
        self.batch_size = max(1, batch_size if batch_size is not None else settings.embed_batch_size)
        self.max_retries = max(0, max_retries if max_retries is not None else settings.embed_max_retries)

    async def embed(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for a list of texts, batching to respect provider limits."""
        if not texts:
            return []

        # Filter out empty texts that would cause API errors
        valid_texts = [t for t in texts if t and t.strip()]
        if not valid_texts:
            logger.warning("All texts were empty, skipping embedding")
            return []

        results: List[List[float]] = []
        for start in range(0, len(valid_texts), self.batch_size):
            batch = valid_texts[start:start + self.batch_size]
            results.extend(await self._embed_batch(batch))
        return results

    async def _embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Embed a single batch, retrying on transient network errors."""
        payload = {"model": self.model, "input": texts}
        if self.dimensions:
            payload["dimensions"] = self.dimensions
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        last_exc: Exception | None = None
        for attempt in range(self.max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=60.0, trust_env=False) as client:
                    resp = await client.post(
                        f"{self.base_url}/embeddings",
                        json=payload,
                        headers=headers,
                    )
                if resp.status_code == 429 or resp.status_code >= 500:
                    if attempt < self.max_retries:
                        wait = 0.5 * (2 ** attempt)
                        logger.warning(
                            "Embedding HTTP %d, retry %d/%d in %.1fs",
                            resp.status_code, attempt + 1, self.max_retries, wait,
                        )
                        await asyncio.sleep(wait)
                        continue
                    raise ExternalServiceError(
                        f"Embedding error (HTTP {resp.status_code}): {extract_api_error(resp)}",
                        service="embedding",
                        status_code=resp.status_code,
                    )
                elif resp.status_code >= 400:
                    raise ExternalServiceError(
                        f"Embedding error: {extract_api_error(resp)}",
                        service="embedding",
                        status_code=resp.status_code,
                    )
                data = resp.json()
                break
            except (httpx.TimeoutException, httpx.TransportError) as e:
                # Transient: timeout, connection reset, TLS handshake hiccup, etc.
                last_exc = e
                if attempt < self.max_retries:
                    wait = 0.5 * (2 ** attempt)
                    logger.warning(
                        "Embedding 请求失败(%s)，第 %d/%d 次重试，%.1fs 后重试",
                        _describe(e), attempt + 1, self.max_retries, wait,
                    )
                    await asyncio.sleep(wait)
                    continue
                raise ExternalServiceError(
                    f"无法连接 Embedding 服务（已重试 {self.max_retries} 次）：{_describe(e)}",
                    service="embedding",
                ) from e

        try:
            # Sort by index to preserve order within this batch
            embeddings = sorted(data["data"], key=lambda x: x["index"])
            return [e["embedding"] for e in embeddings]
        except (KeyError, TypeError) as e:
            raise ExternalServiceError(
                "Embedding 服务返回了无法解析的响应", service="embedding"
            ) from e

    async def embed_single(self, text: str) -> List[float]:
        """Generate embedding for a single text."""
        results = await self.embed([text])
        return results[0]


embedding_service = EmbeddingService()


def create_embedding_service_from_config(config: dict) -> EmbeddingService:
    """从用户模型配置字典创建 EmbeddingService 实例。"""
    extra = config.get("extra_params", {}) or {}
    return EmbeddingService(
        base_url=config.get("base_url"),
        api_key=config.get("api_key", ""),
        model=config.get("model_name"),
        dimensions=extra.get("dimensions"),
        batch_size=extra.get("batch_size"),
    )
