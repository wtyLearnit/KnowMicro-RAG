"""
苏格拉底之窗 - Web Search Service
Pluggable web search backends: DuckDuckGo (default), Tavily, Brave, Serper.
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import List, Optional

from app.config import settings

logger = logging.getLogger("Socratess_window")


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

    def __init__(self):
        self._backend = settings.web_search_backend
        self._max_results = settings.web_search_max_results
        self._timeout = settings.web_search_timeout

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
                for r in ddgs.text(query, max_results=num):
                    results.append(WebSearchResult(
                        title=r.get("title", ""),
                        url=r.get("href", ""),
                        snippet=r.get("body", ""),
                    ))
            return results

        return await loop.run_in_executor(None, _sync)

    # ── Tavily (AI-optimised) ────────────────────────
    async def _search_tavily(self, query: str, num: int) -> List[WebSearchResult]:
        api_key = settings.tavily_api_key
        if not api_key:
            logger.warning("Tavily API key not configured, falling back to DuckDuckGo")
            return await self._search_duckduckgo(query, num)

        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.tavily.com/search",
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
    async def _search_brave(self, query: str, num: int) -> List[WebSearchResult]:
        api_key = settings.brave_api_key
        if not api_key:
            logger.warning("Brave API key not configured, falling back to DuckDuckGo")
            return await self._search_duckduckgo(query, num)

        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://api.search.brave.com/res/v1/web/search",
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
    async def _search_serper(self, query: str, num: int) -> List[WebSearchResult]:
        api_key = settings.serper_api_key
        if not api_key:
            logger.warning("Serper API key not configured, falling back to DuckDuckGo")
            return await self._search_duckduckgo(query, num)

        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://google.serper.dev/search",
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
