"""
苏格拉底之窗 - RAG Service
Orchestrates: query rewrite → hybrid retrieval → rerank → generation.
"""
import logging
from typing import List, Dict, Any, AsyncIterator

import chromadb
from chromadb.config import Settings as ChromaSettings

from app.config import settings
from app.services.embedding_service import embedding_service
from app.services.llm_service import llm_service
from app.services.bm25_service import BM25Service, rrf_fusion
from app.services.reranker_service import RerankerService

logger = logging.getLogger("Socratess_window")


class RAGService:
    """
    Full RAG pipeline:
    1. Query rewriting (LLM) — resolve anaphora, add missing context
    2. Hybrid retrieval (semantic + BM25) with RRF fusion
    3. Cross-encoder reranking
    4. Context building + LLM generation (streaming or non-streaming)
    """

    def __init__(self):
        self.client = chromadb.PersistentClient(
            path=settings.chroma_persist_dir,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        self.bm25 = BM25Service(persist_dir=settings.chroma_persist_dir)
        self.reranker = RerankerService(
            model_name=settings.reranker_model,
        )

    def _get_collection(self, collection_id: str):
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
        """Embed and store document chunks in ChromaDB + BM25."""
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

        # Also index in BM25
        if settings.hybrid_search_enabled:
            try:
                self.bm25.add_chunks(collection_id, doc_id, doc_name, chunks)
            except Exception:
                logger.warning("BM25 index failed for %s, continuing", doc_id)

    async def delete_document_chunks(self, collection_id: str, doc_id: str):
        """Remove all chunks of a document from vector store + BM25."""
        collection = self._get_collection(collection_id)
        try:
            collection.delete(where={"doc_id": doc_id})
        except Exception:
            pass

        if settings.hybrid_search_enabled:
            try:
                self.bm25.remove_document(collection_id, doc_id)
            except Exception:
                pass

    async def delete_collection(self, collection_id: str):
        """Delete an entire vector collection + BM25 index."""
        try:
            self.client.delete_collection(f"platos_window_{collection_id}")
        except Exception:
            pass
        if settings.hybrid_search_enabled:
            try:
                self.bm25.remove_collection(collection_id)
            except Exception:
                pass

    # ── Retrieval ───────────────────────────────────
    async def _semantic_retrieve(
        self,
        collection_id: str,
        query: str,
        top_k: int = 10,
    ) -> List[Dict[str, Any]]:
        """Semantic (vector) retrieval from ChromaDB."""
        collection = self._get_collection(collection_id)
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
                similarity = 1.0 - (distance / 2.0)

                retrieved.append({
                    "doc_id": meta.get("doc_id", ""),
                    "doc_name": meta.get("doc_name", ""),
                    "chunk_text": doc_text,
                    "score": round(similarity, 4),
                    "chunk_index": meta.get("chunk_index", 0),
                })

        return retrieved

    async def retrieve(
        self,
        collection_id: str,
        query: str,
        top_k: int = 5,
        score_threshold: float = 0.0,
    ) -> List[Dict[str, Any]]:
        """
        Retrieve top-k relevant chunks via hybrid search (semantic + BM25).
        Falls back to semantic-only if BM25 is unavailable.
        Scores are always in 0-1 range (cosine similarity or normalized).
        """
        # Fetch more than needed for fusion/reranking, then trim to top_k
        fetch_k = max(top_k * 3, 10)

        if settings.hybrid_search_enabled and self.bm25.is_ready(collection_id):
            semantic_results = await self._semantic_retrieve(
                collection_id, query, fetch_k
            )
            bm25_results = self.bm25.search(collection_id, query, fetch_k)

            # Normalize BM25 scores to 0-1 range
            if bm25_results:
                max_bm = max(r["score"] for r in bm25_results)
                if max_bm > 0:
                    for r in bm25_results:
                        r["score"] = r["score"] / max_bm

            # Snapshot semantic scores before fusion overwrites them
            semantic_scores: dict = {}
            for r in semantic_results:
                key = f"{r['doc_id']}_{r['chunk_index']}"
                semantic_scores[key] = r["score"]

            fused = rrf_fusion(
                semantic_results,
                bm25_results,
                semantic_weight=settings.semantic_weight,
                bm25_weight=settings.bm25_weight,
            )

            # Restore meaningful display scores:
            # prefer original semantic similarity, fall back to normalized BM25
            for item in fused:
                key = f"{item['doc_id']}_{item['chunk_index']}"
                if key in semantic_scores:
                    item["score"] = semantic_scores[key]
        else:
            fused = await self._semantic_retrieve(collection_id, query, fetch_k)

        # Filter by threshold (applies to semantic scores, 0-1 range)
        if score_threshold > 0:
            fused = [r for r in fused if r["score"] >= score_threshold]

        # Rerank with cross-encoder (reranker handles top_n trimming internally)
        if settings.reranker_enabled and len(fused) > 1:
            rerank_input = min(len(fused), max(top_k * 3, settings.reranker_top_n))
            fused = self.reranker.rerank(query, fused[:rerank_input], top_n=top_k)
        else:
            fused = fused[:top_k]

        return fused

    # ── Context Building ────────────────────────────
    def build_context(self, retrieved: List[Dict[str, Any]], top_k: int = 5) -> str:
        """Build formatted context string from retrieved chunks."""
        if not retrieved:
            return ""

        parts = []
        seen_docs = set()
        for item in retrieved[:top_k]:
            doc_name = item["doc_name"]
            text = item["chunk_text"].strip()

            if doc_name in seen_docs:
                parts.append(f"---\n[来自 {doc_name}]\n{text}")
            else:
                seen_docs.add(doc_name)
                parts.append(f"## {doc_name}\n{text}")

        return "\n\n".join(parts)

    # ── Helpers ─────────────────────────────────────
    def _build_source_items(self, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Build standardized source dicts from retrieval results."""
        return [
            {
                "doc_id": r["doc_id"],
                "doc_name": r["doc_name"],
                "chunk_text": r["chunk_text"][:300],
                "score": r["score"],
                "chunk_index": r.get("chunk_index", 0),
            }
            for r in results
        ]

    # ── Full RAG Pipeline ───────────────────────────
    async def query(
        self,
        collection_id: str,
        user_message: str,
        history: List[Dict[str, str]],
        top_k: int = 5,
        mode: str = "socratic",
    ) -> Dict[str, Any]:
        """Non-streaming RAG query: rewrite → retrieve → generate."""
        # Step 0: Query rewriting
        search_query = user_message
        if settings.query_rewrite_enabled and history:
            search_query = await llm_service.rewrite_query(user_message, history)

        retrieved = await self.retrieve(collection_id, search_query, top_k)
        context = self.build_context(retrieved, top_k)

        response = await llm_service.chat(user_message, history, context, mode)

        return {
            "content": response["content"],
            "sources": self._build_source_items(retrieved),
            "usage": response.get("usage", {}),
        }

    async def query_stream(
        self,
        collection_id: str,
        user_message: str,
        history: List[Dict[str, str]],
        top_k: int = 5,
        mode: str = "socratic",
    ) -> AsyncIterator[Dict[str, Any]]:
        """Streaming RAG query: rewrite → retrieve → generate."""
        # Step 0: Query rewriting
        search_query = user_message
        if settings.query_rewrite_enabled:
            search_query = await llm_service.rewrite_query(user_message, history)

        retrieved = await self.retrieve(collection_id, search_query, top_k)
        context = self.build_context(retrieved, top_k)

        async for chunk in llm_service.chat_stream(user_message, history, context, mode):
            yield {"type": "chunk", "content": chunk}

        yield {
            "type": "sources",
            "sources": self._build_source_items(retrieved),
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
