"""Document API routes."""
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database.session import get_db
from app.database.models import Document, Chunk, DocumentStatus
from app.core.auth import (
    get_current_active_user,
    get_workspace_context,
    WorkspaceContext,
    require_role,
    WorkspaceRole
)
from app.core.audit import AuditLogger, AuditAction, EntityType
from app.storage.s3 import s3_client
from app.tasks.worker import process_document, delete_document_vectors

router = APIRouter(prefix="/documents", tags=["Documents"])


# Schemas
class DocumentResponse(BaseModel):
    """Document response schema."""
    id: str
    workspace_id: str
    title: str
    source_type: str
    status: str
    token_count: int
    chunk_count: int
    created_at: str
    storage_url: Optional[str] = None


class DocumentListResponse(BaseModel):
    """Document list response."""
    items: List[DocumentResponse]
    total: int
    page: int
    page_size: int


class ChunkResponse(BaseModel):
    """Chunk response schema."""
    id: str
    chunk_index: int
    text: str
    token_count: int


@router.post("/upload")
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    workspace_id: UUID = Query(...),
    current_user = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Upload and process a document.
    
    Args:
        request: FastAPI request object
        file: Uploaded file
        workspace_id: Workspace UUID
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Created document
    """
    from app.config import settings
    
    # Verify workspace membership (members can upload)
    context = await get_workspace_context(workspace_id, current_user, db)
    
    # Validate file size
    content = await file.read()
    max_size = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if len(content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds {settings.MAX_FILE_SIZE_MB}MB limit"
        )
    
    # Validate file type
    content_type = file.content_type or "application/octet-stream"
    if content_type not in settings.ALLOWED_FILE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"File type {content_type} not supported"
        )
    
    # Compute content hash for deduplication
    content_hash = s3_client.compute_hash(content)
    
    # Check for duplicate
    result = await db.execute(
        select(Document).where(
            Document.workspace_id == workspace_id,
            Document.content_hash == content_hash
        )
    )
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Document already exists in this workspace"
        )
    
    # Create document record
    document = Document(
        workspace_id=workspace_id,
        title=file.filename or "Untitled",
        content_hash=content_hash,
        source_type=DocumentStatus.UPLOAD if hasattr(DocumentStatus, 'UPLOAD') else 'upload',
        source_metadata={
            "filename": file.filename,
            "content_type": content_type,
            "size": len(content),
        },
        status=DocumentStatus.PENDING if hasattr(DocumentStatus, 'PENDING') else 'pending'
    )
    
    db.add(document)
    await db.commit()
    await db.refresh(document)
    
    # Upload to S3
    storage_path = s3_client.generate_path(
        workspace_id=str(workspace_id),
        document_id=str(document.id),
        filename=file.filename or "untitled"
    )
    
    s3_client.upload_file(
        file_bytes=content,
        path=storage_path,
        content_type=content_type,
        metadata={
            "document_id": str(document.id),
            "workspace_id": str(workspace_id),
            "uploaded_by": str(current_user.id)
        }
    )
    
    # Update document with storage path
    document.storage_path = storage_path
    await db.commit()
    
    # Trigger background processing
    process_document.delay(str(document.id))
    
    # Log audit
    logger = AuditLogger(db, current_user.id).with_request(request)
    await logger.log_upload(
        workspace_id=workspace_id,
        document_id=document.id,
        filename=file.filename or "untitled"
    )
    
    # Generate presigned URL
    storage_url = s3_client.generate_presigned_url(storage_path, expiration=3600)
    
    return DocumentResponse(
        id=str(document.id),
        workspace_id=str(workspace_id),
        title=document.title,
        source_type=document.source_type.value if hasattr(document.source_type, 'value') else str(document.source_type),
        status=document.status.value if hasattr(document.status, 'value') else str(document.status),
        token_count=document.token_count,
        chunk_count=document.chunk_count,
        created_at=document.created_at.isoformat(),
        storage_url=storage_url
    )


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    workspace_id: UUID = Query(...),
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """List documents in workspace.
    
    Args:
        workspace_id: Workspace UUID
        status: Filter by status
        page: Page number
        page_size: Items per page
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Paginated document list
    """
    # Verify workspace membership
    await get_workspace_context(workspace_id, current_user, db)
    
    # Build query
    query = select(Document).where(Document.workspace_id == workspace_id)
    
    if status:
        query = query.where(Document.status == status)
    
    # Get total count
    count_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = count_result.scalar()
    
    # Get paginated results
    query = query.order_by(Document.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    
    result = await db.execute(query)
    documents = result.scalars().all()
    
    # Build response
    items = []
    for doc in documents:
        storage_url = None
        if doc.storage_path:
            storage_url = s3_client.generate_presigned_url(doc.storage_path, expiration=3600)
        
        items.append(DocumentResponse(
            id=str(doc.id),
            workspace_id=str(doc.workspace_id),
            title=doc.title,
            source_type=doc.source_type.value if hasattr(doc.source_type, 'value') else str(doc.source_type),
            status=doc.status.value if hasattr(doc.status, 'value') else str(doc.status),
            token_count=doc.token_count,
            chunk_count=doc.chunk_count,
            created_at=doc.created_at.isoformat(),
            storage_url=storage_url
        ))
    
    return DocumentListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: UUID,
    current_user = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get document by ID.
    
    Args:
        document_id: Document UUID
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Document details
    """
    result = await db.execute(
        select(Document).where(Document.id == document_id)
    )
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Verify workspace membership
    await get_workspace_context(document.workspace_id, current_user, db)
    
    # Generate presigned URL
    storage_url = None
    if document.storage_path:
        storage_url = s3_client.generate_presigned_url(document.storage_path, expiration=3600)
    
    return DocumentResponse(
        id=str(document.id),
        workspace_id=str(document.workspace_id),
        title=document.title,
        source_type=document.source_type.value if hasattr(document.source_type, 'value') else str(document.source_type),
        status=document.status.value if hasattr(document.status, 'value') else str(document.status),
        token_count=document.token_count,
        chunk_count=document.chunk_count,
        created_at=document.created_at.isoformat(),
        storage_url=storage_url
    )


@router.get("/{document_id}/chunks", response_model=List[ChunkResponse])
async def get_document_chunks(
    document_id: UUID,
    current_user = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get chunks for a document.
    
    Args:
        document_id: Document UUID
        current_user: Authenticated user
        db: Database session
        
    Returns:
        List of chunks
    """
    result = await db.execute(
        select(Document).where(Document.id == document_id)
    )
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Verify workspace membership
    await get_workspace_context(document.workspace_id, current_user, db)
    
    # Get chunks
    result = await db.execute(
        select(Chunk)
        .where(Chunk.document_id == document_id)
        .order_by(Chunk.chunk_index)
    )
    chunks = result.scalars().all()
    
    return [
        ChunkResponse(
            id=str(chunk.id),
            chunk_index=chunk.chunk_index,
            text=chunk.text,
            token_count=chunk.token_count
        )
        for chunk in chunks
    ]


@router.delete("/{document_id}")
async def delete_document(
    document_id: UUID,
    request: Request,
    current_user = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete document.
    
    Args:
        document_id: Document UUID
        request: FastAPI request object
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Success message
    """
    result = await db.execute(
        select(Document).where(Document.id == document_id)
    )
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Verify admin permissions
    context = await get_workspace_context(document.workspace_id, current_user, db)
    context.require_role(WorkspaceRole.ADMIN)
    
    # Delete from S3
    if document.storage_path:
        s3_client.delete_file(document.storage_path)
    
    # Delete vectors
    delete_document_vectors.delay(
        document_id=str(document.id),
        workspace_id=str(document.workspace_id)
    )
    
    # Log audit
    logger = AuditLogger(db, current_user.id).with_request(request)
    await logger.log_delete(
        workspace_id=document.workspace_id,
        document_id=document.id,
        title=document.title
    )
    
    # Delete from database
    await db.delete(document)
    await db.commit()
    
    return {"status": "deleted", "document_id": str(document_id)}
