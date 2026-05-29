"""
苏格拉底之窗 - Chunking Service
Multiple strategies for splitting text into chunks.
"""
from typing import List, Callable
import re
from app.config import settings


class ChunkingService:
    """Text chunking with configurable strategies."""

    def __init__(self, chunk_size: int = 800, chunk_overlap: int = 150):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    # ── Strategy 1: Recursive Character Split ───────
    def recursive_split(self, text: str) -> List[str]:
        """
        Split text recursively on natural boundaries.
        Separators in priority: paragraphs → sentences → phrases → words → chars.
        """
        separators = [
            "\n\n", "\n", "。", "！", "？",           # paragraphs & Chinese sentence endings
            ". ", "! ", "? ",                           # English sentence endings
            "；", ";", "：", ":", "，", ",",           # phrases
            " ",                                         # words
            "",                                          # characters
        ]
        return self._split_recursive(text, separators)

    def _split_recursive(self, text: str, separators: List[str]) -> List[str]:
        if len(text) <= self.chunk_size:
            return [text] if text.strip() else []

        for sep in separators:
            if sep == "":
                # Pure character split
                return self._merge_splits([c for c in text])

            splits = text.split(sep)
            if len(splits) > 1:
                # Rejoin with separator to preserve it
                chunks = self._merge_splits(splits, sep)
                if len(chunks) > 1:
                    return chunks
                # Still one chunk, try next separator

        # Fallback: force split at chunk_size
        return self._force_split(text)

    def _merge_splits(self, splits: List[str], separator: str = "") -> List[str]:
        """Merge splits into chunks respecting chunk_size with overlap."""
        chunks: List[str] = []
        current = ""

        for part in splits:
            candidate = current + (separator if current else "") + part
            if len(candidate) > self.chunk_size and current:
                chunks.append(current)
                # Overlap: keep last part of previous chunk
                if self.chunk_overlap > 0 and len(current) > self.chunk_overlap:
                    current = current[-self.chunk_overlap:] + (separator if current else "") + part
                else:
                    current = part
            else:
                current = candidate

        if current.strip():
            chunks.append(current)

        return chunks

    def _force_split(self, text: str) -> List[str]:
        """Force split by characters with overlap."""
        chunks = []
        start = 0
        while start < len(text):
            end = min(start + self.chunk_size, len(text))
            chunks.append(text[start:end])
            start += self.chunk_size - self.chunk_overlap
        return chunks

    # ── Strategy 2: Markdown-aware Split ────────────
    def markdown_split(self, text: str) -> List[str]:
        """
        Split markdown text on headers, preserving structure.
        Each ##-level section becomes a potential chunk boundary.
        """
        sections = re.split(r'\n(?=#{1,3}\s)', text)
        chunks: List[str] = []
        current = ""

        for section in sections:
            if len(current) + len(section) > self.chunk_size and current:
                chunks.append(current)
                if self.chunk_overlap > 0 and len(current) > self.chunk_overlap:
                    current = current[-self.chunk_overlap:] + "\n" + section
                else:
                    current = section
            else:
                current = current + ("\n" if current else "") + section

        if current.strip():
            chunks.append(current)

        return chunks

    # ── Strategy 3: Semantic Split (sentence boundary) ──
    def semantic_split(self, text: str) -> List[str]:
        """
        Split on sentence boundaries, merging into chunk-sized groups.
        Preserves semantic coherence better than fixed-size splits.
        """
        sentences = re.split(
            r'(?<=[。！？.!?])\s*(?=[^\s])',
            text
        )
        sentences = [s.strip() for s in sentences if s.strip()]

        chunks: List[str] = []
        current = ""

        for sent in sentences:
            if len(current) + len(sent) > self.chunk_size and current:
                chunks.append(current)
                if self.chunk_overlap > 0 and len(current) > self.chunk_overlap:
                    current = current[-self.chunk_overlap:] + sent
                else:
                    current = sent
            else:
                current = current + sent if current else sent

        if current.strip():
            chunks.append(current)

        return chunks

    # ── Auto-detect Strategy ────────────────────────
    def auto_chunk(self, text: str, file_type: str = "txt") -> List[str]:
        """Pick the best strategy based on file type."""
        if file_type == "md":
            chunks = self.markdown_split(text)
        elif file_type in ("txt", "pdf"):
            # Try semantic first, fallback to recursive
            chunks = self.semantic_split(text)
            if not chunks or all(len(c) < 50 for c in chunks):
                chunks = self.recursive_split(text)
        else:
            chunks = self.recursive_split(text)

        # Filter empty/whitespace chunks
        return [c for c in chunks if c.strip() and len(c.strip()) > 10]


chunking_service = ChunkingService(
    chunk_size=settings.chunk_size,
    chunk_overlap=settings.chunk_overlap,
)
