"""Embedding providers for text vectorization."""
from typing import List, Optional
import hashlib
import json
from abc import ABC, abstractmethod

import openai
import cohere
from sentence_transformers import SentenceTransformer
import tiktoken

from app.config import settings


class EmbeddingProvider(ABC):
    """Abstract base class for embedding providers."""
    
    @abstractmethod
    def embed(self, texts: List[str]) -> List[List[float]]:
        """Embed texts into vectors.
        
        Args:
            texts: List of texts to embed
            
        Returns:
            List of embedding vectors
        """
        pass
    
    @property
    @abstractmethod
    def dimension(self) -> int:
        """Return embedding dimension."""
        pass
    
    @property
    @abstractmethod
    def model_name(self) -> str:
        """Return model name."""
        pass


class OpenAIEmbedder(EmbeddingProvider):
    """OpenAI embedding provider."""
    
    def __init__(self, model: Optional[str] = None):
        self.client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
        self._model = model or settings.OPENAI_EMBEDDING_MODEL
        self._dimension = self._get_dimension()
    
    def _get_dimension(self) -> int:
        """Get embedding dimension for model."""
        dimensions = {
            "text-embedding-ada-002": 1536,
            "text-embedding-3-small": 1536,
            "text-embedding-3-large": 3072,
        }
        return dimensions.get(self._model, 1536)
    
    def embed(self, texts: List[str]) -> List[List[float]]:
        """Embed texts using OpenAI API."""
        # Batch size for OpenAI
        batch_size = settings.EMBEDDING_BATCH_SIZE
        all_embeddings = []
        
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            
            response = self.client.embeddings.create(
                model=self._model,
                input=batch,
                encoding_format="float"
            )
            
            batch_embeddings = [item.embedding for item in response.data]
            all_embeddings.extend(batch_embeddings)
        
        return all_embeddings
    
    @property
    def dimension(self) -> int:
        return self._dimension
    
    @property
    def model_name(self) -> str:
        return self._model


class CohereEmbedder(EmbeddingProvider):
    """Cohere embedding provider."""
    
    def __init__(self, model: Optional[str] = None):
        self.client = cohere.Client(settings.COHERE_API_KEY)
        self._model = model or settings.COHERE_EMBEDDING_MODEL
        self._dimension = 1024  # Cohere embed-english-v3.0
    
    def embed(self, texts: List[str]) -> List[List[float]]:
        """Embed texts using Cohere API."""
        # Batch size for Cohere
        batch_size = 96
        all_embeddings = []
        
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            
            response = self.client.embed(
                texts=batch,
                model=self._model,
                input_type="search_document"
            )
            
            all_embeddings.extend(response.embeddings)
        
        return all_embeddings
    
    @property
    def dimension(self) -> int:
        return self._dimension
    
    @property
    def model_name(self) -> str:
        return self._model


class BGEEmbedder(EmbeddingProvider):
    """Local BGE embedding provider using sentence-transformers."""
    
    def __init__(self, model_name: Optional[str] = None):
        self._model_name = model_name or settings.BGE_MODEL_NAME
        self._model = SentenceTransformer(self._model_name)
        self._dimension = self._model.get_sentence_embedding_dimension()
    
    def embed(self, texts: List[str]) -> List[List[float]]:
        """Embed texts locally using BGE model."""
        # Batch size for local model
        batch_size = 32
        all_embeddings = []
        
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            embeddings = self._model.encode(batch, convert_to_list=True)
            all_embeddings.extend(embeddings)
        
        return all_embeddings
    
    @property
    def dimension(self) -> int:
        return self._dimension
    
    @property
    def model_name(self) -> str:
        return self._model_name


class EmbeddingCache:
    """Simple in-memory cache for embeddings."""
    
    def __init__(self):
        self._cache = {}
    
    def _compute_hash(self, text: str, model: str) -> str:
        """Compute hash for text + model combination."""
        content = f"{model}:{text}"
        return hashlib.sha256(content.encode()).hexdigest()
    
    def get(self, text: str, model: str) -> Optional[List[float]]:
        """Get cached embedding."""
        key = self._compute_hash(text, model)
        return self._cache.get(key)
    
    def set(self, text: str, model: str, embedding: List[float]):
        """Cache embedding."""
        key = self._compute_hash(text, model)
        self._cache[key] = embedding
    
    def get_batch(
        self, 
        texts: List[str], 
        model: str
    ) -> tuple[List[str], List[List[float]]]:
        """Get cached embeddings for batch.
        
        Returns:
            Tuple of (missed_texts, cached_embeddings)
        """
        missed = []
        cached = []
        
        for text in texts:
            embedding = self.get(text, model)
            if embedding:
                cached.append(embedding)
            else:
                missed.append(text)
        
        return missed, cached
    
    def set_batch(
        self, 
        texts: List[str], 
        model: str, 
        embeddings: List[List[float]]
    ):
        """Cache embeddings for batch."""
        for text, embedding in zip(texts, embeddings):
            self.set(text, model, embedding)


class Embedder:
    """Main embedder class with caching and provider selection."""
    
    def __init__(self, provider: Optional[str] = None):
        self.provider_name = provider or settings.EMBEDDING_PROVIDER
        self._provider = self._create_provider()
        self._cache = EmbeddingCache()
        self._tokenizer = tiktoken.get_encoding("cl100k_base")
    
    def _create_provider(self) -> EmbeddingProvider:
        """Create embedding provider based on configuration."""
        if self.provider_name == "openai":
            return OpenAIEmbedder()
        elif self.provider_name == "cohere":
            return CohereEmbedder()
        elif self.provider_name == "bge":
            return BGEEmbedder()
        else:
            raise ValueError(f"Unknown embedding provider: {self.provider_name}")
    
    def embed(self, texts: List[str], use_cache: bool = True) -> List[List[float]]:
        """Embed texts with optional caching.
        
        Args:
            texts: List of texts to embed
            use_cache: Whether to use caching
            
        Returns:
            List of embedding vectors
        """
        if not texts:
            return []
        
        if not use_cache:
            return self._provider.embed(texts)
        
        # Check cache
        missed_texts, cached_embeddings = self._cache.get_batch(
            texts, self._provider.model_name
        )
        
        if not missed_texts:
            # All cached
            return cached_embeddings
        
        # Embed missed texts
        new_embeddings = self._provider.embed(missed_texts)
        
        # Cache new embeddings
        self._cache.set_batch(missed_texts, self._provider.model_name, new_embeddings)
        
        # Merge results
        result = []
        cached_idx = 0
        missed_idx = 0
        
        for text in texts:
            cached_embedding = self._cache.get(text, self._provider.model_name)
            if cached_embedding in cached_embeddings:
                result.append(cached_embeddings[cached_idx])
                cached_idx += 1
            else:
                result.append(new_embeddings[missed_idx])
                missed_idx += 1
        
        return result
    
    def embed_query(self, text: str) -> List[float]:
        """Embed a single query text.
        
        Args:
            text: Query text
            
        Returns:
            Embedding vector
        """
        embeddings = self.embed([text])
        return embeddings[0] if embeddings else []
    
    def count_tokens(self, text: str) -> int:
        """Count tokens in text.
        
        Args:
            text: Input text
            
        Returns:
            Token count
        """
        return len(self._tokenizer.encode(text))
    
    @property
    def dimension(self) -> int:
        """Get embedding dimension."""
        return self._provider.dimension
    
    @property
    def model_name(self) -> str:
        """Get model name."""
        return self._provider.model_name


# Global embedder instance
embedder = Embedder()
