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


    async def rewrite_query(
        self,
        user_message: str,
        history: List[Dict[str, str]],
    ) -> str:
        """
        Generate a decontextualized, optimized search query from the user's
        message and conversation history. Handles multi-turn context.
        """
        rewrite_prompt = (
            "你的任务是将用户的多轮对话问题改写为一个独立的、优化过的检索查询。\n\n"
            "规则：\n"
            "1. 结合对话历史，将指代词（如「它」「那个」「这个方案」）替换为具体内容\n"
            "2. 补全省略的关键上下文\n"
            "3. 提取核心关键词，生成适合检索的简洁查询\n"
            "4. 只输出改写后的查询，不要加任何解释或前缀\n"
            "5. 如果原问题已经足够清晰完整，直接输出原问题\n"
        )

        messages: List[Dict[str, str]] = [
            {"role": "system", "content": rewrite_prompt},
        ]
        # Include last 6 messages of history for context
        if history:
            messages.extend(history[-6:])
        messages.append({"role": "user", "content": f"请改写以下问题用于检索：{user_message}"})

        try:
            async with httpx.AsyncClient(timeout=30.0, trust_env=False) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    json={
                        "model": self.model,
                        "messages": messages,
                        "max_tokens": 200,
                        "temperature": 0.1,
                    },
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                )
                if resp.status_code >= 400:
                    # Non-critical: fall back to original message
                    return user_message
                data = resp.json()
                rewritten = data["choices"][0]["message"]["content"].strip()
                return rewritten if rewritten else user_message
        except Exception:
            return user_message


llm_service = LLMService()
