"""FastAPI main application."""
from contextlib import asynccontextmanager
from typing import Optional
import time
import logging

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.config import settings
from app.database.session import init_db
from app.api import auth, workspaces, documents, query, knowledge_graph, audit, connectors, ingestion
from app.middleware.logging import RequestLoggingMiddleware

# Setup logging
logger = logging.getLogger(__name__)

# Validate critical settings
if settings.ENVIRONMENT == "production":
    if not settings.JWT_SECRET or settings.JWT_SECRET == "":
        raise ValueError("JWT_SECRET must be set in production environment")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION} in {settings.ENVIRONMENT} mode")
    await init_db()
    yield
    # Shutdown
    logger.info("Shutting down gracefully")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-Powered Knowledge Operating System API",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# CORS middleware - configured from environment
cors_origins = list(settings.CORS_ORIGINS) if settings.CORS_ORIGINS else []
if settings.ENVIRONMENT == "development":
    # Add localhost variants for development
    cors_origins.extend(["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"])
    cors_origins = list(set(cors_origins))  # Remove duplicates

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=settings.CORS_CREDENTIALS,
    allow_methods=settings.CORS_METHODS,
    allow_headers=settings.CORS_HEADERS,
)

# Request logging middleware
app.add_middleware(RequestLoggingMiddleware)


# Standardized error response models
class ErrorResponse(JSONResponse):
    """Standard error response."""
    def __init__(self, status_code: int, detail: str, code: str = "INTERNAL_ERROR", metadata: dict = None):
        content = {
            "error": {
                "code": code,
                "message": detail,
                "timestamp": time.time(),
            }
        }
        if metadata:
            content["error"]["metadata"] = metadata
        super().__init__(status_code=status_code, content=content)


# Exception handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle request validation errors."""
    logger.warning(f"Validation error on {request.method} {request.url.path}: {exc}")
    return ErrorResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail="Request validation failed",
        code="VALIDATION_ERROR",
        metadata={"errors": [{"field": str(err["loc"]), "message": err["msg"]} for err in exc.errors()]}
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler."""
    logger.error(f"Unhandled exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    
    # Don't expose error details in production
    detail = str(exc) if settings.DEBUG else "Internal server error"
    return ErrorResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=detail,
        code="INTERNAL_ERROR"
    )


# Include routers
app.include_router(auth.router)
app.include_router(workspaces.router)
app.include_router(documents.router)
app.include_router(query.router)
app.include_router(knowledge_graph.router)
app.include_router(audit.router)
app.include_router(connectors.router)
app.include_router(ingestion.router)


# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT
    }


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
