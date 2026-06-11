"""
KnowMicro - Document API Routes
"""
import os
import uuid
import shutil
from typing import List
from pathlib import Path
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update as sql_update
from app.config import settings
from app.database import get_db, Collection, Document, UserModelConfig
from app.schemas.schemas import DocumentOut, DocumentUploadResponse, DocumentPreview, DocumentChunk
from app.dependencies import get_document_service, get_rag_service
from app.services.document_service import DocumentService
from app.services.rag_service import RAGService
from app.utils.crypto import decrypt_api_key


async def _get_active_embedding_service(db: AsyncSession):
    """从数据库获取当前激活的 Embedding 配置，创建服务实例。"""
    from app.services.embedding_service import create_embedding_service_from_config
    result = await db.execute(
        select(UserModelConfig).where(
            UserModelConfig.config_type == "embedding",
            UserModelConfig.is_active == 1,
        )
    )
    config = result.scalar_one_or_none()
    if config:
        return create_embedding_service_from_config({
            "base_url": config.base_url,
            "api_key": decrypt_api_key(config.api_key) if config.api_key else "",
            "model_name": config.model_name,
            "extra_params": config.extra_params or {},
        })
    return None  # 回退到系统默认 singleton

router = APIRouter(prefix="/api/documents", tags=["documents"])

# MIME types for common document formats (used for Content-Type header)
_MIME_TYPES: dict[str, str] = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".ppt": "application/vnd.ms-powerpoint",
    ".txt": "text/plain; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".markdown": "text/markdown; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
}

# File extensions that browsers can preview inline
_INLINE_TYPES: set[str] = {".pdf", ".txt", ".md", ".markdown", ".png", ".jpg", ".jpeg", ".gif"}


def _save_original(content: bytes, doc_id: str, filename: str) -> str:
    """Save original file bytes to disk. Returns the absolute path."""
    upload_dir = Path(settings.uploads_dir) / doc_id[:2]  # shard by first 2 chars of id
    upload_dir.mkdir(parents=True, exist_ok=True)
    # Keep original extension, prefix with doc_id to avoid collisions
    ext = Path(filename).suffix or ".bin"
    safe_name = f"{doc_id}{ext}"
    file_path = upload_dir / safe_name
    file_path.write_bytes(content)
    return str(file_path.resolve())


def _get_mime_type(file_type: str) -> str:
    """Guess MIME type from file extension."""
    ext = f".{file_type.lower()}" if not file_type.startswith(".") else file_type.lower()
    return _MIME_TYPES.get(ext, "application/octet-stream")


@router.post("/upload/{collection_id}", response_model=DocumentUploadResponse, status_code=201)
async def upload_document(
    collection_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    doc_svc: DocumentService = Depends(get_document_service),
    rag: RAGService = Depends(get_rag_service),
):
    """Upload a document to a knowledge base collection."""
    # Verify collection exists
    collection = await db.get(Collection, collection_id)
    if not collection:
        raise HTTPException(404, "知识库不存在")

    if not file.filename:
        raise HTTPException(400, "文件名不能为空")

    # Read file content
    content = await file.read()
    doc_id = str(uuid.uuid4())

    # Parse document
    try:
        parsed = await doc_svc.parse(content, file.filename)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"文档解析失败: {str(e)}")

    # Save original file to disk
    original_path = ""
    try:
        original_path = _save_original(content, doc_id, file.filename)
    except Exception:
        pass  # Non-fatal: text extraction succeeded, file storage is best-effort

    # Create document record
    doc = Document(
        id=doc_id,
        collection_id=collection_id,
        filename=file.filename,
        file_type=parsed["file_type"],
        file_size=len(content),
        content=parsed["text"],
        file_path=original_path,
        status="processing",
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # Chunk and index
    try:
        chunks = doc_svc.chunk(parsed["text"], parsed["file_type"])
        doc.chunk_count = len(chunks)

        emb_svc = await _get_active_embedding_service(db)
        await rag.index_chunks(
            collection_id=collection_id,
            doc_id=doc.id,
            doc_name=file.filename,
            chunks=chunks,
            emb_svc=emb_svc,
        )

        doc.status = "ready"
    except Exception as e:
        doc.status = "error"
        doc.error_message = str(e)

    await db.commit()
    await db.refresh(doc)

    return DocumentUploadResponse(
        document_id=doc.id,
        filename=doc.filename,
        file_type=doc.file_type,
        file_size=doc.file_size,
        chunk_count=doc.chunk_count,
        status=doc.status,
    )


@router.post("/upload-batch/{collection_id}", response_model=List[DocumentUploadResponse], status_code=201)
async def upload_documents_batch(
    collection_id: str,
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    doc_svc: DocumentService = Depends(get_document_service),
    rag: RAGService = Depends(get_rag_service),
):
    """Upload multiple documents to a knowledge base collection."""
    # Verify collection exists
    collection = await db.get(Collection, collection_id)
    if not collection:
        raise HTTPException(404, "知识库不存在")

    results = []

    for file in files:
        if not file.filename:
            continue

        try:
            # Read file content
            content = await file.read()
            doc_id = str(uuid.uuid4())

            # Parse document
            parsed = await doc_svc.parse(content, file.filename)

            # Save original file to disk
            original_path = ""
            try:
                original_path = _save_original(content, doc_id, file.filename)
            except Exception:
                pass

            # Create document record
            doc = Document(
                id=doc_id,
                collection_id=collection_id,
                filename=file.filename,
                file_type=parsed["file_type"],
                file_size=len(content),
                content=parsed["text"],
                file_path=original_path,
                status="processing",
            )
            db.add(doc)
            await db.commit()
            await db.refresh(doc)

            # Chunk and index
            try:
                chunks = doc_svc.chunk(parsed["text"], parsed["file_type"])
                doc.chunk_count = len(chunks)

                emb_svc = await _get_active_embedding_service(db)
                await rag.index_chunks(
                    collection_id=collection_id,
                    doc_id=doc.id,
                    doc_name=file.filename,
                    chunks=chunks,
                    emb_svc=emb_svc,
                )

                doc.status = "ready"
            except Exception as e:
                doc.status = "error"
                doc.error_message = str(e)

            await db.commit()
            await db.refresh(doc)

            results.append(DocumentUploadResponse(
                document_id=doc.id,
                filename=doc.filename,
                file_type=doc.file_type,
                file_size=doc.file_size,
                chunk_count=doc.chunk_count,
                status=doc.status,
            ))

        except ValueError as e:
            # Skip invalid files
            continue
        except Exception as e:
            # Skip files that fail processing
            continue

    return results


@router.get("/{document_id}/file")
async def get_document_file(
    document_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Serve the original uploaded file (PDF/DOCX/etc.) for inline preview or download."""
    doc = await db.get(Document, document_id)
    if not doc or doc.is_archived:
        raise HTTPException(404, "文档不存在")
    if not doc.file_path:
        raise HTTPException(404, "该文档未保存原始文件（可能为旧版本上传）")

    file_path = Path(doc.file_path)
    if not file_path.is_file():
        raise HTTPException(404, "原始文件已被清理")

    ext = file_path.suffix.lower()
    media_type = _get_mime_type(ext)
    # Inline preview for browser-friendly types, otherwise download
    disposition = "inline" if ext in _INLINE_TYPES else "attachment"

    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=doc.filename,
        content_disposition_type=disposition,
    )


@router.get("/collection/{collection_id}", response_model=List[DocumentOut])
async def list_documents(
    collection_id: str,
    db: AsyncSession = Depends(get_db),
):
    """List all documents in a collection."""
    result = await db.execute(
        select(Document)
        .where(Document.collection_id == collection_id, Document.is_archived == 0)
        .order_by(Document.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{document_id}", response_model=DocumentPreview)
async def get_document_preview(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    doc_svc: DocumentService = Depends(get_document_service),
):
    """Get document content and chunks for preview."""
    doc = await db.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "文档不存在")

    # Re-chunk the content to show chunks
    chunks = []
    if doc.content:
        chunk_list = doc_svc.chunk(doc.content, doc.file_type)
        chunks = [
            DocumentChunk(
                index=c["index"],
                text=c["text"],
                char_count=c["char_count"],
            )
            for c in chunk_list
        ]

    # Include slide metadata for PPTX files
    slides = None
    if doc.metadata_ and isinstance(doc.metadata_, dict):
        slides = doc.metadata_.get("slides")

    return DocumentPreview(
        document_id=doc.id,
        filename=doc.filename,
        file_type=doc.file_type,
        file_size=doc.file_size,
        chunk_count=doc.chunk_count,
        content=doc.content or "",
        chunks=chunks,
        slides=slides,
    )


@router.post("/{document_id}/archive", status_code=204)
async def archive_document(
    document_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Archive a document (soft delete)."""
    doc = await db.get(Document, document_id)
    if not doc or doc.is_archived:
        raise HTTPException(404, "文档不存在")

    doc.is_archived = 1
    doc.archived_at = datetime.now(timezone.utc)
    await db.commit()


@router.post("/{document_id}/restore", status_code=204)
async def restore_document(
    document_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Restore a document from trash."""
    doc = await db.get(Document, document_id)
    if not doc or not doc.is_archived:
        raise HTTPException(404, "已归档文档不存在")

    doc.is_archived = 0
    doc.archived_at = None
    await db.commit()


@router.delete("/{document_id}/permanent", status_code=204)
async def permanent_delete_document(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    rag: RAGService = Depends(get_rag_service),
):
    """Permanently delete a document from both DB and vector store."""
    doc = await db.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "文档不存在")

    collection_id = doc.collection_id
    file_path = doc.file_path
    await db.delete(doc)
    await db.commit()

    # Clean up original file on disk
    if file_path:
        try:
            os.remove(file_path)
            # Remove empty parent dir if isolated
            parent = Path(file_path).parent
            if parent.is_dir() and not any(parent.iterdir()):
                parent.rmdir()
        except OSError:
            pass

    # Clean up vector chunks
    await rag.delete_document_chunks(collection_id, document_id)
