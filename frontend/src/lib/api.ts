"""API client for CogniFlow backend."""

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Types
export interface Document {
  id: string;
  workspace_id: string;
  title: string;
  source_type: string;
  source_metadata: Record<string, any>;
  storage_url?: string;
  status: 'pending' | 'processing' | 'indexed' | 'failed';
  token_count: number;
  chunk_count: number;
  processed_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface Note {
  id: string;
  workspace_id?: string;
  user_id: string;
  title: string;
  content: string;
  summary?: string;
  tags: string[];
  connections: string[];
  ai_generated: boolean;
  confidence_score?: number;
  source_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  settings: Record<string, any>;
  created_at: string;
  updated_at?: string;
}

export interface SearchResult {
  chunk_id: string;
  document_id: string;
  workspace_id: string;
  score: number;
  text: string;
  text_preview: string;
  chunk_index: number;
  source_type: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  total: number;
  took_ms: number;
}

// API Client
class ApiClient {
  private baseUrl: string;
  private token: string | null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.token = localStorage.getItem('token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth
  setToken(token: string) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('token');
  }

  // Health
  async health(): Promise<{ status: string; version: string }> {
    return this.request('/health');
  }

  // Documents
  async uploadDocument(
    file: File,
    workspaceId: string
  ): Promise<Document> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(
      `${this.baseUrl}/documents/upload?workspace_id=${workspaceId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(error.detail);
    }

    return response.json();
  }

  async listDocuments(
    workspaceId: string,
    params?: { status?: string; page?: number; page_size?: number }
  ): Promise<{ items: Document[]; total: number; page: number; page_size: number }> {
    const queryParams = new URLSearchParams({ workspace_id: workspaceId });
    if (params?.status) queryParams.append('status', params.status);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.page_size) queryParams.append('page_size', params.page_size.toString());
    
    return this.request(`/documents?${queryParams}`);
  }

  async getDocument(documentId: string): Promise<Document> {
    return this.request(`/documents/${documentId}`);
  }

  async deleteDocument(documentId: string): Promise<void> {
    await this.request(`/documents/${documentId}`, { method: 'DELETE' });
  }

  // Notes
  async createNote(note: {
    title: string;
    content: string;
    workspace_id?: string;
    tags?: string[];
    source_url?: string;
  }): Promise<Note> {
    return this.request('/notes', {
      method: 'POST',
      body: JSON.stringify(note),
    });
  }

  async listNotes(params?: {
    workspace_id?: string;
    search?: string;
    tags?: string[];
    page?: number;
    page_size?: number;
  }): Promise<{ items: Note[]; total: number; page: number; page_size: number }> {
    const queryParams = new URLSearchParams();
    if (params?.workspace_id) queryParams.append('workspace_id', params.workspace_id);
    if (params?.search) queryParams.append('search', params.search);
    if (params?.tags) params.tags.forEach(tag => queryParams.append('tags', tag));
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.page_size) queryParams.append('page_size', params.page_size.toString());
    
    return this.request(`/notes?${queryParams}`);
  }

  async getNote(noteId: string): Promise<Note> {
    return this.request(`/notes/${noteId}`);
  }

  async updateNote(
    noteId: string,
    updates: Partial<{
      title: string;
      content: string;
      tags: string[];
      connections: string[];
    }>
  ): Promise<Note> {
    return this.request(`/notes/${noteId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteNote(noteId: string): Promise<void> {
    await this.request(`/notes/${noteId}`, { method: 'DELETE' });
  }

  // Workspaces
  async createWorkspace(workspace: { name: string; description?: string }): Promise<Workspace> {
    return this.request('/workspaces', {
      method: 'POST',
      body: JSON.stringify(workspace),
    });
  }

  async listWorkspaces(): Promise<Workspace[]> {
    return this.request('/workspaces');
  }

  async getWorkspace(workspaceId: string): Promise<Workspace> {
    return this.request(`/workspaces/${workspaceId}`);
  }

  async updateWorkspace(
    workspaceId: string,
    updates: Partial<{ name: string; description: string; settings: Record<string, any> }>
  ): Promise<Workspace> {
    return this.request(`/workspaces/${workspaceId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  // Search
  async search(
    query: string,
    workspaceId: string,
    options?: {
      limit?: number;
      score_threshold?: number;
      filters?: Record<string, any>;
    }
  ): Promise<SearchResponse> {
    return this.request(`/search?workspace_id=${workspaceId}`, {
      method: 'POST',
      body: JSON.stringify({
        query,
        limit: options?.limit || 10,
        score_threshold: options?.score_threshold,
        filters: options?.filters || {},
      }),
    });
  }

  // Stats
  async getWorkspaceStats(workspaceId: string): Promise<{
    documents: { total: number; indexed: number; processing: number };
    vectors: number;
  }> {
    return this.request(`/workspaces/${workspaceId}/stats`);
  }
}

// Export singleton instance
export const api = new ApiClient();

// React hook for API
export function useApi() {
  return api;
}
