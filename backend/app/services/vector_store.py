"""
Abstract base classes for vector storage and keyword search.
Allows swapping ChromaDB/BM25 for other backends (Milvus, Pinecone, Elasticsearch, etc.)
"""
from abc import ABC, abstractmethod
from typing import List, Dict, Any


class VectorStore(ABC):
    """Abstract interface for a vector / embedding store."""

    @abstractmethod
    async def add(
        self,
        collection_id: str,
        ids: List[str],
        embeddings: List[List[float]],
        documents: List[str],
        metadatas: List[Dict[str, Any]],
    ) -> None:
        """Index document chunks with pre-computed embeddings."""
        ...

    @abstractmethod
    async def query(
        self,
        collection_id: str,
        query_embedding: List[float],
        top_k: int,
    ) -> List[Dict[str, Any]]:
        """
        Return top-k results as list of dicts:
        [{doc_id, doc_name, chunk_text, score, chunk_index}, ...]
        """
        ...

    @abstractmethod
    async def delete(self, collection_id: str, doc_id: str) -> None:
        """Remove all chunks belonging to a document."""
        ...

    @abstractmethod
    async def delete_collection(self, collection_id: str) -> None:
        """Drop an entire collection."""
        ...

    @abstractmethod
    def count(self, collection_id: str) -> int:
        """Return the number of vectors in a collection."""
        ...


class KeywordStore(ABC):
    """Abstract interface for keyword / sparse retrieval."""

    @abstractmethod
    def add_chunks(
        self,
        collection_id: str,
        doc_id: str,
        doc_name: str,
        chunks: List[Dict[str, Any]],
    ) -> None:
        """Index text chunks for keyword search."""
        ...

    @abstractmethod
    def search(
        self,
        collection_id: str,
        query: str,
        top_k: int,
    ) -> List[Dict[str, Any]]:
        """
        Return top-k results as list of dicts:
        [{doc_id, doc_name, chunk_text, score, chunk_index}, ...]
        """
        ...

    @abstractmethod
    def remove_document(self, collection_id: str, doc_id: str) -> None:
        """Remove all chunks of a document from the keyword index."""
        ...

    @abstractmethod
    def remove_collection(self, collection_id: str) -> None:
        """Drop a keyword index collection."""
        ...

    @abstractmethod
    def is_ready(self, collection_id: str) -> bool:
        """Whether the keyword index for a collection is loaded and searchable."""
        ...
