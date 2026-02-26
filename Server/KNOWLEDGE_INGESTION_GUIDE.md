# Knowledge Ingestion Layer - Implementation Guide

## Overview

The Knowledge Ingestion Layer is a comprehensive, production-ready system for integrating documents from 8 different sources into Anfinity's vector database for semantic search and analysis. This implements a connector-based architecture with async processing, automatic chunking, embedding, and audit logging.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      External Data Sources                          │
│  Notion │ Slack │ Google Drive │ Confluence │ GitHub │ Email │ Etc │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────────┐
│                   Connector Infrastructure                          │
│  BaseConnector (Abstract) → Specific Connector Implementations     │
│  • Authentication & OAuth token mgmt                               │
│  • Async document fetching (async generators)                      │
│  • Pagination & error recovery                                    │
│  • Source metadata preservation                                    │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────────┐
│                 Ingestion Orchestrator Service                      │
│  • Coordinates multi-connector syncs                               │
│  • Progress tracking & audit logging                               │
│  • Error handling & retry logic                                    │
│  • Scheduled/manual syncing                                        │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────────┐
│              Document Processing Pipeline                           │
│  • Smart text chunking (recursive splitting, token boundaries)     │
│  • Multi-provider embedding (OpenAI/Cohere/BGE)                   │
│  • Metadata & context preservation                                 │
│  • Vector storage (Qdrant)                                         │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────────┐
│                   Persistent Storage                                │
│  • PostgreSQL: Documents, chunks, embeddings, ingestion logs       │
│  • Qdrant: Vector search index                                     │
│  • S3-compatible: Raw document files                               │
└─────────────────────────────────────────────────────────────────────┘
```

## Supported Data Sources

### 1. **Notion** (`NotionConnector`)
- **Auth**: API token (Bearer token)
- **Features**: 
  - Page/database fetching
  - Rich text extraction (blocks, nested structures)
  - Property extraction
  - Pagination handling
- **Config**:
  ```json
  {
    "notion_api_version": "2022-06-28"
  }
  ```

### 2. **Slack** (`SlackConnector`)
- **Auth**: OAuth bot token
- **Features**:
  - Channel message history
  - Thread aggregation
  - Configurable lookback period
  - User information preservation
- **Config**:
  ```json
  {
    "lookback_days": 30,
    "channel_ids": ["C123456", "C789012"]
  }
  ```

### 3. **Google Drive** (`GoogleDriveConnector`)
- **Auth**: OAuth credentials (service account or user)
- **Features**:
  - Google Docs export to text
  - PDF/Word/Excel extraction
  - Folder traversal
  - MIME type filtering
- **Config**:
  ```json
  {
    "folder_id": "root",
    "include_mimes": ["application/vnd.google-apps.document", "application/pdf"]
  }
  ```

### 4. **Confluence** (`ConfluenceConnector`)
- **Auth**: API token (Basic auth: email + token)
- **Features**:
  - Space/page navigation
  - HTML to text conversion
  - Metadata extraction
  - Recursive page traversal
- **Config**:
  ```json
  {
    "confluence_url": "https://myorg.atlassian.net",
    "spaces": ["SPACE1", "SPACE2"]
  }
  ```

### 5. **GitHub** (`GitHubConnector`)
- **Auth**: OAuth token or PAT
- **Features**:
  - Issues and pull requests
  - Documentation files
  - Commit history
  - Labels and state tracking
- **Config**:
  ```json
  {
    "repos": ["owner/repo1", "owner/repo2"],
    "include_docs": true,
    "include_issues": true,
    "include_prs": true
  }
  ```

### 6. **Email** (`EmailConnector`)
- **Auth**: IMAP credentials
- **Features**:
  - IMAP folder sync
  - Multi-part email parsing
  - Configurable date range
  - Attachment handling planned
- **Config**:
  ```json
  {
    "imap_server": "imap.gmail.com",
    "folders": ["INBOX", "Archive"],
    "days_back": 30
  }
  ```

### 7. **Meeting Transcripts** (`MeetingTranscriptConnector`)
- **Formats**: VTT, JSON, SRT
- **Features**:
  - Auto-format detection
  - Speaker identification
  - Timestamp preservation
  - Multi-format normalization
- **Supported**: Zoom, Google Meet, Teams, custom formats

### 8. **Web Clips** (Built-in Documents API)
- **Auth**: URL + optional auth header
- **Features**: HTML to text conversion, link preservation

## Connector Implementation Pattern

### Creating a New Connector

```python
from app.connectors.base import BaseConnector, ConnectorType, ConnectorDocument

class CustomConnector(BaseConnector):
    connector_type = ConnectorType.CUSTOM  # Add to ConnectorType enum
    
    def validate_config(self) -> bool:
        """Validate required configuration."""
        required = ["api_key", "base_url"]
        return all(k in self.config for k in required)
    
    async def authenticate(self) -> bool:
        """Verify credentials and connectivity."""
        try:
            # Test API access
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{self.config['base_url']}/test",
                    headers={"Authorization": f"Bearer {self.access_token}"}
                )
                return resp.status_code == 200
        except Exception:
            return False
    
    async def list_documents(self):
        """Fetch all documents via async generator."""
        async with httpx.AsyncClient() as client:
            page = 0
            while True:
                resp = await client.get(
                    f"{self.config['base_url']}/items?page={page}",
                    headers=self._auth_headers()
                )
                
                if resp.status_code != 200:
                    break
                
                items = resp.json().get("items", [])
                if not items:
                    break
                
                for item in items:
                    yield ConnectorDocument(
                        id=item["id"],
                        title=item["title"],
                        content=item["content"],
                        source_type="custom",
                        source_metadata={"item_type": item.get("type")},
                        url=item.get("url"),
                        author=item.get("author"),
                        created_at=item.get("created_at")
                    )
                
                page += 1
    
    async def get_document(self, document_id: str):
        """Fetch a specific document."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.config['base_url']}/items/{document_id}",
                headers=self._auth_headers()
            )
            
            if resp.status_code != 200:
                return None
            
            item = resp.json()
            return ConnectorDocument(...)
    
    def _auth_headers(self) -> dict:
        """Build authentication headers."""
        return {"Authorization": f"Bearer {self.access_token}"}
```

## API Endpoints

### Connector Management

#### Register Connector
```
POST /connectors
Authorization: Bearer {user_jwt}

{
  "workspace_id": "ws_123",
  "connector_type": "notion",
  "access_token": "notion_abc123...",
  "config": {
    "notion_api_version": "2022-06-28"
  }
}

Response:
{
  "id": "conn_456",
  "workspace_id": "ws_123",
  "connector_type": "notion",
  "is_active": true,
  "last_sync_at": null,
  "created_at": "2026-02-25T10:30:00Z"
}
```

#### List Connectors
```
GET /connectors?workspace_id=ws_123&status_filter=active
Authorization: Bearer {user_jwt}

Response:
{
  "total": 3,
  "connectors": [...]
}
```

#### Sync Single Connector
```
POST /connectors/{connector_id}/sync
Authorization: Bearer {user_jwt}

Response:
{
  "status": "started",
  "connector_id": "conn_456",
  "sync_result": {
    "status": "success",
    "documents_processed": 42,
    "chunks_created": 156,
    "embeddings_created": 156,
    "duration_ms": 15234
  }
}
```

#### Sync All Workspace Connectors
```
POST /connectors/workspace/{workspace_id}/sync-all
Authorization: Bearer {user_jwt}

Response:
{
  "status": "completed",
  "workspace_id": "ws_123",
  "sync_result": {
    "connectors_synced": 3,
    "total_documents": 127,
    "duration_ms": 45123,
    "results": [
      {
        "connector_id": "conn_456",
        "connector_type": "notion",
        "status": "success",
        "documents_processed": 42
      },
      ...
    ]
  }
}
```

### Ingestion Status

#### Get Document Status
```
GET /ingestion/status/{document_id}
Authorization: Bearer {user_jwt}

Response:
{
  "document_id": "doc_789",
  "title": "Meeting Notes",
  "source_type": "slack",
  "status": "processed",
  "progress": {
    "chunks_created": 5,
    "embeddings_created": 5,
    "total_tokens": 1542
  },
  "logs": [
    {
      "stage": "chunking",
      "status": "completed",
      "duration_ms": 234,
      "timestamp": "2026-02-25T10:35:00Z"
    },
    {
      "stage": "embedding",
      "status": "completed",
      "duration_ms": 1523,
      "timestamp": "2026-02-25T10:35:02Z"
    }
  ],
  "created_at": "2026-02-25T10:30:00Z"
}
```

#### Get Workspace Ingestion Status
```
GET /ingestion/workspace/{workspace_id}/status
Authorization: Bearer {user_jwt}

Response:
{
  "workspace_id": "ws_123",
  "total_documents": 127,
  "status_breakdown": {
    "processed": 115,
    "processing": 8,
    "failed": 4
  },
  "aggregated_stats": {
    "total_chunks": 892,
    "total_tokens": 234567,
    "recent_activities_24h": 23
  }
}
```

## Configuration Guide

### Environment Variables

```bash
# Embedding Provider Configuration
EMBEDDING_PROVIDER=openai  # Options: openai, cohere, bge
OPENAI_API_KEY=sk_...
COHERE_API_KEY=...

# Vector Database
QDRANT_URL=http://qdrant:6333
QDRANT_API_KEY=...

# Database
DATABASE_URL=postgresql://user:pass@localhost/anfinity
VECTOR_DB_COLLECTION_PREFIX=anfinity_

# Storage
S3_BUCKET=anfinity-documents
S3_ENDPOINT_URL=http://minio:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin

# Application
JWT_SECRET=your_secret_key_here
ENVIRONMENT=production
```

### PostgreSQL Migration

The required tables are already created via SQLAlchemy models:
- `documents` - Document metadata
- `chunks` - Text chunks
- `embeddings` - Vector metadata
- `ingestion_logs` - Processing audit trail
- `connectors` - Connector configuration
- `users` - User accounts
- `workspaces` - Workspace isolation

Run migrations:
```bash
cd Server
alembic upgrade head
```

### Qdrant Setup

Initialize vector collections:
```bash
# Via Qdrant SDK (automatic on first sync)
from qdrant_client import QdrantClient

client = QdrantClient("http://localhost:6333")
client.create_collection(
    collection_name="workspace_123",
    vectors_config=VectorParams(
        size=1536,  # OpenAI embedding size
        distance=Distance.COSINE
    )
)
```

## Usage Examples

### Python Client

```python
import httpx
import asyncio

async def main():
    async with httpx.AsyncClient() as client:
        # Register Notion connector
        response = await client.post(
            "http://localhost:8000/connectors",
            json={
                "workspace_id": "ws_123",
                "connector_type": "notion",
                "access_token": "secret_abc123...",
                "config": {}
            },
            headers={"Authorization": "Bearer <jwt_token>"}
        )
        connector = response.json()
        print(f"Created connector: {connector['id']}")
        
        # Trigger sync
        response = await client.post(
            f"http://localhost:8000/connectors/{connector['id']}/sync",
            headers={"Authorization": "Bearer <jwt_token>"}
        )
        result = response.json()
        print(f"Sync result: {result['sync_result']}")

asyncio.run(main())
```

### JavaScript/TypeScript Client

```typescript
import axios from 'axios';

async function setupIngestion() {
  const client = axios.create({
    baseURL: 'http://localhost:8000',
    headers: {
      'Authorization': `Bearer ${jwtToken}`
    }
  });

  // Register Slack connector
  const connectorRes = await client.post('/connectors', {
    workspace_id: 'ws_123',
    connector_type: 'slack',
    access_token: 'xoxb-...',
    config: {
      lookback_days: 30,
      channel_ids: ['C123456']
    }
  });

  const connectorId = connectorRes.data.id;

  // Start sync
  const syncRes = await client.post(
    `/connectors/${connectorId}/sync`
  );

  // Poll status
  const pollStatus = setInterval(async () => {
    const statusRes = await client.get(
      `/ingestion/status/${syncRes.data.sync_result.documents_processed[0]}`
    );
    console.log('Status:', statusRes.data.status);
    
    if (statusRes.data.status === 'processed') {
      clearInterval(pollStatus);
    }
  }, 5000);
}

setupIngestion();
```

## Performance Considerations

### Chunking Strategy
- **Max chunk size**: 8,192 tokens (configurable)
- **Overlap**: 1,024 tokens for context preservation
- **Strategy**: Recursive splitting (paragraphs → sentences → tokens)

### Embedding Performance
- **Batch size**: 15 embeddings per API call
- **Parallelism**: 5 concurrent workers
- **Caching**: Embedded chunks cached to avoid re-vectoring

### Database Optimization
- Indexes on: `document_id`, `workspace_id`, `source_type`, `status`
- Partitioning: Chunks table partitioned by document_id for large workspaces
- Connection pooling: 10-20 connections per environment

### Scaling Guidelines

| Scale | Connectors | Documents/Day | Chunks | Embeddings/Min |
|-------|-----------|---------------|---------|----------------|
| **Small** (1-5 users) | 2-3 | 50-100 | 500-1K | 100-200 |
| **Medium** (5-50 users) | 5-8 | 500-1K | 5K-10K | 500-1K |
| **Large** (50+ users) | 8+ | 5K-10K | 50K+ | 5K+ |

For large scale, consider:
- Distributed connectors (multiple processes)
- Async queuing (Celery, Bull)
- Vector DB sharding
- Read replicas for PostgreSQL

## Error Handling

### Retry Strategy
- Initial retry delay: 1 second
- Backoff multiplier: 2x
- Max retries: 5
- Max delay: 60 seconds

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Authentication failed` | Invalid token | Refresh OAuth token or rotate API key |
| `Rate limited` | Too many requests | Implement exponential backoff |
| `Document parse error` | Unsupported format | Verify document format, update parser |
| `Vector DB error` | Connection issue | Verify Qdrant connectivity |
| `Embedding error` | API quota | Check embedding provider limits |

## Security Considerations

1. **Token Management**
   - Store tokens encrypted in database
   - Use environment variables for secrets
   - Implement token rotation for OAuth flows
   - Audit token access

2. **Data Privacy**
   - Workspace isolation via foreign keys
   - Row-level security policies
   - Encrypted fields for sensitive metadata
   - GDPR compliance (data retention policies)

3. **API Security**
   - JWT authentication required
   - Rate limiting per user/workspace
   - CORS configuration
   - Request signing for sensitive operations

## Monitoring & Logging

### Key Metrics to Track
- Connector sync duration
- Documents processed per hour
- Chunks created per document
- Embedding generation time
- Error rates by connector type
- Queue depth (pending documents)

### Logging Configuration

```python
# In your logging config
logging.getLogger('app.connectors').setLevel(logging.DEBUG)
logging.getLogger('app.services.ingestion_orchestrator').setLevel(logging.INFO)

# Example log output
2026-02-25 10:35:02 INFO: Starting sync for connector conn_456
2026-02-25 10:35:05 INFO: Listed 42 documents from Notion
2026-02-25 10:35:08 DEBUG: Processing document notion_page_123
2026-02-25 10:35:09 INFO: Created 7 chunks for notion_page_123
2026-02-25 10:35:12 INFO: Completed embedding for 7 chunks
2026-02-25 10:35:15 INFO: Sync completed: 42 docs, 156 chunks, 15234ms
```

## Troubleshooting

### Common Issues

1. **Connectors not syncing**
   - Check `is_active` flag
   - Verify tokens aren't expired
   - Check connector logs in `ingestion_logs` table

2. **Embedding failures**
   - Verify EMBEDDING_PROVIDER setting
   - Check API key validity
   - Review error logs

3. **Missing documents**
   - Verify connector configuration
   - Check pagination logic
   - Review audit logs

4. **Performance degradation**
   - Monitor database connection pool
   - Check Qdrant load
   - Review chunk size settings

## Next Steps

1. Deploy to production with monitoring
2. Set up automated sync schedules
3. Configure backup and recovery procedures
4. Implement cost tracking for embedding providers
5. Build UI for connector management
6. Add more connector types (Slack threads, email attachments, etc.)

---

**Status**: ✅ Production-Ready
- [x] 6 primary connectors implemented
- [x] Orchestrator service with error handling
- [x] API endpoints for management
- [x] Status tracking and monitoring
- [x] Comprehensive logging and audit trail
