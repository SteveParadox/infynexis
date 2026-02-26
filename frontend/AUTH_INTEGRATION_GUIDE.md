# Auth System Implementation - End-to-End Integration Guide

## Overview

The authentication system implements JWT-based auth with workspace-based role management (OWNER/ADMIN/MEMBER/VIEWER).

## Architecture

### Database Layer
- **User**: Base user account with email/password
- **Workspace**: Team/workspace container
- **WorkspaceMember**: Tracks user membership + role in workspace
- **WorkspaceRole Enum**: OWNER (4) > ADMIN (3) > MEMBER (2) > VIEWER (1)

### Backend Authentication
- **JWT Token**: Access token with expiration
- **Password Security**: Bcrypt hashing with random salt
- **Role Hierarchy**: Numeric comparison for role checks
- **Workspace Context**: Request-scoped context with permission checking

### Frontend State Management
- **AuthContext**: Global auth state with workspace management
- **Workspace Switcher**: UI for switching between workspaces
- **Role Checking**: `hasRole(workspaceId, minRole)` utility

## Components

### Backend Endpoints

```
POST   /auth/register              - Create user + workspace
POST   /auth/login                 - Authenticate user
POST   /auth/refresh               - Refresh JWT token
GET    /auth/me                    - Get current user info
POST   /auth/logout                - Client-side logout
POST   /auth/change-password       - Update password
GET    /auth/workspaces            - List user's workspaces
POST   /auth/workspaces/{id}/invite - Invite member to workspace
```

### Frontend Components

```
LoginPage          - Login form with validation
RegisterPage       - Registration with email/password
PrivateRoute       - Route protection component
AuthContext        - Global auth state management
WorkspaceSwitcher  - Workspace selection dropdown
InviteMembersDialog - Invite members to workspace
```

## API Client Integration

The frontend API client (`/lib/api.ts`) handles:
- Token management (set/get/clear)
- Token refresh on 401 responses
- Automatic Authorization header injection
- Request retry logic

## Setting Up for Development

### 1. Environment Configuration

**Backend (.env):**
```bash
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cogniflow
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

**Frontend (.env.local):**
```bash
VITE_API_URL=http://localhost:8000
VITE_API_TIMEOUT=30000
VITE_API_MAX_RETRIES=3
```

### 2. Database Setup

```bash
cd Server
# Run migrations
alembic upgrade head

# Or use docker-compose
docker-compose up -d postgres
docker-compose run api alembic upgrade head
```

### 3. Start Services

```bash
# Backend (from Server directory)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend (from frontend directory)
npm run dev
```

## End-to-End Flow

### Registration Flow
1. User fills email, password, password-confirm, full name
2. Frontend calls `POST /auth/register`
3. Backend:
   - Validates input
   - Creates User record
   - Creates default workspace with user as OWNER
   - Returns JWT token + workspaces array
4. Frontend:
   - Stores token in localStorage
   - Sets currentWorkspace to default
   - Redirects to dashboard

### Login Flow
1. User enters email/password
2. Frontend calls `POST /auth/login`
3. Backend:
   - Validates credentials
   - Loads all user's workspaces (owned + members)
   - Returns JWT token + workspaces array
4. Frontend:
   - Stores token
   - Loads workspaces
   - Restores lastUsed workspace from localStorage
   - Redirects to dashboard

### API Protection Flow
1. User makes API request (e.g., upload document)
2. Frontend includes JWT in Authorization header
3. Backend:
   - Extracts and validates JWT
   - Loads User from database
   - Verifies workspace membership
   - Checks role >= required role
   - Executes endpoint or returns 403
4. If 401 (token expired):
   - Frontend calls `POST /auth/refresh`
   - Gets new token
   - Retries original request

### Workspace Switching Flow
1. User selects different workspace in switcher
2. Frontend calls `setCurrentWorkspace(newWorkspaceId)`
3. AuthContext:
   - Updates state
   - Saves to localStorage
   - Notifies subscribers
4. App re-renders with new workspace context

### Inviting Members Flow
1. Workspace admin opens "Invite Members" dialog
2. Enters email + selects role (member/admin/viewer)
3. Frontend calls `POST /auth/workspaces/{id}/invite`
4. Backend:
   - Verifies admin role
   - Checks if user exists:
     - If yes: Creates WorkspaceMember record with role
     - If no: Returns signup URL (for future email integration)
5. Frontend shows success message
6. New member can now log in and access workspace

## Role-Based Access Control

### Role Permissions

| Role | Upload | Delete | Invite | View |
|------|--------|--------|--------|------|
| VIEWER | ✗ | ✗ | ✗ | ✓ |
| MEMBER | ✓ | ✗ | ✗ | ✓ |
| ADMIN | ✓ | ✓ | ✓ | ✓ |
| OWNER | ✓ | ✓ | ✓ | ✓ |

### Protected Endpoints

- `POST /documents/upload` → Requires MEMBER+ role
- `DELETE /documents/{id}` → Requires ADMIN+ role
- `POST /workspaces/{id}/invite` → Requires ADMIN+ role

### Frontend Role Checking

```typescript
// Check if user has role
const canUpload = hasRole(workspaceId, 'member');
const canDelete = hasRole(workspaceId, 'admin');

// In components
if (canDelete) {
  return <DeleteButton />;
}
```

## Security Considerations

✓ Passwords hashed with bcrypt before storage
✓ JWT includes exp/iat timestamps
✓ Workspace membership verified on every request
✓ Role hierarchy enforced in both layers
✓ Unique constraint on (workspace_id, user_id)
✓ CORS configured for frontend origin only
✓ HTTPOnly cookie option available (default: localStorage)

## Testing

### Manual Testing

1. **Registration**
   - Go to `http://localhost:5173/register`
   - Create account with valid email/password
   - Verify JWT in browser console: `JSON.parse(atob(localStorage.token.split('.')[1]))`
   - Should have `exp`, `iat`, `sub` (user_id), `workspace_id` claims

2. **Login**
   - Go to `http://localhost:5173/login`
   - Log in with created account
   - Verify workspaces array in localStorage

3. **Workspace Switching**
   - Create another workspace via API: `POST /workspaces`
   - User should be OWNER of first, MEMBER of second
   - Switch workspaces using dropdown
   - Verify `currentWorkspaceId` changes in localStorage

4. **Invite Member**
   - Click "Invite Members" (admin only)
   - Enter existing user's email
   - Select role (e.g., member)
   - Invited user should see new workspace on next login

5. **Role-Based Protection**
   - As VIEWER: Try uploading document → Should get 403
   - As ADMIN: Delete document → Should succeed
   - As OWNER: Change member roles → Should succeed

### API Testing with cURL

```bash
# Register
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123","full_name":"Test User"}'

# Login
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123"}'

# Get workspaces (with token)
curl http://localhost:8000/auth/workspaces \
  -H "Authorization: Bearer <token>"

# Invite member
curl -X POST http://localhost:8000/auth/workspaces/<id>/invite \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"email":"newuser@example.com","role":"member"}'
```

## Troubleshooting

**"JWT signature verification failed"**
- Ensure JWT_SECRET is same on backend and frontend decode

**"Token expired"**
- Frontend auto-refreshes on 401, but check JWT_EXPIRATION_HOURS

**"Insufficient permissions"**
- User's role in workspace doesn't meet endpoint requirement
- Check WorkspaceMember.role in database

**"Workspace not found"**
- User not a member of workspace
- Check for workspace_id in query/body params

## Next Steps

1. Email verification on registration
2. Password reset flow
3. Social login (OAuth)
4. Invite tokens (email links instead of direct add)
5. Member management UI (change roles, remove members)
6. Organization-level permissions
7. Audit logging for auth events
