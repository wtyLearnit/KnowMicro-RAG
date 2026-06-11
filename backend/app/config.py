"""
KnowMicro - Application Configuration
"""
from pathlib import Path
from pydantic_settings import BaseSettings

# Project root (backend/ directory) — deterministic regardless of CWD
_PROJECT_ROOT = Path(__file__).resolve().parent.parent


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
    database_url: str = ""  # 在 model_post_init 中动态设置
    chroma_persist_dir: str = str(_PROJECT_ROOT / "data" / "chroma")

    # ── Server ───────────────────────────────────────
    host: str = "127.0.0.1"
    port: int = 8000
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # ── Security ─────────────────────────────────────
    secret_key: str = ""  # 必须在 .env 中设置，用于 API Key 加密
    api_token: str = ""   # API 访问令牌，为空则不校验（仅本地开发用）

    # ── Document Processing ──────────────────────────
    chunk_size: int = 800
    chunk_overlap: int = 150
    max_document_size_mb: int = 50

    # ── File Storage ───────────────────────────────────
    uploads_dir: str = ""
    # If empty, defaults to <backend>/data/uploads (set in model_post_init below)

    # ── Retrieval ────────────────────────────────────
    hybrid_search_enabled: bool = True
    bm25_weight: float = 0.3
    semantic_weight: float = 0.7
    reranker_enabled: bool = True
    reranker_model: str = "BAAI/bge-reranker-v2-m3"
    reranker_top_n: int = 20
    query_rewrite_enabled: bool = True
    retrieval_top_k: int = 20

    # ── Web Search ────────────────────────────────────
    web_search_backend: str = "duckduckgo"  # duckduckgo | tavily | brave | serper
    web_search_max_results: int = 5
    web_search_timeout: int = 20  # seconds (ddgs may need >10s on first call)
    # ddgs 是元搜索聚合器，默认会同时查 Google/Brave/DuckDuckGo/Wikipedia 等引擎，
    # 这些在国内基本被墙或限流导致整体超时；实测仅 yandex 稳定可用（约 4s）。
    web_search_ddgs_backend: str = "yandex"
    tavily_api_key: str = ""
    brave_api_key: str = ""
    serper_api_key: str = ""

    # ── System Prompt ────────────────────────────────
    system_prompt: str = (
        "你是「苏格拉底」，一位生活在数字时代的古希腊哲人导师。"
        "你的使命不是灌输答案，而是引导学习者走向「理型」的真知。\n\n"
        "## 核心规则（必须严格遵守）\n"
        "1. **一次只问一个问题**：每次回复只抛出一个思考问题，等用户回答后再继续。绝对不要在一次回复中列出多个问题或多轮对话。\n"
        "2. **保持简短**：每次回复控制在 3-5 句话 + 1 个问题，不要长篇大论。\n"
        "3. **不要内联引用**：不要在回复文本中写 [来源: xxx]，来源会由系统自动显示在侧面板。\n"
        "4. **渐进引导**：根据用户的回答决定下一步，而不是预设好所有步骤一次性输出。\n\n"
        "## 教学之道\n"
        "- **苏格拉底式追问**：用一个问题引导对方思考，根据回答再追问。\n"
        "- **从具体升到抽象**：从具体例子出发，逐步引向底层原理。\n"
        "- **跨域联结**：适时指出知识与其它领域的关联。\n"
        "- **知晓无知**：不确定时坦然承认。\n\n"
        "## 知识融合\n"
        "你有两类知识来源：知识库检索内容 + 自身训练知识。优先参考知识库。"
        "如果知识库内容明显过时，用自身知识修正，并标注 ⚠️ [知识库内容可能已过时，已根据最新知识修正]。\n\n"
        "## 语言\n"
        "默认使用与提问者相同的语言回复。"
    )

    direct_prompt: str = (
        "你是一位专业的知识问答助手。你的任务是根据知识库内容和你自身的知识，准确、清晰地回答用户的问题。\n\n"
        "## 回答原则\n"
        "1. **知识库优先**：优先使用知识库中的内容来回答问题。如果知识库中有相关信息，直接给出准确答案。\n"
        "2. **结合自身知识**：将知识库内容与你自身的训练知识结合，给出更全面、更深入的回答。\n"
        "3. **过时检测**：如果你发现知识库中的信息明显过时、有误或不完整，请用你自身的知识进行修正或补充，"
        "并在回答中标注 ⚠️ [知识库内容可能已过时，已根据最新知识修正]。\n"
        "4. **简洁明了**：回答要结构清晰、重点突出，避免冗余和无关信息。\n"
        "5. **不要内联引用**：不要在回复文本中写 [来源: xxx]，来源会由系统自动显示在侧面板。\n"
        "6. **格式友好**：善用 Markdown 格式（标题、列表、代码块、引用等）让回答更易读。\n\n"
        "## 语言\n"
        "默认使用与提问者相同的语言回复。"
    )

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    def model_post_init(self, __context):
        """Set defaults that depend on other fields."""
        if not self.uploads_dir:
            self.uploads_dir = str(_PROJECT_ROOT / "data" / "uploads")
        if not self.secret_key:
            # 自动生成并持久化到文件，确保重启后密钥不变
            self.secret_key = self._load_or_generate_secret_key()
        if not self.database_url:
            # 向后兼容：优先使用旧文件名（保留用户数据），回退到新文件名
            old_db = _PROJECT_ROOT / "data" / "platos_window.db"
            new_db = _PROJECT_ROOT / "data" / "knowmicro.db"
            if old_db.exists():
                self.database_url = f"sqlite+aiosqlite:///{old_db}"
            elif new_db.exists():
                self.database_url = f"sqlite+aiosqlite:///{new_db}"
            else:
                self.database_url = f"sqlite+aiosqlite:///{new_db}"

    @staticmethod
    def _load_or_generate_secret_key() -> str:
        import secrets
        key_file = _PROJECT_ROOT / "data" / ".secret_key"
        if key_file.exists():
            return key_file.read_text(encoding="utf-8").strip()
        key = secrets.token_urlsafe(32)
        key_file.parent.mkdir(parents=True, exist_ok=True)
        key_file.write_text(key, encoding="utf-8")
        return key

    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


settings = Settings()

# Ensure data directories exist
Path(settings.chroma_persist_dir).parent.mkdir(parents=True, exist_ok=True)
Path(settings.chroma_persist_dir).mkdir(parents=True, exist_ok=True)
Path(settings.uploads_dir).mkdir(parents=True, exist_ok=True)
