"""
柏拉图之窗 - Application Configuration
"""
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── LLM ──────────────────────────────────────────
    llm_api_base: str = "https://api.openai.com/v1"
    llm_api_key: str = "sk-your-key-here"
    llm_model: str = "gpt-4o-mini"
    llm_max_tokens: int = 4096
    llm_temperature: float = 0.7

    # ── Embedding ────────────────────────────────────
    embed_api_base: str = "https://api.openai.com/v1"
    embed_api_key: str = "sk-your-key-here"
    embed_model: str = "text-embedding-3-small"
    embed_dimensions: int = 1536
    embed_batch_size: int = 10
    embed_max_retries: int = 3

    # ── Database ─────────────────────────────────────
    database_url: str = "sqlite+aiosqlite:///./data/platos_window.db"
    chroma_persist_dir: str = "./data/chroma"

    # ── Server ───────────────────────────────────────
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # ── Document Processing ──────────────────────────
    chunk_size: int = 800
    chunk_overlap: int = 150
    max_document_size_mb: int = 50

    # ── System Prompt ────────────────────────────────
    system_prompt: str = (
        "你是「柏拉图」，一位生活在数字时代的古希腊哲人导师。"
        "你的使命不是灌输答案，而是引导学习者走向「理型」的真知。\n\n"
        "## 教学之道\n"
        "1. **苏格拉底式追问**：当学习者提问，你先不给出完整答案。"
        "用层层递进的问题引导对方自己发现答案。每一轮给出少量信息，然后抛回一个更深入的问题。\n"
        "2. **从具体升到抽象**：将具体问题与底层原理联系起来，帮助学习者看清知识的「理型」。\n"
        "3. **跨域联结**：主动指出当前知识与其它领域的同构关系。数学和音乐、物理和哲学之间的隐喻是你最爱的教学工具。\n"
        "4. **知晓无知**：遇到你也不确定的内容时，坦然承认，并邀请学习者一起探索。\n"
        "5. **对话式节奏**：你不是一个回答机器。你的每一段回复都应该像对话中的一个回合，"
        "有温度、有停顿、有留白。\n\n"
        "## 回复格式\n"
        "当引用知识库中的内容时，在末尾用 [来源: 文档名] 标注。\n"
        "当你的回答依赖于检索到的上下文时，请在回答中自然地融入检索到的知识点，"
        "而不是生硬地标注「根据检索结果」。\n\n"
        "## 语言\n"
        "默认使用与提问者相同的语言回复。"
    )

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


settings = Settings()

# Ensure data directory exists
Path(settings.chroma_persist_dir).parent.mkdir(parents=True, exist_ok=True)
Path(settings.chroma_persist_dir).mkdir(parents=True, exist_ok=True)
