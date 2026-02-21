"""Smart text chunking with context preservation."""
from typing import List, Dict, Any, Optional
import re

import tiktoken

from app.config import settings


class TextChunk:
    """Text chunk with metadata."""
    
    def __init__(
        self,
        text: str,
        index: int,
        token_count: int,
        metadata: Optional[Dict[str, Any]] = None,
        context_before: Optional[str] = None,
        context_after: Optional[str] = None
    ):
        self.text = text
        self.index = index
        self.token_count = token_count
        self.metadata = metadata or {}
        self.context_before = context_before
        self.context_after = context_after


class Chunker:
    """Smart text chunker with recursive splitting."""
    
    def __init__(
        self,
        chunk_size: Optional[int] = None,
        chunk_overlap: Optional[int] = None,
        max_tokens: Optional[int] = None
    ):
        self.chunk_size = chunk_size or settings.CHUNK_SIZE
        self.chunk_overlap = chunk_overlap or settings.CHUNK_OVERLAP
        self.max_tokens = max_tokens or settings.CHUNK_MAX_TOKENS
        self.tokenizer = tiktoken.get_encoding("cl100k_base")
    
    def count_tokens(self, text: str) -> int:
        """Count tokens in text.
        
        Args:
            text: Input text
            
        Returns:
            Token count
        """
        return len(self.tokenizer.encode(text))
    
    def chunk_text(
        self,
        text: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> List[TextChunk]:
        """Chunk text with smart splitting.
        
        Strategy:
        1. Split by headings first
        2. Then by paragraphs
        3. Finally by sentences
        
        Args:
            text: Input text
            metadata: Optional metadata to include with chunks
            
        Returns:
            List of text chunks
        """
        if not text.strip():
            return []
        
        # Check if text fits in single chunk
        if self.count_tokens(text) <= self.chunk_size:
            return [TextChunk(
                text=text.strip(),
                index=0,
                token_count=self.count_tokens(text),
                metadata=metadata
            )]
        
        # Try splitting by headings first
        chunks = self._split_by_headings(text, metadata)
        
        # Merge small chunks
        chunks = self._merge_small_chunks(chunks)
        
        # Add context to chunks
        chunks = self._add_context(chunks)
        
        return chunks
    
    def _split_by_headings(
        self,
        text: str,
        metadata: Optional[Dict[str, Any]]
    ) -> List[TextChunk]:
        """Split text by Markdown headings.
        
        Args:
            text: Input text
            metadata: Optional metadata
            
        Returns:
            List of chunks
        """
        # Markdown heading pattern
        heading_pattern = r'^(#{1,6}\s+.+)$'
        
        parts = re.split(f'({heading_pattern})', text, flags=re.MULTILINE)
        
        chunks = []
        current_chunk = []
        current_tokens = 0
        chunk_index = 0
        
        for part in parts:
            if not part.strip():
                continue
            
            part_tokens = self.count_tokens(part)
            
            # If adding this part exceeds chunk size, save current chunk
            if current_tokens + part_tokens > self.chunk_size and current_chunk:
                chunk_text = ''.join(current_chunk).strip()
                chunks.append(TextChunk(
                    text=chunk_text,
                    index=chunk_index,
                    token_count=self.count_tokens(chunk_text),
                    metadata=metadata
                ))
                chunk_index += 1
                
                # Keep overlap
                overlap_text = self._get_overlap_text(current_chunk)
                current_chunk = [overlap_text, part] if overlap_text else [part]
                current_tokens = self.count_tokens(''.join(current_chunk))
            else:
                current_chunk.append(part)
                current_tokens += part_tokens
        
        # Don't forget the last chunk
        if current_chunk:
            chunk_text = ''.join(current_chunk).strip()
            chunks.append(TextChunk(
                text=chunk_text,
                index=chunk_index,
                token_count=self.count_tokens(chunk_text),
                metadata=metadata
            ))
        
        # If no headings found or chunks too large, split by paragraphs
        if len(chunks) <= 1:
            return self._split_by_paragraphs(text, metadata)
        
        return chunks
    
    def _split_by_paragraphs(
        self,
        text: str,
        metadata: Optional[Dict[str, Any]]
    ) -> List[TextChunk]:
        """Split text by paragraphs.
        
        Args:
            text: Input text
            metadata: Optional metadata
            
        Returns:
            List of chunks
        """
        paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
        
        chunks = []
        current_chunk = []
        current_tokens = 0
        chunk_index = 0
        
        for para in paragraphs:
            para_tokens = self.count_tokens(para)
            
            # If single paragraph is too large, split by sentences
            if para_tokens > self.chunk_size:
                if current_chunk:
                    chunk_text = '\n\n'.join(current_chunk).strip()
                    chunks.append(TextChunk(
                        text=chunk_text,
                        index=chunk_index,
                        token_count=self.count_tokens(chunk_text),
                        metadata=metadata
                    ))
                    chunk_index += 1
                    current_chunk = []
                    current_tokens = 0
                
                # Split large paragraph by sentences
                sentence_chunks = self._split_by_sentences(para, metadata, chunk_index)
                chunks.extend(sentence_chunks)
                chunk_index += len(sentence_chunks)
                continue
            
            # If adding this paragraph exceeds chunk size, save current chunk
            if current_tokens + para_tokens > self.chunk_size and current_chunk:
                chunk_text = '\n\n'.join(current_chunk).strip()
                chunks.append(TextChunk(
                    text=chunk_text,
                    index=chunk_index,
                    token_count=self.count_tokens(chunk_text),
                    metadata=metadata
                ))
                chunk_index += 1
                
                # Keep overlap
                overlap_text = self._get_overlap_text(current_chunk)
                current_chunk = [overlap_text, para] if overlap_text else [para]
                current_tokens = self.count_tokens('\n\n'.join(current_chunk))
            else:
                current_chunk.append(para)
                current_tokens += para_tokens
        
        # Don't forget the last chunk
        if current_chunk:
            chunk_text = '\n\n'.join(current_chunk).strip()
            chunks.append(TextChunk(
                text=chunk_text,
                index=chunk_index,
                token_count=self.count_tokens(chunk_text),
                metadata=metadata
            ))
        
        return chunks
    
    def _split_by_sentences(
        self,
        text: str,
        metadata: Optional[Dict[str, Any]],
        start_index: int = 0
    ) -> List[TextChunk]:
        """Split text by sentences.
        
        Args:
            text: Input text
            metadata: Optional metadata
            start_index: Starting chunk index
            
        Returns:
            List of chunks
        """
        # Sentence splitting pattern
        sentence_pattern = r'(?<=[.!?])\s+'
        sentences = re.split(sentence_pattern, text)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        chunks = []
        current_chunk = []
        current_tokens = 0
        chunk_index = start_index
        
        for sentence in sentences:
            sentence_tokens = self.count_tokens(sentence)
            
            # If adding this sentence exceeds chunk size, save current chunk
            if current_tokens + sentence_tokens > self.chunk_size and current_chunk:
                chunk_text = ' '.join(current_chunk).strip()
                chunks.append(TextChunk(
                    text=chunk_text,
                    index=chunk_index,
                    token_count=self.count_tokens(chunk_text),
                    metadata=metadata
                ))
                chunk_index += 1
                
                # Keep overlap
                overlap_text = self._get_overlap_text(current_chunk, separator=' ')
                current_chunk = [overlap_text, sentence] if overlap_text else [sentence]
                current_tokens = self.count_tokens(' '.join(current_chunk))
            else:
                current_chunk.append(sentence)
                current_tokens += sentence_tokens
        
        # Don't forget the last chunk
        if current_chunk:
            chunk_text = ' '.join(current_chunk).strip()
            chunks.append(TextChunk(
                text=chunk_text,
                index=chunk_index,
                token_count=self.count_tokens(chunk_text),
                metadata=metadata
            ))
        
        return chunks
    
    def _get_overlap_text(
        self,
        chunks: List[str],
        separator: str = '\n\n'
    ) -> Optional[str]:
        """Get overlap text from previous chunks.
        
        Args:
            chunks: Previous chunks
            separator: Separator between chunks
            
        Returns:
            Overlap text or None
        """
        overlap_tokens = 0
        overlap_chunks = []
        
        for chunk in reversed(chunks):
            chunk_tokens = self.count_tokens(chunk)
            if overlap_tokens + chunk_tokens > self.chunk_overlap:
                break
            overlap_chunks.insert(0, chunk)
            overlap_tokens += chunk_tokens
        
        return separator.join(overlap_chunks) if overlap_chunks else None
    
    def _merge_small_chunks(self, chunks: List[TextChunk]) -> List[TextChunk]:
        """Merge chunks that are too small.
        
        Args:
            chunks: List of chunks
            
        Returns:
            Merged chunks
        """
        if len(chunks) <= 1:
            return chunks
        
        merged = []
        current_chunk = None
        
        for chunk in chunks:
            if current_chunk is None:
                current_chunk = chunk
            elif current_chunk.token_count + chunk.token_count < self.chunk_size:
                # Merge chunks
                current_chunk.text += '\n\n' + chunk.text
                current_chunk.token_count = self.count_tokens(current_chunk.text)
            else:
                merged.append(current_chunk)
                current_chunk = chunk
        
        if current_chunk:
            merged.append(current_chunk)
        
        # Re-index
        for i, chunk in enumerate(merged):
            chunk.index = i
        
        return merged
    
    def _add_context(self, chunks: List[TextChunk]) -> List[TextChunk]:
        """Add context before/after to chunks.
        
        Args:
            chunks: List of chunks
            
        Returns:
            Chunks with context
        """
        for i, chunk in enumerate(chunks):
            # Add context from previous chunk
            if i > 0:
                prev_text = chunks[i - 1].text
                # Take last 100 characters or less
                chunk.context_before = prev_text[-100:] if len(prev_text) > 100 else prev_text
            
            # Add context from next chunk
            if i < len(chunks) - 1:
                next_text = chunks[i + 1].text
                # Take first 100 characters or less
                chunk.context_after = next_text[:100] if len(next_text) > 100 else next_text
        
        return chunks


# Global chunker instance
chunker = Chunker()
