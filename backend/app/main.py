"""
苏格拉底之窗 (Socrates' Window) - Main Application
RAG-powered intelligent learning system.
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.services.exceptions import ExternalServiceError
from app.api.collections import router as collection_router
from app.api.documents import router as document_router
from app.api.chat import chat_router, search_router, conv_router
from app.api.trash import router as trash_router
from app.api.system import router as system_router
from app.api.model_configs import router as model_configs_router
from app.api.schedule import schedule_router

logger = logging.getLogger("Socratess_window")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    # Startup
    await init_db()
    logger.info("苏格拉底之窗 已启动")
    logger.info("LLM: %s", settings.llm_model)
    logger.info("Embed: %s (%dd)", settings.embed_model, settings.embed_dimensions)
    logger.info("文档: http://%s:%d/docs", settings.host, settings.port)

    # Preload reranker model in background (avoids ~2s delay on first query)
    if settings.reranker_enabled:
        import asyncio as _asyncio
        _asyncio.create_task(_warmup_reranker())
    yield
    # Shutdown
    logger.info("苏格拉底之窗 已停止")


async def _warmup_reranker():
    """Preload the cross-encoder model so first retrieval is fast."""
    try:
        from app.services.reranker_service import RerankerService
        dummy = RerankerService(model_name=settings.reranker_model)
        dummy.rerank("warmup", ["This is a warmup query."], top_n=1)
        logger.info("Reranker model warmed up: %s", settings.reranker_model)
    except Exception as exc:
        logger.warning("Reranker warmup skipped: %s", exc)


app = FastAPI(
    title="苏格拉底之窗",
    description="RAG 驱动的智能学习系统 —— 让知识经由理性之光折射为真知",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.exception_handler(ExternalServiceError)
async def external_service_error_handler(request: Request, exc: ExternalServiceError):
    """Translate upstream LLM/embedding failures into a clean 502 response."""
    return JSONResponse(status_code=502, content={"detail": exc.message})


# ── Token 认证中间件 ─────────────────────────────────
class TokenAuthMiddleware(BaseHTTPMiddleware):
    """如果配置了 api_token，则校验请求头 Authorization: Bearer <token>。"""

    async def dispatch(self, request: Request, call_next):
        if not settings.api_token:
            return await call_next(request)
        # 放行健康检查和文档
        if request.url.path in ("/", "/api/system/health", "/docs", "/openapi.json", "/redoc"):
            return await call_next(request)
        auth = request.headers.get("Authorization", "")
        if auth == f"Bearer {settings.api_token}":
            return await call_next(request)
        return JSONResponse(status_code=401, content={"detail": "未授权：请提供有效的 API Token"})


if settings.api_token:
    app.add_middleware(TokenAuthMiddleware)
    logger.info("API Token 认证已启用")

# Register routers
app.include_router(collection_router)
app.include_router(document_router)
app.include_router(chat_router)
app.include_router(search_router)
app.include_router(conv_router)
app.include_router(trash_router)
app.include_router(system_router)
app.include_router(model_configs_router)
app.include_router(schedule_router)


@app.get("/")
async def root():
    return {
        "name": "苏格拉底之窗",
        "version": "0.1.0",
        "description": "RAG-powered intelligent learning system",
        "docs": "/docs",
    }
