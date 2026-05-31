"""
苏格拉底之窗 - BM25 Hybrid Search Service
Keyword-based retrieval with BM25 scoring + Chinese tokenization.
"""
import json
import os
import logging
from typing import List, Dict, Any, Tuple
import numpy as np

from rank_bm25 import BM25Okapi
import jieba

logger = logging.getLogger("Socratess_window")


class BM25Service:
    """BM25 keyword search with Chinese + English tokenization."""

    def __init__(self, persist_dir: str):
        self.persist_dir = persist_dir
        self.corpora: Dict[str, List[str]] = {}
        self.indices: Dict[str, BM25Okapi] = {}
        self.meta: Dict[str, List[Tuple[str, str, int]]] = {}

    def _tokenize(self, text: str) -> List[str]:
        tokens = list(jieba.cut(text))
        return [t.strip() for t in tokens if t.strip()]

    def _corpus_path(self, collection_id: str) -> str:
        os.makedirs(self.persist_dir, exist_ok=True)
        return os.path.join(self.persist_dir, f"bm25_{collection_id}.json")

    def _save(self, collection_id: str):
        if collection_id not in self.corpora:
            return
        data = {
            "texts": self.corpora[collection_id],
            "meta": [(d, n, c) for d, n, c in self.meta[collection_id]],
        }
        try:
            with open(self._corpus_path(collection_id), "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False)
        except Exception:
            logger.warning("Failed to save BM25 corpus for %s", collection_id)

    def _load(self, collection_id: str) -> bool:
        path = self._corpus_path(collection_id)
        if not os.path.exists(path):
            return False
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            texts = data.get("texts", [])
            meta = [(d, n, c) for d, n, c in data.get("meta", [])]
            if not texts:
                return False
            self.corpora[collection_id] = texts
            self.meta[collection_id] = meta
            tokenized = [self._tokenize(t) for t in texts]
            self.indices[collection_id] = BM25Okapi(tokenized)
            logger.info("BM25 index loaded for %s: %d chunks", collection_id, len(texts))
            return True
        except Exception:
            logger.warning("Failed to load BM25 corpus for %s", collection_id)
            return False

    def _ensure_loaded(self, collection_id: str):
        """Lazy-load BM25 index from disk."""
        if collection_id in self.indices:
            return
        self._load(collection_id)

    # ── Indexing ─────────────────────────────────
    def add_chunks(
        self,
        collection_id: str,
        doc_id: str,
        doc_name: str,
        chunks: List[Dict[str, Any]],
    ):
        self._ensure_loaded(collection_id)
        if collection_id not in self.corpora:
            self.corpora[collection_id] = []
            self.meta[collection_id] = []

        for c in chunks:
            self.corpora[collection_id].append(c["text"])
            self.meta[collection_id].append((doc_id, doc_name, c.get("index", 0)))

        tokenized = [self._tokenize(t) for t in self.corpora[collection_id]]
        self.indices[collection_id] = BM25Okapi(tokenized)
        self._save(collection_id)

    def remove_document(self, collection_id: str, doc_id: str):
        self._ensure_loaded(collection_id)
        if collection_id not in self.meta:
            return
        keep = [
            i for i, (did, _, _) in enumerate(self.meta[collection_id])
            if did != doc_id
        ]
        if len(keep) == len(self.meta[collection_id]):
            return  # nothing removed

        self.corpora[collection_id] = [self.corpora[collection_id][i] for i in keep]
        self.meta[collection_id] = [self.meta[collection_id][i] for i in keep]

        if self.corpora[collection_id]:
            tokenized = [self._tokenize(t) for t in self.corpora[collection_id]]
            self.indices[collection_id] = BM25Okapi(tokenized)
        else:
            self.indices.pop(collection_id, None)
        self._save(collection_id)

    def remove_collection(self, collection_id: str):
        self.corpora.pop(collection_id, None)
        self.indices.pop(collection_id, None)
        self.meta.pop(collection_id, None)
        path = self._corpus_path(collection_id)
        if os.path.exists(path):
            try:
                os.remove(path)
            except Exception:
                pass

    # ── Search ───────────────────────────────────
    def search(
        self, collection_id: str, query: str, top_k: int = 10
    ) -> List[Dict[str, Any]]:
        self._ensure_loaded(collection_id)
        if collection_id not in self.indices:
            return []

        tokenized_query = self._tokenize(query)
        if not tokenized_query:
            return []

        scores = self.indices[collection_id].get_scores(tokenized_query)
        top_indices = np.argsort(scores)[::-1][:top_k]

        results = []
        for idx in top_indices:
            if scores[idx] <= 0:
                continue
            doc_id, doc_name, chunk_index = self.meta[collection_id][idx]
            results.append({
                "doc_id": doc_id,
                "doc_name": doc_name,
                "chunk_text": self.corpora[collection_id][idx],
                "score": float(scores[idx]),
                "chunk_index": chunk_index,
            })
        return results

    def is_ready(self, collection_id: str) -> bool:
        self._ensure_loaded(collection_id)
        return collection_id in self.indices


def rrf_fusion(
    semantic_results: List[Dict[str, Any]],
    bm25_results: List[Dict[str, Any]],
    semantic_weight: float = 0.7,
    bm25_weight: float = 0.3,
    k: int = 60,
) -> List[Dict[str, Any]]:
    """
    Reciprocal Rank Fusion for combining semantic and BM25 results.
    Returns fused results sorted by combined RRF score.
    """
    scores: Dict[str, Dict[str, Any]] = {}

    for rank, item in enumerate(semantic_results):
        key = f"{item['doc_id']}_{item['chunk_index']}"
        rrf = semantic_weight / (k + rank + 1)
        if key not in scores:
            scores[key] = {**item, "_fused": rrf}
        else:
            scores[key]["_fused"] += rrf

    for rank, item in enumerate(bm25_results):
        key = f"{item['doc_id']}_{item['chunk_index']}"
        rrf = bm25_weight / (k + rank + 1)
        if key not in scores:
            scores[key] = {**item, "_fused": rrf}
        else:
            scores[key]["_fused"] += rrf

    fused = sorted(scores.values(), key=lambda x: x["_fused"], reverse=True)
    for item in fused:
        item["score"] = round(item["_fused"], 4)
        del item["_fused"]
    return fused
