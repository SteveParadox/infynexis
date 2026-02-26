/**
 * App Router Component
 * Defines all application routes with authentication guards
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { PrivateRoute } from '@/components/PrivateRoute';
import App from '@/App';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';

/**
 * Main router component
 * Wraps the entire app with routing and auth provider
 */
export function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected Routes */}
          <Route
            path="/*"
            element={
              <PrivateRoute>
                <App />
              </PrivateRoute>
            }
          />

          {/* Catch all - redirect to dashboard */}
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
