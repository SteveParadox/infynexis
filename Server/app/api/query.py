"""RAG Query API routes."""
import time
from typing import List, Optional, Dict, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import openai

from app.database.session import get_db
from app.database.models import Query, Answer, Chunk, Document, User
from app.core.auth import get_current_active_user, get_workspace_context, WorkspaceContext
from app.core.audit import AuditAction, EntityType, AuditLogger
from app.ingestion.vector_index import vector_index
from app.ingestion.embedder import embedder
from app.config import settings

router = APIRouter(prefix="/query", tags=["Query"])

# Initialize OpenAI client
openai_client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)


# Schemas
class QueryRequest(BaseModel):
    """Query request schema."""
    workspace_id: UUID
    query: str = Field(..., min_length=1, max_length=2000)
    top_k: int = Field(default=5, ge=1, le=20)
    include_sources: bool = True
    model: str = Field(default="gpt-4o-mini")


class Source(BaseModel):
    """Source chunk schema."""
    chunk_id: str
    document_id: str
    document_title: str
    text: str
    similarity: float


class QueryResponse(BaseModel):
    """Query response schema."""
    query_id: str
    answer: str
    confidence: float
    confidence_factors: Dict[str, float]
    sources: List[Source]
    model_used: str
    tokens_used: int
    response_time_ms: int


class VerificationRequest(BaseModel):
    """Verification request schema."""
    status: str = Field(..., regex="^(approved|rejected)$")
    comment: Optional[str] = Field(None, max_length=1000)


class VerificationResponse(BaseModel):
    """Verification response schema."""
    answer_id: str
    status: str
    verified_by: str
    comment: Optional[str]
    verified_at: str


class FeedbackRequest(BaseModel):
    """Feedback request schema."""
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=1000)


def calculate_confidence(
    similarities: List[float],
    sources: List[Dict[str, Any]],
    answer_text: str
) -> tuple[float, Dict[str, float]]:
    """Calculate confidence score for answer.
    
    Formula:
    - Base: Average similarity of retrieved chunks
    - Bonus: Number of unique documents (diversity)
    - Penalty: Low similarity chunks
    
    Args:
        similarities: List of similarity scores
        sources: List of source documents
        answer_text: Generated answer text
        
    Returns:
        Tuple of (confidence_score, factors_dict)
    """
    if not similarities:
        return 0.0, {"similarity_avg": 0.0, "document_diversity": 0.0, "source_coverage": 0.0}
    
    # Factor 1: Average similarity (0-1)
    similarity_avg = sum(similarities) / len(similarities)
    
    # Factor 2: Document diversity (0-1)
    unique_docs = len(set(s.get("document_id") for s in sources))
    document_diversity = min(unique_docs / 3, 1.0)  # Max bonus at 3+ docs
    
    # Factor 3: Source coverage (0-1)
    # Penalize if top similarity is too low
    top_similarity = max(similarities) if similarities else 0
    source_coverage = 1.0 if top_similarity > 0.7 else top_similarity
    
    # Combined confidence
    # Weights: similarity 50%, diversity 25%, coverage 25%
    confidence = (
        similarity_avg * 0.5 +
        document_diversity * 0.25 +
        source_coverage * 0.25
    )
    
    # Clamp to 0-1
    confidence = max(0.0, min(1.0, confidence))
    
    factors = {
        "similarity_avg": round(similarity_avg, 3),
        "document_diversity": round(document_diversity, 3),
        "source_coverage": round(source_coverage, 3),
        "chunks_retrieved": len(similarities),
        "unique_documents": unique_docs
    }
    
    return round(confidence, 3), factors


@router.post("", response_model=QueryResponse)
async def query(
    query_request: QueryRequest,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Execute RAG query against workspace documents.
    
    Args:
        query_request: Query parameters
        request: FastAPI request object
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Query response with answer and sources
    """
    start_time = time.time()
    
    # Verify workspace membership
    context = await get_workspace_context(
        query_request.workspace_id, current_user, db
    )
    
    # Create query record
    query_record = Query(
        workspace_id=query_request.workspace_id,
        user_id=current_user.id,
        query_text=query_request.query
    )
    db.add(query_record)
    await db.commit()
    await db.refresh(query_record)
    
    # Generate query embedding
    query_vector = embedder.embed_query(query_request.query)
    
    # Search vector index
    search_results = vector_index.search(
        workspace_id=str(query_request.workspace_id),
        query_vector=query_vector,
        limit=query_request.top_k,
        score_threshold=0.5,
        filters={"workspace_id": str(query_request.workspace_id)}
    )
    
    if not search_results:
        # No relevant documents found
        response_time_ms = int((time.time() - start_time) * 1000)
        
        # Create answer record
        answer = Answer(
            query_id=query_record.id,
            workspace_id=query_request.workspace_id,
            answer_text="I couldn't find any relevant information in your documents to answer this question.",
            confidence_score=0.0,
            sources=[],
            model_used=query_request.model,
            tokens_used=0
        )
        db.add(answer)
        await db.commit()
        
        # Log audit
        logger = AuditLogger(db, current_user.id).with_request(request)
        await logger.log_query(
            workspace_id=query_request.workspace_id,
            query=query_request.query,
            result_count=0
        )
        
        return QueryResponse(
            query_id=str(query_record.id),
            answer="I couldn't find any relevant information in your documents to answer this question.",
            confidence=0.0,
            confidence_factors={"similarity_avg": 0.0, "document_diversity": 0.0, "source_coverage": 0.0},
            sources=[],
            model_used=query_request.model,
            tokens_used=0,
            response_time_ms=response_time_ms
        )
    
    # Fetch full chunk texts from database
    sources = []
    chunk_texts = []
    similarities = []
    
    for point in search_results:
        chunk_id = point.payload.get("chunk_id")
        
        # Get chunk from database
        result = await db.execute(
            select(Chunk, Document)
            .join(Document, Chunk.document_id == Document.id)
            .where(Chunk.id == UUID(chunk_id))
        )
        row = result.first()
        
        if row:
            chunk, document = row
            chunk_texts.append(chunk.text)
            similarities.append(point.score)
            
            sources.append(Source(
                chunk_id=str(chunk.id),
                document_id=str(document.id),
                document_title=document.title,
                text=chunk.text[:500] + "..." if len(chunk.text) > 500 else chunk.text,
                similarity=round(point.score, 3)
            ))
    
    # Build context for LLM
    context_text = "\n\n".join([
        f"[Document {i+1}]: {text}"
        for i, text in enumerate(chunk_texts)
    ])
    
    # Generate answer with LLM
    system_prompt = """You are a helpful assistant that answers questions based on the provided documents.
Use only the information from the documents to answer the question.
If the documents don't contain enough information, say so clearly.
Cite the document numbers when referencing specific information."""
    
    user_prompt = f"""Documents:
{context_text}

Question: {query_request.query}

Answer:"""
    
    try:
        llm_response = openai_client.chat.completions.create(
            model=query_request.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3,
            max_tokens=1000
        )
        
        answer_text = llm_response.choices[0].message.content
        tokens_used = llm_response.usage.total_tokens
        
    except Exception as e:
        # Fallback if LLM fails
        answer_text = f"Error generating answer: {str(e)}"
        tokens_used = 0
    
    # Calculate confidence
    source_dicts = [{"document_id": s.document_id} for s in sources]
    confidence, factors = calculate_confidence(similarities, source_dicts, answer_text)
    
    response_time_ms = int((time.time() - start_time) * 1000)
    
    # Update query with response time
    query_record.response_time_ms = response_time_ms
    
    # Create answer record
    answer = Answer(
        query_id=query_record.id,
        workspace_id=query_request.workspace_id,
        answer_text=answer_text,
        confidence_score=confidence,
        sources=[
            {
                "chunk_id": s.chunk_id,
                "document_id": s.document_id,
                "similarity": s.similarity
            }
            for s in sources
        ],
        model_used=query_request.model,
        tokens_used=tokens_used
    )
    db.add(answer)
    await db.commit()
    await db.refresh(answer)
    
    # Log audit
    logger = AuditLogger(db, current_user.id).with_request(request)
    await logger.log(
        action=AuditAction.ANSWER_GENERATED,
        workspace_id=query_request.workspace_id,
        entity_type=EntityType.ANSWER,
        entity_id=answer.id,
        metadata={
            "query_id": str(query_record.id),
            "confidence": confidence,
            "sources_count": len(sources)
        }
    )
    
    return QueryResponse(
        query_id=str(query_record.id),
        answer=answer_text,
        confidence=confidence,
        confidence_factors=factors,
        sources=sources if query_request.include_sources else [],
        model_used=query_request.model,
        tokens_used=tokens_used,
        response_time_ms=response_time_ms
    )


@router.post("/{answer_id}/verify", response_model=VerificationResponse)
async def verify_answer(
    answer_id: UUID,
    verification: VerificationRequest,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Verify or reject an answer.
    
    Args:
        answer_id: Answer UUID
        verification: Verification data
        request: FastAPI request object
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Verification result
    """
    # Get answer
    result = await db.execute(
        select(Answer).where(Answer.id == answer_id)
    )
    answer = result.scalar_one_or_none()
    
    if not answer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Answer not found"
        )
    
    # Verify workspace membership
    context = await get_workspace_context(answer.workspace_id, current_user, db)
    context.require_role(context.role)  # Any member can verify
    
    # Update answer
    answer.verification_status = verification.status
    answer.verified_by = current_user.id
    answer.verified_at = datetime.utcnow()
    answer.verification_comment = verification.comment
    
    await db.commit()
    await db.refresh(answer)
    
    # Log audit
    logger = AuditLogger(db, current_user.id).with_request(request)
    await logger.log_verification(
        workspace_id=answer.workspace_id,
        answer_id=answer_id,
        verified=verification.status == "approved",
        comment=verification.comment
    )
    
    return VerificationResponse(
        answer_id=str(answer_id),
        status=verification.status,
        verified_by=str(current_user.id),
        comment=verification.comment,
        verified_at=answer.verified_at.isoformat()
    )


@router.post("/{answer_id}/feedback")
async def submit_feedback(
    answer_id: UUID,
    feedback: FeedbackRequest,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Submit feedback on an answer.
    
    Args:
        answer_id: Answer UUID
        feedback: Feedback data
        request: FastAPI request object
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Success message
    """
    from app.database.models import Feedback
    
    # Get answer
    result = await db.execute(
        select(Answer).where(Answer.id == answer_id)
    )
    answer = result.scalar_one_or_none()
    
    if not answer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Answer not found"
        )
    
    # Verify workspace membership
    await get_workspace_context(answer.workspace_id, current_user, db)
    
    # Create feedback record
    feedback_record = Feedback(
        answer_id=answer_id,
        workspace_id=answer.workspace_id,
        user_id=current_user.id,
        rating=feedback.rating,
        comment=feedback.comment
    )
    db.add(feedback_record)
    await db.commit()
    
    # Log audit
    logger = AuditLogger(db, current_user.id).with_request(request)
    await logger.log(
        action=AuditAction.FEEDBACK_SUBMITTED,
        workspace_id=answer.workspace_id,
        entity_type=EntityType.ANSWER,
        entity_id=answer_id,
        metadata={
            "rating": feedback.rating,
            "has_comment": feedback.comment is not None
        }
    )
    
    return {
        "message": "Feedback submitted successfully",
        "feedback_id": str(feedback_record.id)
    }


from datetime import datetime
