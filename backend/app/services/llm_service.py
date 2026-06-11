"""
KnowMicro - LLM Service
Supports any OpenAI-compatible chat completion API with streaming.
"""
from typing import AsyncIterator, List, Dict, Any
import json
import httpx
from app.config import settings
from app.services.exceptions import (
    ExternalServiceError, extract_api_error, describe_exception as _describe,
)


# Appended to system prompt when web search results are present
_WEB_SEARCH_RULES = """
## 🌐 网络搜索结果使用规则（非常重要）

你的上下文中包含「网络搜索结果」——这是系统刚刚从互联网实时检索到的信息，**时效性远优于你的训练数据**。

### 你必须遵守的规则：
1. **优先使用网络搜索结果**：当用户的问题涉及最新动态、新闻、产品发布、实时数据等时效性内容时，必须以网络搜索结果为主要依据来回答。你的训练数据可能已过时。
2. **明确告知来源**：使用网络信息时，在回答中自然地提及信息来源，并在末尾列出参考链接。
3. **如果没有相关知识库**：当上下文只有网络搜索结果（没有"📚 知识库"），请完全基于网络搜索结果作答。
4. **知识库与网络的优先级**：
   - "📚 知识库"（如有）是用户提供的权威资料，涉及专业/内部知识时优先采信
   - "🌐 网络搜索"用于补充最新信息或知识库未覆盖的内容
   - 当两者存在矛盾且网络信息明显更新，以网络信息为准并说明时效差异
5. **不要忽略网络结果**：即使用户没有明确说"搜索"，只要上下文中有网络搜索结果，就应该充分利用它们。
"""


class LLMService:
    """Chat completion via OpenAI-compatible API."""

    def __init__(
        self,
        base_url: str = None,
        api_key: str = None,
        model: str = None,
        max_tokens: int = None,
        temperature: float = None,
    ):
        self.base_url = (base_url or settings.llm_api_base).rstrip("/")
        self.api_key = api_key if api_key is not None else settings.llm_api_key
        self.model = model or settings.llm_model
        self.max_tokens = max_tokens if max_tokens is not None else settings.llm_max_tokens
        self.temperature = temperature if temperature is not None else settings.llm_temperature
        self.system_prompt = settings.system_prompt
        self.direct_prompt = settings.direct_prompt

    def _build_messages(
        self,
        user_message: str,
        history: List[Dict[str, str]],
        context: str = "",
        mode: str = "socratic",
        has_web_results: bool = False,
    ) -> List[Dict[str, str]]:
        """Build the message list with system prompt, context, and history."""
        prompt = self.system_prompt if mode == "socratic" else self.direct_prompt

        # Append web search handling rules when web results are present
        if has_web_results:
            prompt += _WEB_SEARCH_RULES

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
        has_web_results: bool = False,
    ) -> Dict[str, Any]:
        """Non-streaming chat completion."""
        messages = self._build_messages(user_message, history, context, mode, has_web_results)

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
        has_web_results: bool = False,
    ) -> AsyncIterator[str]:
        """Streaming chat completion. Yields content chunks."""
        messages = self._build_messages(user_message, history, context, mode, has_web_results)

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


def create_llm_service_from_config(config: dict) -> LLMService:
    """从用户模型配置字典创建 LLMService 实例。"""
    extra = config.get("extra_params", {}) or {}
    return LLMService(
        base_url=config.get("base_url"),
        api_key=config.get("api_key", ""),
        model=config.get("model_name"),
        max_tokens=extra.get("max_tokens"),
        temperature=extra.get("temperature"),
    )
