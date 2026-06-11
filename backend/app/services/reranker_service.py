"""
KnowMicro - Reranker Service
Cross-Encoder re-ranking for improved retrieval quality.
"""
import logging
from typing import List, Dict, Any

logger = logging.getLogger("knowmicro")


class RerankerService:
    """Cross-Encoder reranker for post-retrieval result ordering."""

    def __init__(self, model_name: str = "BAAI/bge-reranker-v2-m3"):
        self.model_name = model_name
        self.model = None
        self._load_attempted = False

    def _ensure_model(self):
        if self._load_attempted:
            return
        self._load_attempted = True
        try:
            from sentence_transformers import CrossEncoder
            self.model = CrossEncoder(
                self.model_name,
                automodel_args={"device_map": "auto"},
            )
            logger.info("Reranker model loaded: %s", self.model_name)
        except Exception as e:
            logger.warning(
                "Reranker model not available (%s), reranking disabled", e
            )

    def rerank(
        self,
        query: str,
        chunks: List[Dict[str, Any]],
        top_n: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Re-rank retrieved chunks using cross-encoder.
        Falls back to original ordering if model unavailable.
        Always trims output to top_n.
        """
        if not chunks:
            return chunks

        self._ensure_model()
        if self.model is None:
            return chunks[:top_n]

        try:
            pairs = [[query, c["chunk_text"]] for c in chunks]
            scores = self.model.predict(pairs, show_progress_bar=False)

            for i, score in enumerate(scores):
                chunks[i]["score"] = round(float(score), 4)

            chunks.sort(key=lambda x: x["score"], reverse=True)
        except Exception as e:
            logger.warning("Reranking failed: %s", e)

        return chunks[:top_n]
