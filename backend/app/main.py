"""
柏拉图之窗 (Plato's Window) - Main Application
RAG-powered intelligent learning system.
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.services.exceptions import ExternalServiceError
from app.api.collections import router as collection_router
from app.api.documents import router as document_router
from app.api.chat import chat_router, search_router, conv_router
from app.api.system import router as system_router

logger = logging.getLogger("platos_window")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    # Startup
    await init_db()
    logger.info("柏拉图之窗 已启动")
    logger.info("LLM: %s", settings.llm_model)
    logger.info("Embed: %s (%dd)", settings.embed_model, settings.embed_dimensions)
    logger.info("文档: http://%s:%d/docs", settings.host, settings.port)
    yield
    # Shutdown
    logger.info("柏拉图之窗 已停止")


app = FastAPI(
    title="柏拉图之窗",
    description="RAG 驱动的智能学习系统 —— 让知识经由理性之光折射为真知",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ExternalServiceError)
async def external_service_error_handler(request: Request, exc: ExternalServiceError):
    """Translate upstream LLM/embedding failures into a clean 502 response."""
    return JSONResponse(status_code=502, content={"detail": exc.message})

# Register routers
app.include_router(collection_router)
app.include_router(document_router)
app.include_router(chat_router)
app.include_router(search_router)
app.include_router(conv_router)
app.include_router(system_router)


@app.get("/")
async def root():
    return {
        "name": "柏拉图之窗",
        "version": "0.1.0",
        "description": "RAG-powered intelligent learning system",
        "docs": "/docs",
    }
