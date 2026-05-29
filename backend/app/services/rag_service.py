"""
柏拉图之窗 - RAG Service
Orchestrates retrieval + generation pipeline.
"""
from typing import List, Dict, Any, AsyncIterator
import uuid
import chromadb
from chromadb.config import Settings as ChromaSettings
from app.config import settings
from app.services.embedding_service import embedding_service
from app.services.llm_service import llm_service


class RAGService:
    """
    Full RAG pipeline:
    1. Embed query
    2. Retrieve relevant chunks from ChromaDB
    3. Build context + prompt
    4. Generate response via LLM (streaming or non-streaming)
    """

    def __init__(self):
        self.client = chromadb.PersistentClient(
            path=settings.chroma_persist_dir,
            settings=ChromaSettings(anonymized_telemetry=False),
        )

    def _get_collection(self, collection_id: str):
        """Get or create a ChromaDB collection for a given knowledge base."""
        return self.client.get_or_create_collection(
            name=f"platos_window_{collection_id}",
            metadata={"hnsw:space": "cosine"},
        )

    # ── Document Indexing ───────────────────────────
    async def index_chunks(
        self,
        collection_id: str,
        doc_id: str,
        doc_name: str,
        chunks: List[Dict[str, Any]],
    ):
        """Embed and store document chunks in ChromaDB."""
        collection = self._get_collection(collection_id)

        texts = [c["text"] for c in chunks]
        embeddings = await embedding_service.embed(texts)

        ids = [f"{doc_id}_chunk_{c['index']}" for c in chunks]
        metadatas = [
            {
                "doc_id": doc_id,
                "doc_name": doc_name,
                "chunk_index": c["index"],
                "char_count": c.get("char_count", len(c["text"])),
            }
            for c in chunks
        ]

        collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=texts,
            metadatas=metadatas,
        )

    async def delete_document_chunks(self, collection_id: str, doc_id: str):
        """Remove all chunks of a document from the vector store."""
        collection = self._get_collection(collection_id)
        try:
            collection.delete(where={"doc_id": doc_id})
        except Exception:
            # ChromaDB may raise if nothing matches
            pass

    async def delete_collection(self, collection_id: str):
        """Delete an entire vector collection."""
        try:
            self.client.delete_collection(f"platos_window_{collection_id}")
        except Exception:
            pass

    # ── Retrieval ───────────────────────────────────
    async def retrieve(
        self,
        collection_id: str,
        query: str,
        top_k: int = 5,
        score_threshold: float = 0.0,
    ) -> List[Dict[str, Any]]:
        """
        Retrieve top-k relevant chunks for a query.
        Returns list of {doc_id, doc_name, chunk_text, score, chunk_index}.
        """
        collection = self._get_collection(collection_id)

        # Check if collection is empty
        if collection.count() == 0:
            return []

        query_embedding = await embedding_service.embed_single(query)

        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=min(top_k, collection.count()),
            include=["documents", "metadatas", "distances"],
        )

        retrieved = []
        if results["documents"] and results["documents"][0]:
            for i, doc_text in enumerate(results["documents"][0]):
                meta = results["metadatas"][0][i]
                distance = results["distances"][0][i]
                # Convert cosine distance to similarity (ChromaDB uses distance for cosine)
                # For cosine space, distance ∈ [0, 2], similarity = 1 - distance/2
                similarity = 1.0 - (distance / 2.0)

                if similarity < score_threshold:
                    continue

                retrieved.append({
                    "doc_id": meta.get("doc_id", ""),
                    "doc_name": meta.get("doc_name", ""),
                    "chunk_text": doc_text,
                    "score": round(similarity, 4),
                    "chunk_index": meta.get("chunk_index", 0),
                })

        return retrieved

    # ── Context Building ────────────────────────────
    def build_context(self, retrieved: List[Dict[str, Any]]) -> str:
        """Build formatted context string from retrieved chunks."""
        if not retrieved:
            return ""

        parts = []
        seen_docs = set()
        for item in retrieved[:5]:  # Cap at 5 chunks for context window
            doc_name = item["doc_name"]
            text = item["chunk_text"].strip()

            if doc_name in seen_docs:
                parts.append(f"---\n[来自 {doc_name}]\n{text}")
            else:
                seen_docs.add(doc_name)
                parts.append(f"## {doc_name}\n{text}")

        return "\n\n".join(parts)

    # ── Full RAG Pipeline ───────────────────────────
    async def query(
        self,
        collection_id: str,
        user_message: str,
        history: List[Dict[str, str]],
        top_k: int = 5,
    ) -> Dict[str, Any]:
        """Non-streaming RAG query: retrieve → generate."""
        retrieved = await self.retrieve(collection_id, user_message, top_k)
        context = self.build_context(retrieved)

        response = await llm_service.chat(user_message, history, context)

        return {
            "content": response["content"],
            "sources": [
                {
                    "doc_id": r["doc_id"],
                    "doc_name": r["doc_name"],
                    "chunk_text": r["chunk_text"][:300],
                    "score": r["score"],
                }
                for r in retrieved
            ],
            "usage": response.get("usage", {}),
        }

    async def query_stream(
        self,
        collection_id: str,
        user_message: str,
        history: List[Dict[str, str]],
        top_k: int = 5,
    ) -> AsyncIterator[Dict[str, Any]]:
        """
        Streaming RAG query.
        Yields {type: "chunk"|"sources", content/chunk, sources}.
        """
        retrieved = await self.retrieve(collection_id, user_message, top_k)
        context = self.build_context(retrieved)

        # Stream LLM response
        async for chunk in llm_service.chat_stream(user_message, history, context):
            yield {"type": "chunk", "content": chunk}

        # Yield sources at the end
        yield {
            "type": "sources",
            "sources": [
                {
                    "doc_id": r["doc_id"],
                    "doc_name": r["doc_name"],
                    "chunk_text": r["chunk_text"][:300],
                    "score": r["score"],
                }
                for r in retrieved
            ],
        }

    # ── Collection Stats ────────────────────────────
    def collection_stats(self, collection_id: str) -> Dict[str, Any]:
        """Get statistics about a ChromaDB collection."""
        try:
            collection = self._get_collection(collection_id)
            return {
                "chunk_count": collection.count(),
                "exists": True,
            }
        except Exception:
            return {"chunk_count": 0, "exists": False}


rag_service = RAGService()
