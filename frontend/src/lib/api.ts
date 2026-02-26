/**
 * Production-ready API Client for CogniFlow
 * Includes retry logic, timeout handling, error management, and request logging
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const API_TIMEOUT = parseInt(import.meta.env.VITE_API_TIMEOUT || '30000'); // 30 seconds
const MAX_RETRIES = parseInt(import.meta.env.VITE_API_MAX_RETRIES || '3');
const RETRY_DELAY = parseInt(import.meta.env.VITE_API_RETRY_DELAY || '1000'); // ms

// Error Types
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: Record<string, any>) {
    super(422, 'VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication required') {
    super(401, 'AUTHENTICATION_ERROR', message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends ApiError {
  constructor(message: string = 'Insufficient permissions') {
    super(403, 'AUTHORIZATION_ERROR', message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string = 'Resource not found') {
    super(404, 'NOT_FOUND', message);
    this.name = 'NotFoundError';
  }
}

export class ServerError extends ApiError {
  constructor(message: string = 'Internal server error') {
    super(500, 'INTERNAL_ERROR', message);
    this.name = 'ServerError';
  }
}

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

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: {
    id: string;
    email: string;
    full_name?: string;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// Request/Response Logging
class RequestLogger {
  private logs: Array<{
    timestamp: number;
    method: string;
    endpoint: string;
    status?: number;
    duration: number;
    error?: string;
  }> = [];

  private maxLogs = 100;

  log(
    method: string,
    endpoint: string,
    status: number | undefined,
    duration: number,
    error?: string
  ) {
    this.logs.push({
      timestamp: Date.now(),
      method,
      endpoint,
      status,
      duration,
      error,
    });

    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Log to console in development
    if (import.meta.env.DEV) {
      const statusColor = status && status >= 400 ? 'color: red' : 'color: green';
      console.log(
        `%c${method} ${endpoint} ${status || '?'}`,
        statusColor,
        `${duration}ms`,
        error ? error : ''
      );
    }
  }

  getLogs() {
    return this.logs;
  }

  clear() {
    this.logs = [];
  }
}

// Main API Client
class ApiClient {
  private baseUrl: string;
  private token: string | null;
  private logger: RequestLogger;
  private abortControllers: Map<string, AbortController> = new Map();

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.token = localStorage.getItem('token');
    this.logger = new RequestLogger();
  }

  /**
   * Set authentication token
   */
  setToken(token: string): void {
    this.token = token;
    localStorage.setItem('token', token);
  }

  /**
   * Clear authentication token
   */
  clearToken(): void {
    this.token = null;
    localStorage.removeItem('token');
  }

  /**
   * Get current token
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.token !== null;
  }

  /**
   * Get request logs
   */
  getLogs() {
    return this.logger.getLogs();
  }

  /**
   * Retry logic with exponential backoff
   */
  private async retryRequest<T>(
    fetcher: () => Promise<T>,
    endpoint: string,
    maxRetries: number = MAX_RETRIES
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fetcher();
      } catch (error) {
        lastError = error;

        // Don't retry on client errors (4xx) except 408, 429, and 503
        if (error instanceof ApiError) {
          if (
            error.status < 500 &&
            error.status !== 408 &&
            error.status !== 429
          ) {
            throw error;
          }
        }

        // Don't retry on last attempt
        if (attempt === maxRetries) break;

        // Exponential backoff
        const delay = RETRY_DELAY * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Core request method with timeout and error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit & { timeout?: number; retries?: boolean } = {}
  ): Promise<T> {
    const startTime = performance.now();
    const { timeout = API_TIMEOUT, retries = true, ...fetchOptions } = options;

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeout);
    const requestKey = `${options.method || 'GET'} ${endpoint}`;

    try {
      this.abortControllers.set(requestKey, abortController);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(fetchOptions.headers as Record<string, string>),
      };

      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const fetcher = async () => {
        const url = `${this.baseUrl}${endpoint}`;
        const response = await fetch(url, {
          ...fetchOptions,
          headers,
          signal: abortController.signal,
        });

        return this.handleResponse<T>(response);
      };

      const result = retries ? await this.retryRequest(fetcher, endpoint) : await fetcher();
      const duration = performance.now() - startTime;
      this.logger.log(options.method || 'GET', endpoint, 200, duration);

      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      const duration = performance.now() - startTime;

      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = new ServerError(`Request timeout after ${timeout}ms`);
        this.logger.log(options.method || 'GET', endpoint, undefined, duration, timeoutError.message);
        throw timeoutError;
      }

      if (error instanceof ApiError) {
        this.logger.log(options.method || 'GET', endpoint, error.status, duration, error.message);
        throw error;
      }

      const genericError = new ServerError(
        error instanceof Error ? error.message : 'Unknown error'
      );
      this.logger.log(options.method || 'GET', endpoint, 500, duration, genericError.message);
      throw genericError;
    } finally {
      clearTimeout(timeoutId);
      this.abortControllers.delete(requestKey);
    }
  }

  /**
   * Handle API responses
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type');
    let body: any;

    if (contentType?.includes('application/json')) {
      body = await response.json().catch(() => ({}));
    } else {
      body = await response.text();
    }

    if (!response.ok) {
      const error = body?.error || { code: 'UNKNOWN_ERROR', message: 'Unknown error' };
      const message = error.message || body.detail || `HTTP ${response.status}`;

      switch (response.status) {
        case 400:
          throw new ValidationError(message, error.metadata);
        case 401:
          this.clearToken(); // Clear invalid token
          throw new AuthenticationError(message);
        case 403:
          throw new AuthorizationError(message);
        case 404:
          throw new NotFoundError(message);
        case 422:
          throw new ValidationError(message, error.metadata);
        case 429:
          throw new ServerError('Rate limited - please try again later');
        case 500:
        case 502:
        case 503:
        case 504:
          throw new ServerError(message);
        default:
          throw new ApiError(response.status, error.code || 'UNKNOWN', message);
      }
    }

    return body.items ? body : body;
  }

  /**
   * Cancel an ongoing request
   */
  cancelRequest(endpoint: string, method: string = 'GET'): void {
    const key = `${method} ${endpoint}`;
    const controller = this.abortControllers.get(key);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(key);
    }
  }

  // ==================== Auth Endpoints ====================

  async register(credentials: {
    email: string;
    password: string;
    full_name?: string;
  }): Promise<TokenResponse> {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async login(credentials: {
    email: string;
    password: string;
  }): Promise<TokenResponse> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async logout(): Promise<void> {
    this.clearToken();
  }

  async refresh(): Promise<TokenResponse> {
    return this.request('/auth/refresh', { method: 'POST' });
  }

  // ==================== Health Check ====================

  async health(): Promise<{ status: string; version: string; environment: string }> {
    return this.request('/health', { retries: false });
  }

  // ==================== Documents Endpoints ====================

  async uploadDocument(file: File, workspaceId: string): Promise<Document> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('workspace_id', workspaceId);

    return this.request('/documents/upload', {
      method: 'POST',
      headers: {
        // Don't set Content-Type for FormData
      },
      body: formData as any,
    });
  }

  async listDocuments(
    workspaceId: string,
    params?: {
      status?: string;
      page?: number;
      page_size?: number;
    }
  ): Promise<PaginatedResponse<Document>> {
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

  // ==================== Notes Endpoints ====================

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
  }): Promise<PaginatedResponse<Note>> {
    const queryParams = new URLSearchParams();
    if (params?.workspace_id) queryParams.append('workspace_id', params.workspace_id);
    if (params?.search) queryParams.append('search', params.search);
    if (params?.tags) params.tags.forEach((tag) => queryParams.append('tags', tag));
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

  // ==================== Workspaces Endpoints ====================

  async createWorkspace(workspace: {
    name: string;
    description?: string;
  }): Promise<Workspace> {
    return this.request('/workspaces', {
      method: 'POST',
      body: JSON.stringify(workspace),
    });
  }

  async listWorkspaces(): Promise<Workspace[]> {
    const response: any = await this.request('/workspaces');
    return Array.isArray(response) ? response : response.items || [];
  }

  async getWorkspace(workspaceId: string): Promise<Workspace> {
    return this.request(`/workspaces/${workspaceId}`);
  }

  async updateWorkspace(
    workspaceId: string,
    updates: Partial<{
      name: string;
      description: string;
      settings: Record<string, any>;
    }>
  ): Promise<Workspace> {
    return this.request(`/workspaces/${workspaceId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async getWorkspaceStats(workspaceId: string): Promise<{
    documents: { total: number; indexed: number; processing: number };
    vectors: number;
  }> {
    return this.request(`/workspaces/${workspaceId}/stats`);
  }

  // ==================== Search Endpoints ====================

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

  // ==================== Audit Endpoints ====================

  async getAuditLogs(
    workspaceId: string,
    filters?: {
      action?: string;
      entity_type?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<PaginatedResponse<any>> {
    const queryParams = new URLSearchParams();
    if (filters?.action) queryParams.append('action', filters.action);
    if (filters?.entity_type) queryParams.append('entity_type', filters.entity_type);
    if (filters?.limit) queryParams.append('limit', filters.limit.toString());
    if (filters?.offset) queryParams.append('offset', filters.offset.toString());

    return this.request(`/audit/workspace/${workspaceId}?${queryParams}`);
  }

  // ==================== Knowledge Graph Endpoints ====================

  async getKnowledgeGraph(workspaceId: string): Promise<{
    nodes: Array<{ id: string; type: string; label: string; value: number; metadata: any }>;
    edges: Array<{ source: string; target: string; type: string; weight: number }>;
    stats: Record<string, number>;
  }> {
    return this.request(`/knowledge-graph?workspace_id=${workspaceId}`);
  }
}

// Export singleton instance
export const api = new ApiClient();

// React hook for API
export function useApi() {
  return api;
}

