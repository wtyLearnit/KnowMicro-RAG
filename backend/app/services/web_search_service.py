"""
KnowMicro - Web Search Service
Pluggable web search backends: DuckDuckGo (default), Tavily, Brave, Serper.
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import List, Optional

from app.config import settings

logger = logging.getLogger("knowmicro")


@dataclass
class WebSearchResult:
    title: str
    url: str
    snippet: str


@dataclass
class WebSearchResponse:
    results: List[WebSearchResult] = field(default_factory=list)
    backend: str = ""
    error: Optional[str] = None


class WebSearchService:
    """Thin wrapper over pluggable web search backends."""

    def __init__(
        self,
        backend: str | None = None,
        api_key: str | None = None,
        max_results: int | None = None,
        timeout: int | None = None,
        ddgs_backend: str | None = None,
        custom_protocol: str | None = None,   # 自定义供应商的 API 协议 (tavily/serper/brave)
        base_url_override: str | None = None,  # 自定义供应商的搜索端点 URL
    ):
        self._backend = backend or settings.web_search_backend
        self._api_key = api_key or ""
        self._max_results = max_results or settings.web_search_max_results
        self._timeout = timeout or settings.web_search_timeout
        # 免费 ddgs 路径使用的元搜索引擎（默认 yandex，国内唯一稳定可用）
        self._ddgs_backend = ddgs_backend or settings.web_search_ddgs_backend
        # 自定义供应商：协议类型 + 端点 URL
        self._custom_protocol = custom_protocol or "tavily"
        self._base_url_override = base_url_override or ""

    async def search(self, query: str, num_results: int | None = None) -> WebSearchResponse:
        """
        Perform a web search. Returns structured results.
        Degrades gracefully: errors become WebSearchResponse.error.
        """
        num = num_results or self._max_results

        try:
            results = await asyncio.wait_for(
                self._do_search(query, num),
                timeout=self._timeout,
            )
            return WebSearchResponse(results=results, backend=self._backend)
        except asyncio.TimeoutError:
            logger.warning("Web search timed out for query: %s", query[:80])
            return WebSearchResponse(backend=self._backend, error="搜索超时")
        except Exception:
            logger.exception("Web search failed for query: %s", query[:80])
            return WebSearchResponse(backend=self._backend, error="搜索服务暂时不可用")

    async def _do_search(self, query: str, num: int) -> List[WebSearchResult]:
        backend = self._backend
        # 自定义供应商按协议类型分派到对应的 API 方法
        if backend == "custom":
            protocol = self._custom_protocol
            ep = self._base_url_override
            if protocol == "serper":
                return await self._search_serper(query, num, endpoint=ep)
            elif protocol == "brave":
                return await self._search_brave(query, num, endpoint=ep)
            else:
                return await self._search_tavily(query, num, endpoint=ep)

        if self._backend == "tavily":
            return await self._search_tavily(query, num)
        elif self._backend == "brave":
            return await self._search_brave(query, num)
        elif self._backend == "serper":
            return await self._search_serper(query, num)
        else:
            return await self._search_duckduckgo(query, num)

    # ── DuckDuckGo (via ddgs) ────────────────────────
    async def _search_duckduckgo(self, query: str, num: int) -> List[WebSearchResult]:
        from ddgs import DDGS

        loop = asyncio.get_running_loop()

        def _sync():
            results: list[WebSearchResult] = []
            with DDGS() as ddgs:
                for r in ddgs.text(query, max_results=num, backend=self._ddgs_backend):
                    results.append(WebSearchResult(
                        title=r.get("title", ""),
                        url=r.get("href", ""),
                        snippet=r.get("body", ""),
                    ))
            return results

        return await loop.run_in_executor(None, _sync)

    # ── Tavily (AI-optimised) ────────────────────────
    async def _search_tavily(self, query: str, num: int, endpoint: str = "") -> List[WebSearchResult]:
        api_key = self._api_key or settings.tavily_api_key
        if not api_key:
            logger.warning("Tavily API key not configured, falling back to DuckDuckGo")
            return await self._search_duckduckgo(query, num)

        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                endpoint or "https://api.tavily.com/search",
                json={
                    "api_key": api_key,
                    "query": query,
                    "max_results": num,
                    "search_depth": "basic",
                },
                timeout=self._timeout,
            )
            resp.raise_for_status()
            data = resp.json()
            return [
                WebSearchResult(
                    title=r.get("title", ""),
                    url=r.get("url", ""),
                    snippet=r.get("content", ""),
                )
                for r in data.get("results", [])
            ]

    # ── Brave Search ─────────────────────────────────
    async def _search_brave(self, query: str, num: int, endpoint: str = "") -> List[WebSearchResult]:
        api_key = self._api_key or settings.brave_api_key
        if not api_key:
            logger.warning("Brave API key not configured, falling back to DuckDuckGo")
            return await self._search_duckduckgo(query, num)

        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                endpoint or "https://api.search.brave.com/res/v1/web/search",
                params={"q": query, "count": min(num, 20)},
                headers={
                    "Accept": "application/json",
                    "Accept-Encoding": "gzip",
                    "X-Subscription-Token": api_key,
                },
                timeout=self._timeout,
            )
            resp.raise_for_status()
            data = resp.json()
            results = []
            for r in (data.get("web", {}).get("results", []) or []):
                results.append(WebSearchResult(
                    title=r.get("title", ""),
                    url=r.get("url", ""),
                    snippet=r.get("description", ""),
                ))
            return results

    # ── Serper (Google results) ──────────────────────
    async def _search_serper(self, query: str, num: int, endpoint: str = "") -> List[WebSearchResult]:
        api_key = self._api_key or settings.serper_api_key
        if not api_key:
            logger.warning("Serper API key not configured, falling back to DuckDuckGo")
            return await self._search_duckduckgo(query, num)

        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                endpoint or "https://google.serper.dev/search",
                json={"q": query, "num": num},
                headers={"X-API-KEY": api_key},
                timeout=self._timeout,
            )
            resp.raise_for_status()
            data = resp.json()
            results = []
            for r in (data.get("organic", []) or []):
                results.append(WebSearchResult(
                    title=r.get("title", ""),
                    url=r.get("link", ""),
                    snippet=r.get("snippet", ""),
                ))
            return results


web_search_service = WebSearchService()


def create_web_search_service_from_config(config: dict) -> WebSearchService:
    """从用户配置字典创建 WebSearchService 实例。

    config 形如 UserModelConfig(config_type="web_search") 的解析结果：
    provider 决定后端，api_key 已解密，extra_params 含 max_results/timeout。
    """
    extra = config.get("extra_params", {}) or {}
    return WebSearchService(
        backend=config.get("provider"),
        api_key=config.get("api_key", ""),
        max_results=extra.get("max_results"),
        timeout=extra.get("timeout"),
        custom_protocol=extra.get("protocol"),
        base_url_override=config.get("base_url") if config.get("provider") == "custom" else None,
    )
