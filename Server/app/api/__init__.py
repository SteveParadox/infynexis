"""API routes module."""
from app.api import auth, workspaces, documents, query, knowledge_graph, audit

__all__ = [
    "auth",
    "workspaces",
    "documents",
    "query",
    "knowledge_graph",
    "audit",
]
