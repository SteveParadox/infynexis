"""Application configuration using Pydantic Settings."""
from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Application
    APP_NAME: str = "CogniFlow API"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = Field(default=False)
    
    # Security
    JWT_SECRET: str = Field(default="")  # MUST be set in production via env
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24
    
    # CORS - configure for production
    CORS_ORIGINS: list = Field(default=["http://localhost:3000", "http://localhost:5173"])
    CORS_CREDENTIALS: bool = True
    CORS_METHODS: list = Field(default=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
    CORS_HEADERS: list = Field(default=["*"])
    
    # Database
    DATABASE_URL: str = Field(default="postgresql://postgres:postgres@localhost:5432/cogniflow")
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10
    
    # Redis
    REDIS_URL: str = Field(default="redis://localhost:6379/0")
    
    # Qdrant Vector DB
    QDRANT_URL: str = Field(default="http://localhost:6333")
    QDRANT_API_KEY: Optional[str] = None
    QDRANT_COLLECTION_PREFIX: str = "cogniflow"
    
    # S3 Storage
    AWS_ACCESS_KEY_ID: str = Field(default="minioadmin")
    AWS_SECRET_ACCESS_KEY: str = Field(default="minioadmin")
    S3_ENDPOINT_URL: Optional[str] = Field(default="http://localhost:9000")
    S3_BUCKET_NAME: str = Field(default="cogniflow")
    S3_REGION: str = Field(default="us-east-1")
    
    # Embeddings
    EMBEDDING_PROVIDER: str = Field(default="openai")  # openai, cohere, bge
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"
    COHERE_API_KEY: Optional[str] = None
    COHERE_EMBEDDING_MODEL: str = "embed-english-v3.0"
    BGE_MODEL_NAME: str = "BAAI/bge-small-en-v1.5"
    EMBEDDING_DIMENSION: int = 1536  # Depends on model
    EMBEDDING_BATCH_SIZE: int = 100
    
    # Chunking
    CHUNK_SIZE: int = 512
    CHUNK_OVERLAP: int = 100
    CHUNK_MAX_TOKENS: int = 800
    
    # Connectors
    SLACK_CLIENT_ID: Optional[str] = None
    SLACK_CLIENT_SECRET: Optional[str] = None
    NOTION_CLIENT_ID: Optional[str] = None
    NOTION_CLIENT_SECRET: Optional[str] = None
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GITHUB_CLIENT_ID: Optional[str] = None
    GITHUB_CLIENT_SECRET: Optional[str] = None
    
    # Rate Limiting
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 60
    
    # File Upload
    MAX_FILE_SIZE_MB: int = 50
    ALLOWED_FILE_TYPES: list = Field(default=[
        "application/pdf",
        "text/plain",
        "text/markdown",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ])
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        


# Global settings instance
settings = Settings()
