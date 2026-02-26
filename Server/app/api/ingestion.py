"""Ingestion status tracking API endpoints."""
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.database.models import Document, IngestionLog, Chunk, Embedding, User, Workspace
from app.database.session import get_db
from app.core.auth import get_current_user
from app.schemas.search import SearchResponse

router = APIRouter(prefix="/ingestion", tags=["ingestion"])


class IngestionStatusResponse:
    """Ingestion status details."""
    
    def __init__(self, document: Document, db: Session):
        self.document = document
        self.db = db
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        logs = self.db.query(IngestionLog).filter(
            IngestionLog.document_id == self.document.id
        ).order_by(IngestionLog.timestamp.desc()).all()
        
        chunks = self.db.query(Chunk).filter(
            Chunk.document_id == self.document.id
        ).all()
        
        embeddings = self.db.query(Embedding).filter(
            Embedding.chunk_id.in_([c.id for c in chunks])
        ).count() if chunks else 0
        
        return {
            "document_id": str(self.document.id),
            "title": self.document.title,
            "source_type": self.document.source_type,
            "status": self.document.status,
            "progress": {
                "chunks_created": len(chunks),
                "embeddings_created": embeddings,
                "total_tokens": self.document.token_count or 0
            },
            "logs": [
                {
                    "stage": log.stage,
                    "status": log.status,
                    "duration_ms": log.duration_ms,
                    "timestamp": log.timestamp.isoformat()
                }
                for log in logs
            ],
            "created_at": self.document.created_at.isoformat(),
            "updated_at": self.document.updated_at.isoformat() if self.document.updated_at else None
        }


@router.get("/status/{document_id}", response_model=Dict[str, Any])
async def get_ingestion_status(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get ingestion status for a document."""
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.owner_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    status_response = IngestionStatusResponse(document, db)
    return status_response.to_dict()


@router.get("/workspace/{workspace_id}/status", response_model=Dict[str, Any])
async def get_workspace_ingestion_status(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    status_filter: Optional[str] = None
) -> Dict[str, Any]:
    """Get overall ingestion status for a workspace."""
    # Verify workspace access
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.owner_id == current_user.id
    ).first()
    
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Workspace not found or access denied"
        )
    
    # Query documents
    query = db.query(Document).filter(
        Document.workspace_id == workspace_id
    )
    
    if status_filter:
        query = query.filter(Document.status == status_filter)
    
    documents = query.all()
    
    # Build statistics
    total_documents = len(documents)
    status_breakdown = {}
    total_chunks = 0
    total_tokens = 0
    
    for doc in documents:
        status = doc.status
        status_breakdown[status] = status_breakdown.get(status, 0) + 1
        
        chunks = db.query(Chunk).filter(Chunk.document_id == doc.id).count()
        total_chunks += chunks
        total_tokens += doc.token_count or 0
    
    # Get recent logs
    recent_logs = db.query(IngestionLog).filter(
        IngestionLog.created_at >= datetime.utcnow() - timedelta(hours=24)
    ).count()
    
    return {
        "workspace_id": workspace_id,
        "total_documents": total_documents,
        "status_breakdown": status_breakdown,
        "aggregated_stats": {
            "total_chunks": total_chunks,
            "total_tokens": total_tokens,
            "recent_activities_24h": recent_logs
        },
        "document_statuses": [
            IngestionStatusResponse(doc, db).to_dict()
            for doc in documents[:10]  # Return first 10 for quick overview
        ]
    }


@router.post("/documents/{document_id}/retry", response_model=Dict[str, Any])
async def retry_ingestion(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Retry ingestion for a failed document."""
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.owner_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    if document.status != "failed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document is not in failed state"
        )
    
    # Reset document status
    document.status = "processing"
    db.commit()
    
    return {
        "status": "retry_started",
        "document_id": document_id,
        "new_status": "processing"
    }


@router.get("/logs/{document_id}", response_model=List[Dict[str, Any]])
async def get_ingestion_logs(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    stage_filter: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Get detailed ingestion logs for a document."""
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.owner_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    query = db.query(IngestionLog).filter(
        IngestionLog.document_id == document_id
    )
    
    if stage_filter:
        query = query.filter(IngestionLog.stage == stage_filter)
    
    logs = query.order_by(IngestionLog.timestamp.desc()).all()
    
    return [
        {
            "stage": log.stage,
            "status": log.status,
            "duration_ms": log.duration_ms,
            "timestamp": log.timestamp.isoformat(),
            "metadata": log.metadata or {}
        }
        for log in logs
    ]
