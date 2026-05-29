"""
苏格拉底之窗 - LLM Service
Supports any OpenAI-compatible chat completion API with streaming.
"""
from typing import AsyncIterator, List, Dict, Any
import json
import httpx
from app.config import settings
from app.services.exceptions import (
    ExternalServiceError, extract_api_error, describe_exception as _describe,
)


class LLMService:
    """Chat completion via OpenAI-compatible API."""

    def __init__(self):
        self.base_url = settings.llm_api_base.rstrip("/")
        self.api_key = settings.llm_api_key
        self.model = settings.llm_model
        self.max_tokens = settings.llm_max_tokens
        self.temperature = settings.llm_temperature
        self.system_prompt = settings.system_prompt
        self.direct_prompt = settings.direct_prompt

    def _build_messages(
        self,
        user_message: str,
        history: List[Dict[str, str]],
        context: str = "",
        mode: str = "socratic",
    ) -> List[Dict[str, str]]:
        """Build the message list with system prompt, context, and history."""
        prompt = self.system_prompt if mode == "socratic" else self.direct_prompt
        messages = [{"role": "system", "content": prompt}]

        if context:
            context_prefix = "以下是知识库中与当前问题最相关的内容，请基于这些内容进行教学：\n\n" if mode == "socratic" else "以下是知识库中与当前问题最相关的内容，请基于这些内容回答：\n\n"
            messages.append({
                "role": "system",
                "content": f"{context_prefix}{context}"
            })

        # Add conversation history (last N turns)
        messages.extend(history[-20:])

        messages.append({"role": "user", "content": user_message})
        return messages

    async def chat(
        self,
        user_message: str,
        history: List[Dict[str, str]],
        context: str = "",
        mode: str = "socratic",
    ) -> Dict[str, Any]:
        """Non-streaming chat completion."""
        messages = self._build_messages(user_message, history, context, mode)

        try:
            async with httpx.AsyncClient(timeout=120.0, trust_env=False) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    json={
                        "model": self.model,
                        "messages": messages,
                        "max_tokens": self.max_tokens,
                        "temperature": self.temperature,
                    },
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                )
                if resp.status_code >= 400:
                    raise ExternalServiceError(
                        f"LLM 服务返回错误：{extract_api_error(resp)}",
                        service="llm",
                        status_code=resp.status_code,
                    )
                data = resp.json()
        except httpx.TimeoutException as e:
            raise ExternalServiceError(
                "LLM 服务请求超时，请稍后重试", service="llm"
            ) from e
        except httpx.RequestError as e:
            raise ExternalServiceError(
                f"无法连接 LLM 服务：{_describe(e)}", service="llm"
            ) from e

        try:
            choice = data["choices"][0]
            return {
                "content": choice["message"]["content"],
                "usage": data.get("usage", {}),
            }
        except (KeyError, IndexError, TypeError) as e:
            raise ExternalServiceError(
                "LLM 服务返回了无法解析的响应", service="llm"
            ) from e

    async def chat_stream(
        self,
        user_message: str,
        history: List[Dict[str, str]],
        context: str = "",
        mode: str = "socratic",
    ) -> AsyncIterator[str]:
        """Streaming chat completion. Yields content chunks."""
        messages = self._build_messages(user_message, history, context, mode)

        try:
            async with httpx.AsyncClient(timeout=120.0, trust_env=False) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/chat/completions",
                    json={
                        "model": self.model,
                        "messages": messages,
                        "max_tokens": self.max_tokens,
                        "temperature": self.temperature,
                        "stream": True,
                    },
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                ) as resp:
                    if resp.status_code >= 400:
                        # Body must be read before it can be parsed when streaming.
                        await resp.aread()
                        raise ExternalServiceError(
                            f"LLM 服务返回错误：{extract_api_error(resp)}",
                            service="llm",
                            status_code=resp.status_code,
                        )
                    async for line in resp.aiter_lines():
                        if line.startswith("data: "):
                            data_str = line[6:]
                            if data_str == "[DONE]":
                                break
                            try:
                                chunk = json.loads(data_str)
                                delta = chunk["choices"][0].get("delta", {})
                                if "content" in delta and delta["content"]:
                                    yield delta["content"]
                            except (json.JSONDecodeError, KeyError, IndexError):
                                continue
        except httpx.TimeoutException as e:
            raise ExternalServiceError(
                "LLM 服务请求超时，请稍后重试", service="llm"
            ) from e
        except httpx.RequestError as e:
            raise ExternalServiceError(
                f"无法连接 LLM 服务：{_describe(e)}", service="llm"
            ) from e


llm_service = LLMService()
