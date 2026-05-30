"""
苏格拉底之窗 - Document API Routes
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db, Collection, Document
from app.schemas.schemas import DocumentOut, DocumentUploadResponse, DocumentPreview, DocumentChunk
from app.services.document_service import document_service
from app.services.rag_service import rag_service

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.post("/upload/{collection_id}", response_model=DocumentUploadResponse, status_code=201)
async def upload_document(
    collection_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
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

    # Parse document
    try:
        parsed = await document_service.parse(content, file.filename)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"文档解析失败: {str(e)}")

    # Create document record
    doc = Document(
        collection_id=collection_id,
        filename=file.filename,
        file_type=parsed["file_type"],
        file_size=len(content),
        content=parsed["text"],  # 存储解析后的文本内容
        status="processing",
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # Chunk and index
    try:
        chunks = document_service.chunk(parsed["text"], parsed["file_type"])
        doc.chunk_count = len(chunks)

        await rag_service.index_chunks(
            collection_id=collection_id,
            doc_id=doc.id,
            doc_name=file.filename,
            chunks=chunks,
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

            # Parse document
            parsed = await document_service.parse(content, file.filename)

            # Create document record
            doc = Document(
                collection_id=collection_id,
                filename=file.filename,
                file_type=parsed["file_type"],
                file_size=len(content),
                content=parsed["text"],
                status="processing",
            )
            db.add(doc)
            await db.commit()
            await db.refresh(doc)

            # Chunk and index
            try:
                chunks = document_service.chunk(parsed["text"], parsed["file_type"])
                doc.chunk_count = len(chunks)

                await rag_service.index_chunks(
                    collection_id=collection_id,
                    doc_id=doc.id,
                    doc_name=file.filename,
                    chunks=chunks,
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


@router.get("/collection/{collection_id}", response_model=List[DocumentOut])
async def list_documents(
    collection_id: str,
    db: AsyncSession = Depends(get_db),
):
    """List all documents in a collection."""
    result = await db.execute(
        select(Document)
        .where(Document.collection_id == collection_id)
        .order_by(Document.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{document_id}", response_model=DocumentPreview)
async def get_document_preview(
    document_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get document content and chunks for preview."""
    doc = await db.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "文档不存在")

    # Re-chunk the content to show chunks
    chunks = []
    if doc.content:
        chunk_list = document_service.chunk(doc.content, doc.file_type)
        chunks = [
            DocumentChunk(
                index=c["index"],
                text=c["text"],
                char_count=c["char_count"],
            )
            for c in chunk_list
        ]

    return DocumentPreview(
        document_id=doc.id,
        filename=doc.filename,
        file_type=doc.file_type,
        file_size=doc.file_size,
        chunk_count=doc.chunk_count,
        content=doc.content or "",
        chunks=chunks,
    )


@router.delete("/{document_id}", status_code=204)
async def delete_document(
    document_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a document from both DB and vector store."""
    doc = await db.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "文档不存在")

    collection_id = doc.collection_id
    await db.delete(doc)
    await db.commit()

    # Clean up vector chunks
    await rag_service.delete_document_chunks(collection_id, document_id)
