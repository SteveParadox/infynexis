/**
 * Auth Context for managing authentication state
 * Provides user info, tokens, workspaces, and auth methods globally
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/lib/api';
export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface Workspace {
  id: string;
  name: string;
  role: WorkspaceRole;
}

export interface User {
  id: string;
  email: string;
  full_name?: string;
  is_active: boolean;
  created_at: string;
}

export interface AuthContextType {
  // State
  user: User | null;
  workspaces: Workspace[];
  currentWorkspaceId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  
  // Methods
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  setCurrentWorkspace: (workspaceId: string) => void;
  clearError: () => void;
  hasRole: (workspaceId: string, minRole: WorkspaceRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Auth Provider Component
 * Wraps the application and provides auth context
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Initialize auth state on mount
   * Check if user already has a valid token
   */
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        if (api.isAuthenticated()) {
          // Try to refresh token and get user info
          const response = await api.refresh();
          api.setToken(response.access_token);
          setUser({
            id: response.user.id,
            email: response.user.email,
            full_name: response.user.full_name,
            is_active: true,
            created_at: new Date().toISOString(),
          });

          // Load workspaces
          if (response.workspaces && Array.isArray(response.workspaces)) {
            setWorkspaces(response.workspaces);
            // Set first workspace as current
            if (response.workspaces.length > 0) {
              setCurrentWorkspaceId(response.workspaces[0].id);
              localStorage.setItem('currentWorkspaceId', response.workspaces[0].id);
            }
          } else {
            // Fetch workspaces separately
            await loadWorkspaces();
          }
        }
      } catch (err) {
        // Token is invalid or expired, clear it
        api.clearToken();
        setUser(null);
        setWorkspaces([]);
        setCurrentWorkspaceId(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  /**
   * Load user's workspaces
   */
  const loadWorkspaces = async () => {
    try {
      const response = await api.get('/auth/workspaces');
      if (response.workspaces) {
        setWorkspaces(response.workspaces);
        if (response.workspaces.length > 0) {
          const savedWorkspaceId = localStorage.getItem('currentWorkspaceId');
          const workspaceId = savedWorkspaceId && response.workspaces.some(w => w.id === savedWorkspaceId)
            ? savedWorkspaceId
            : response.workspaces[0].id;
          setCurrentWorkspaceId(workspaceId);
          localStorage.setItem('currentWorkspaceId', workspaceId);
        }
      }
    } catch (err) {
      console.error('Failed to load workspaces:', err);
    }
  };

  /**
   * Handle login
   */
  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.login({ email, password });
      
      // Store token
      api.setToken(response.access_token);
      
      // Set user
      setUser({
        id: response.user.id,
        email: response.user.email,
        full_name: response.user.full_name,
        is_active: true,
        created_at: new Date().toISOString(),
      });

      // Set workspaces
      if (response.workspaces && Array.isArray(response.workspaces)) {
        setWorkspaces(response.workspaces);
        if (response.workspaces.length > 0) {
          setCurrentWorkspaceId(response.workspaces[0].id);
          localStorage.setItem('currentWorkspaceId', response.workspaces[0].id);
        }
      }
    } catch (err) {
      const errorMessage = 
        err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle registration
   */
  const register = async (
    email: string,
    password: string,
    fullName?: string
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.register({
        email,
        password,
        full_name: fullName,
      });

      // Store token
      api.setToken(response.access_token);

      // Set user
      setUser({
        id: response.user.id,
        email: response.user.email,
        full_name: response.user.full_name,
        is_active: true,
        created_at: new Date().toISOString(),
      });

      // Set workspaces
      if (response.workspaces && Array.isArray(response.workspaces)) {
        setWorkspaces(response.workspaces);
        if (response.workspaces.length > 0) {
          setCurrentWorkspaceId(response.workspaces[0].id);
          localStorage.setItem('currentWorkspaceId', response.workspaces[0].id);
        }
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Registration failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle logout
   */
  const logout = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await api.logout();
      api.clearToken();
      setUser(null);
      setWorkspaces([]);
      setCurrentWorkspaceId(null);
      localStorage.removeItem('currentWorkspaceId');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Logout failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Set current workspace
   */
  const setCurrentWorkspace = (workspaceId: string) => {
    setCurrentWorkspaceId(workspaceId);
    localStorage.setItem('currentWorkspaceId', workspaceId);
  };

  /**
   * Check if current user has required role in workspace
   */
  const hasRole = (workspaceId: string, minRole: WorkspaceRole): boolean => {
    const workspace = workspaces.find(w => w.id === workspaceId);
    if (!workspace) return false;

    const roleHierarchy: Record<WorkspaceRole, number> = {
      owner: 4,
      admin: 3,
      member: 2,
      viewer: 1,
    };

    return roleHierarchy[workspace.role] >= roleHierarchy[minRole];
  };

  /**
   * Refresh authentication
   */
  const refreshAuth = async () => {
    try {
      const response = await api.refresh();
      api.setToken(response.access_token);
      setUser({
        id: response.user.id,
        email: response.user.email,
        full_name: response.user.full_name,
        is_active: true,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      api.clearToken();
      setUser(null);
      throw err;
    }
  };

  /**
   * Clear error message
   */
  const clearError = () => setError(null);

  const value: AuthContextType = {
    user,
    workspaces,
    currentWorkspaceId,
    isLoading,
    isAuthenticated: user !== null,
    error,
    login,
    register,
    logout,
    refreshAuth,
    setCurrentWorkspace,
    clearError,
    hasRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to use auth context
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
