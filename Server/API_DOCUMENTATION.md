# CogniFlow API Documentation

## Base URL
```
http://localhost:8000  (development)
https://api.cogni-flow.app  (production)
```

## Authentication
All endpoints (except `/auth/register`, `/auth/login`, and `/health`) require authentication using JWT Bearer tokens.

### Headers
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

## Response Format

### Success Response (2xx)
```json
{
  "item": {},
  "items": [],
  "status": "success"
}
```

### Error Response (4xx, 5xx)
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "timestamp": 1708881234.5,
    "metadata": {}
  }
}
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 422 | Request validation failed |
| `AUTHENTICATION_ERROR` | 401 | Authentication required or invalid token |
| `AUTHORIZATION_ERROR` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `INTERNAL_ERROR` | 500+ | Server error |

---

## Authentication Endpoints

### POST /auth/register
Register a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "full_name": "John Doe"
}
```

**Response (201):**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "expires_in": 86400,
  "user": {
    "id": "user-id-uuid",
    "email": "user@example.com",
    "full_name": "John Doe"
  }
}
```

**Errors:**
- `409`: Email already registered

---

### POST /auth/login
Authenticate with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response (200):**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "expires_in": 86400,
  "user": {
    "id": "user-id-uuid",
    "email": "user@example.com",
    "full_name": "John Doe"
  }
}
```

**Errors:**
- `401`: Invalid credentials

---

### POST /auth/refresh
Refresh access token (implement based on requirements).

**Response (200):**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "expires_in": 86400
}
```

---

## Workspace Endpoints

### POST /workspaces
Create a new workspace.

**Request:**
```json
{
  "name": "My Project",
  "description": "Project description"
}
```

**Response (201):**
```json
{
  "id": "workspace-uuid",
  "name": "My Project",
  "description": "Project description",
  "owner_id": "user-uuid",
  "created_at": "2024-02-20T10:00:00Z",
  "updated_at": null,
  "member_count": 1
}
```

---

### GET /workspaces
List user's workspaces.

**Query Parameters:**
- `skip`: int (default: 0)
- `limit`: int (default: 10, max: 100)

**Response (200):**
```json
[
  {
    "id": "workspace-uuid",
    "name": "My Project",
    "description": "Project description",
    "owner_id": "user-uuid",
    "created_at": "2024-02-20T10:00:00Z",
    "member_count": 1
  }
]
```

---

### GET /workspaces/{workspace_id}
Get workspace details.

**Response (200):**
```json
{
  "id": "workspace-uuid",
  "name": "My Project",
  "description": "Project description",
  "owner_id": "user-uuid",
  "created_at": "2024-02-20T10:00:00Z",
  "updated_at": null,
  "member_count": 1
}
```

---

### PATCH /workspaces/{workspace_id}
Update workspace.

**Request:**
```json
{
  "name": "Updated Project Name",
  "description": "Updated description",
  "settings": {}
}
```

**Response (200):**
```json
{
  "id": "workspace-uuid",
  "name": "Updated Project Name",
  "description": "Updated description",
  "owner_id": "user-uuid",
  "created_at": "2024-02-20T10:00:00Z",
  "updated_at": "2024-02-20T11:00:00Z",
  "member_count": 1
}
```

---

### GET /workspaces/{workspace_id}/stats
Get workspace statistics.

**Response (200):**
```json
{
  "documents": {
    "total": 50,
    "indexed": 45,
    "processing": 5
  },
  "vectors": 1250
}
```

---

## Document Endpoints

### POST /documents/upload
Upload a document for indexing.

**Request:** multipart/form-data
- `file`: File (required)
- `workspace_id`: UUID (required)

**Response (201):**
```json
{
  "id": "document-uuid",
  "workspace_id": "workspace-uuid",
  "title": "document.pdf",
  "source_type": "pdf",
  "status": "pending",
  "token_count": 0,
  "chunk_count": 0,
  "created_at": "2024-02-20T10:00:00Z"
}
```

**Errors:**
- `413`: File too large (max 50MB)
- `415`: Unsupported file type

---

### GET /documents
List workspace documents.

**Query Parameters:**
- `workspace_id`: UUID (required)
- `status`: pending|processing|indexed|failed (optional)
- `page`: int (default: 1)
- `page_size`: int (default: 10, max: 100)

**Response (200):**
```json
{
  "items": [
    {
      "id": "document-uuid",
      "workspace_id": "workspace-uuid",
      "title": "document.pdf",
      "source_type": "pdf",
      "status": "indexed",
      "token_count": 5000,
      "chunk_count": 25,
      "created_at": "2024-02-20T10:00:00Z",
      "updated_at": "2024-02-20T10:30:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 10
}
```

---

### GET /documents/{document_id}
Get document details.

**Response (200):**
```json
{
  "id": "document-uuid",
  "workspace_id": "workspace-uuid",
  "title": "document.pdf",
  "source_type": "pdf",
  "status": "indexed",
  "token_count": 5000,
  "chunk_count": 25,
  "storage_url": "s3://bucket/path/to/document.pdf",
  "created_at": "2024-02-20T10:00:00Z",
  "updated_at": "2024-02-20T10:30:00Z"
}
```

---

### DELETE /documents/{document_id}
Delete a document.

**Response (204):** No content

---

## Search Endpoints

### POST /search
Search across documents in a workspace.

**Query Parameters:**
- `workspace_id`: UUID (required)

**Request:**
```json
{
  "query": "What is machine learning?",
  "limit": 10,
  "score_threshold": 0.5,
  "filters": {}
}
```

**Response (200):**
```json
{
  "query": "What is machine learning?",
  "results": [
    {
      "chunk_id": "chunk-uuid",
      "document_id": "document-uuid",
      "workspace_id": "workspace-uuid",
      "score": 0.92,
      "text": "Machine learning is a branch of artificial intelligence...",
      "text_preview": "Machine learning is a branch of AI...",
      "chunk_index": 0,
      "source_type": "pdf",
      "metadata": {},
      "created_at": "2024-02-20T10:00:00Z"
    }
  ],
  "total": 5,
  "took_ms": 245
}
```

---

## Query (RAG) Endpoints

### POST /query
Ask a question and get AI-generated answer with sources.

**Request:**
```json
{
  "workspace_id": "workspace-uuid",
  "query": "What is machine learning?",
  "top_k": 5,
  "include_sources": true,
  "model": "gpt-4o-mini"
}
```

**Response (200):**
```json
{
  "query_id": "query-uuid",
  "answer": "Machine learning is a subset of artificial intelligence...",
  "confidence": 0.87,
  "confidence_factors": {
    "similarity_avg": 0.85,
    "document_diversity": 0.9,
    "source_coverage": 0.85
  },
  "sources": [
    {
      "chunk_id": "chunk-uuid",
      "document_id": "document-uuid",
      "document_title": "ML Fundamentals",
      "text": "Machine learning is a branch of AI...",
      "similarity": 0.92
    }
  ],
  "model_used": "gpt-4o-mini",
  "tokens_used": 425,
  "response_time_ms": 3200
}
```

---

## Audit Log Endpoints

### GET /audit/workspace/{workspace_id}
Get audit logs for a workspace.

**Query Parameters:**
- `action`: string (optional)
- `entity_type`: string (optional)
- `start_date`: datetime (optional)
- `end_date`: datetime (optional)
- `limit`: int (default: 100, max: 500)
- `offset`: int (default: 0)

**Response (200):**
```json
{
  "items": [
    {
      "id": "log-uuid",
      "action": "DOCUMENT_UPLOADED",
      "entity_type": "document",
      "entity_id": "document-uuid",
      "user_id": "user-uuid",
      "metadata": {"title": "document.pdf"},
      "ip_address": "192.168.1.1",
      "created_at": "2024-02-20T10:00:00Z"
    }
  ],
  "total": 50
}
```

---

## Knowledge Graph Endpoints

### GET /knowledge-graph
Get knowledge graph for a workspace.

**Query Parameters:**
- `workspace_id`: UUID (required)

**Response (200):**
```json
{
  "nodes": [
    {
      "id": "node-id",
      "type": "document|concept|tag",
      "label": "Node Label",
      "value": 5,
      "metadata": {}
    }
  ],
  "edges": [
    {
      "source": "node-1",
      "target": "node-2",
      "type": "contains|mentions|relates_to",
      "weight": 0.85
    }
  ],
  "stats": {
    "node_count": 125,
    "edge_count": 350,
    "clusters": 5
  }
}
```

---

## Health Check

### GET /health
Health check endpoint (no auth required).

**Response (200):**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "environment": "production"
}
```

---

## Rate Limiting

All endpoints are rate limited to 100 requests per 60 seconds per IP.

**Rate Limit Headers:**
- `X-RateLimit-Limit`: 100
- `X-RateLimit-Remaining`: 95
- `X-RateLimit-Reset`: 1708881294

**Error (429):**
```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded - please try again later",
    "timestamp": 1708881234.5
  }
}
```

---

## Pagination

List endpoints support pagination using `page` and `page_size` query parameters.

**Query:**
```
GET /documents?workspace_id=x&page=2&page_size=20
```

**Response:**
```json
{
  "items": [...],
  "total": 150,
  "page": 2,
  "page_size": 20
}
```

---

## SDK/Client Usage

### JavaScript/TypeScript
```typescript
import { api } from '@/lib/api';

// Login
const token = await api.login({
  email: 'user@example.com',
  password: 'password'
});
api.setToken(token.access_token);

// Create workspace
const workspace = await api.createWorkspace({
  name: 'My Project'
});

// Upload document
const document = await api.uploadDocument(file, workspace.id);

// Search
const results = await api.search('query text', workspace.id);

// Ask question
import { Query } from '@/types';
// Additional endpoints as needed
```

---

## Environment Variables

See `.env.example` for full configuration options.

Key variables:
- `JWT_SECRET`: Secret key for JWT tokens
- `DATABASE_URL`: PostgreSQL connection string
- `QDRANT_URL`: Vector database URL
- `OPENAI_API_KEY`: OpenAI API key
- `S3_ENDPOINT_URL`: S3/MinIO endpoint
