"""
柏拉图之窗 - Embedding Service
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

logger = logging.getLogger("platos_window")


class EmbeddingService:
    """Generate embeddings via OpenAI-compatible API."""

    def __init__(self):
        self.base_url = settings.embed_api_base.rstrip("/")
        self.api_key = settings.embed_api_key
        self.model = settings.embed_model
        self.dimensions = settings.embed_dimensions
        # Many providers cap how many texts one /embeddings call accepts
        # (e.g. DashScope's OpenAI-compatible mode allows at most 10).
        self.batch_size = max(1, settings.embed_batch_size)
        self.max_retries = max(0, settings.embed_max_retries)

    async def embed(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for a list of texts, batching to respect provider limits."""
        if not texts:
            return []

        results: List[List[float]] = []
        for start in range(0, len(texts), self.batch_size):
            batch = texts[start:start + self.batch_size]
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
                if resp.status_code >= 400:
                    # 4xx are client errors (bad model/key/params) — don't retry.
                    raise ExternalServiceError(
                        f"Embedding 服务返回错误：{extract_api_error(resp)}",
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
