"""Celery worker configuration and tasks."""
import time
from datetime import datetime
from typing import Optional
from uuid import UUID

from celery import Celery
from celery.signals import task_prerun, task_postrun

from app.config import settings
from app.database.session import SyncSessionLocal
from app.database.models import (
    Document, Chunk, Embedding, IngestionLog,
    DocumentStatus, SourceType
)
from app.storage.s3 import s3_client
from app.ingestion.parsers import get_parser
from app.ingestion.chunker import chunker
from app.ingestion.embedder import embedder
from app.ingestion.vector_index import vector_index

# Create Celery app
celery_app = Celery(
    'cogniflow',
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=['app.tasks.worker']
)

# Celery configuration
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=100,
)


from celery.signals import task_prerun, task_postrun

@task_prerun.connect
def task_prerun_handler(sender=None, task_id=None, task=None, args=None, kwargs=None, **other_kwargs):
    """Handle task start."""
    print(f"Starting task {task.name}[{task_id}]")

@task_postrun.connect
def task_postrun_handler(sender=None, task_id=None, task=None, args=None, kwargs=None, retval=None, state=None, **other_kwargs):
    """Handle task completion."""
    print(f"Task {task.name}[{task_id}] finished with state {state}")

def log_ingestion_event(
    db,
    document_id: UUID,
    status: DocumentStatus,
    stage: Optional[str] = None,
    message: Optional[str] = None,
    error_message: Optional[str] = None,
    duration_ms: Optional[int] = None
):
    """Log ingestion event."""
    log = IngestionLog(
        document_id=document_id,
        status=status,
        stage=stage,
        message=message,
        error_message=error_message,
        duration_ms=duration_ms
    )
    db.add(log)
    db.commit()


@celery_app.task(bind=True, max_retries=3)
def process_document(self, document_id: str):
    """Process document through full ingestion pipeline.
    
    Pipeline stages:
    1. Download from S3
    2. Parse document
    3. Chunk text
    4. Generate embeddings
    5. Index vectors
    6. Update document status
    
    Args:
        document_id: Document UUID
    """
    document_uuid = UUID(document_id)
    db = SyncSessionLocal()
    start_time = time.time()
    
    try:
        # Get document
        document = db.query(Document).filter(Document.id == document_uuid).first()
        if not document:
            raise ValueError(f"Document {document_id} not found")
        
        # Update status to processing
        document.status = DocumentStatus.PROCESSING
        db.commit()
        
        log_ingestion_event(
            db, document_uuid, DocumentStatus.PROCESSING,
            stage="started", message="Document processing started"
        )
        
        # Stage 1: Download from S3
        stage_start = time.time()
        file_bytes = s3_client.download_file(document.storage_path)
        download_duration = int((time.time() - stage_start) * 1000)
        
        log_ingestion_event(
            db, document_uuid, DocumentStatus.PROCESSING,
            stage="download", message=f"Downloaded {len(file_bytes)} bytes",
            duration_ms=download_duration
        )
        
        # Stage 2: Parse document
        stage_start = time.time()
        parser = get_parser(document.source_metadata.get('content_type', 'text/plain'))
        parsed = parser.parse(file_bytes)
        parse_duration = int((time.time() - stage_start) * 1000)
        
        # Update document with parsed info
        document.title = parsed.title or document.title
        document.token_count = chunker.count_tokens(parsed.text)
        db.commit()
        
        log_ingestion_event(
            db, document_uuid, DocumentStatus.PROCESSING,
            stage="parse", message=f"Parsed {parsed.word_count} words",
            duration_ms=parse_duration
        )
        
        # Stage 3: Chunk text
        stage_start = time.time()
        chunks = chunker.chunk_text(
            parsed.text,
            metadata={
                'document_id': str(document_id),
                'source_type': document.source_type.value,
                **parsed.metadata
            }
        )
        chunk_duration = int((time.time() - stage_start) * 1000)
        
        log_ingestion_event(
            db, document_uuid, DocumentStatus.PROCESSING,
            stage="chunk", message=f"Created {len(chunks)} chunks",
            duration_ms=chunk_duration
        )
        
        # Save chunks to database
        db_chunks = []
        for chunk in chunks:
            db_chunk = Chunk(
                document_id=document_uuid,
                chunk_index=chunk.index,
                text=chunk.text,
                token_count=chunk.token_count,
                context_before=chunk.context_before,
                context_after=chunk.context_after,
                metadata=chunk.metadata
            )
            db.add(db_chunk)
            db_chunks.append(db_chunk)
        
        db.commit()
        document.chunk_count = len(chunks)
        
        # Stage 4: Generate embeddings
        stage_start = time.time()
        chunk_texts = [chunk.text for chunk in chunks]
        embeddings = embedder.embed(chunk_texts)
        embed_duration = int((time.time() - stage_start) * 1000)
        
        log_ingestion_event(
            db, document_uuid, DocumentStatus.PROCESSING,
            stage="embed", message=f"Generated {len(embeddings)} embeddings",
            duration_ms=embed_duration
        )
        
        # Stage 5: Index vectors
        stage_start = time.time()
        
        # Prepare payloads
        payloads = []
        for i, chunk in enumerate(chunks):
            payload = {
                'document_id': str(document_id),
                'chunk_id': str(db_chunks[i].id),
                'workspace_id': str(document.workspace_id),
                'source_type': document.source_type.value,
                'text_preview': chunk.text[:200],
                'chunk_index': chunk.index,
                'created_at': datetime.utcnow().isoformat(),
            }
            payloads.append(payload)
        
        # Upsert to vector index
        vector_ids = vector_index.upsert_vectors(
            workspace_id=str(document.workspace_id),
            vectors=embeddings,
            payloads=payloads
        )
        
        # Save embedding records
        for i, (db_chunk, vector_id) in enumerate(zip(db_chunks, vector_ids)):
            embedding = Embedding(
                chunk_id=db_chunk.id,
                vector_id=vector_id,
                collection_name=vector_index._get_collection_name(str(document.workspace_id)),
                model_used=embedder.model_name,
                embedding_dimension=embedder.dimension
            )
            db.add(embedding)
        
        index_duration = int((time.time() - stage_start) * 1000)
        
        log_ingestion_event(
            db, document_uuid, DocumentStatus.INDEXED,
            stage="index", message=f"Indexed {len(vector_ids)} vectors",
            duration_ms=index_duration
        )
        
        # Update document status
        document.status = DocumentStatus.INDEXED
        document.processed_at = datetime.utcnow()
        db.commit()
        
        total_duration = int((time.time() - start_time) * 1000)
        log_ingestion_event(
            db, document_uuid, DocumentStatus.INDEXED,
            stage="complete", message=f"Processing complete in {total_duration}ms",
            duration_ms=total_duration
        )
        
        return {
            'status': 'success',
            'document_id': document_id,
            'chunks_created': len(chunks),
            'vectors_indexed': len(vector_ids),
            'total_duration_ms': total_duration
        }
        
    except Exception as exc:
        # Update document status to failed
        if document:
            document.status = DocumentStatus.FAILED
            db.commit()
        
        error_msg = str(exc)
        log_ingestion_event(
            db, document_uuid, DocumentStatus.FAILED,
            stage="error", error_message=error_msg
        )
        
        # Retry on certain errors
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))
        
        return {
            'status': 'failed',
            'document_id': document_id,
            'error': error_msg
        }
        
    finally:
        db.close()


@celery_app.task
def delete_document_vectors(document_id: str, workspace_id: str):
    """Delete document vectors from index.
    
    Args:
        document_id: Document UUID
        workspace_id: Workspace UUID
    """
    # Delete by filter
    vector_index.delete_by_filter(
        workspace_id=workspace_id,
        filters={'document_id': document_id}
    )
    
    return {
        'status': 'success',
        'document_id': document_id,
        'message': 'Vectors deleted'
    }


@celery_app.task
def sync_connector(connector_id: str):
    """Sync external connector.
    
    Args:
        connector_id: Connector UUID
    """
    # TODO: Implement connector sync
    # This would fetch documents from external sources
    # and enqueue them for processing
    
    return {
        'status': 'success',
        'connector_id': connector_id,
        'message': 'Sync started'
    }


# Scheduled tasks
@celery_app.on_after_configure.connect
def setup_periodic_tasks(sender, **kwargs):
    """Setup periodic tasks."""
    # Sync all active connectors every hour
    sender.add_periodic_task(
        3600.0,  # 1 hour
        sync_all_connectors.s(),
        name='sync-all-connectors'
    )


@celery_app.task
def sync_all_connectors():
    """Sync all active connectors."""
    db = SyncSessionLocal()
    
    try:
        from app.database.models import Connector
        
        connectors = db.query(Connector).filter(
            Connector.is_active == 1
        ).all()
        
        for connector in connectors:
            sync_connector.delay(str(connector.id))
        
        return {
            'status': 'success',
            'connectors_queued': len(connectors)
        }
        
    finally:
        db.close()
