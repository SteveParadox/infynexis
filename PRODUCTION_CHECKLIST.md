# Production Readiness Checklist & Testing Guide

## Backend Checklist

### Security
- [x] JWT secret configured and not exposed - configured via environment variable
- [x] CORS origins properly configured - environment-based, not allow-all
- [x] Request validation enabled - RequestValidationError handler implemented
- [x] Error messages don't expose internals in production - conditional error details
- [x] Rate limiting implemented - simple but effective
- [x] Password hashing with bcrypt - implemented in security.py
- [x] HTTPS ready - uses standard FastAPI with production ASGI server support
- [ ] API key rotation strategy - document procedure
- [ ] Audit logging enabled - implemented

### API Standards
- [x] Standardized error responses - ErrorResponse class implemented
- [x] Request/response logging - RequestLoggingMiddleware added
- [x] Request timeout handling - middleware in place
- [x] Pagination support - implemented in endpoints
- [x] API versioning strategy - consider adding `/v1/` prefix
- [x] OpenAPI documentation - FastAPI auto-generates at `/docs`
- [x] Health check endpoint - `/health` implemented
- [ ] API rate limiting strategy - document aggressive limits for production
- [ ] Monitoring and alerting - recommend: Sentry, DataDog, etc.

### Database
- [ ] Migrations up to date - run `alembic upgrade head`
- [ ] Connection pooling configured - `DATABASE_POOL_SIZE` set
- [ ] Backups automated - set up daily backups
- [ ] Database indexes created - review performance queries
- [ ] Test data cleaned up - remove seed data
- [ ] Read replicas configured (if needed)
- [ ] Connection timeouts set properly

### Infrastructure
- [ ] Environment variables documented - `.env.example` created
- [ ] All secrets in external config - not in code
- [ ] Logging level appropriate - INFO in production
- [ ] Docker image optimized - multi-stage build
- [ ] Resource limits set - CPU/memory quotas
- [ ] Auto-scaling configured - if using Kubernetes
- [ ] CI/CD pipeline ready - automated tests and deployment
- [ ] Deployment procedure documented

### Testing
- [ ] Unit tests passing
- [ ] Integration tests for API endpoints
- [ ] Load testing completed
- [ ] Security scanning run
- [ ] Dependency vulnerability check
- [ ] Database migration tested

---

## Frontend Checklist

### Security
- [x] No hardcoded credentials - environment variables used
- [x] User input validation - form validation on all inputs
- [x] XSS protection - React's built-in escaping
- [x] CSRF protection - API-based, no form submission needed
- [x] Environment-specific configs - `.env.example` provided
- [ ] Content Security Policy header - configure in server
- [ ] API Token stored securely - localStorage (consider HttpOnly cookie)
- [ ] Sensitive data not logged - implement loggers appropriately
- [ ] HTTPS required - enforce with redirect
- [ ] Dependency updates current - run `npm audit`

### API Integration
- [x] Error handling complete - comprehensive Error classes
- [x] Retry logic implemented - automatic with exponential backoff
- [x] Timeout handling - configurable timeout
- [x] Token refresh logic - refresh endpoint available
- [x] Request logging - RequestLogger class
- [x] Loading states - proper UI feedback
- [x] Pagination support - usePaginatedApi hook
- [x] Error boundaries - ErrorBoundary component
- [ ] Offline support - consider service workers
- [ ] Request deduplication - document pattern

### Performance
- [ ] Code splitting enabled - verify in Vite build
- [ ] Lazy loading routes - React.lazy() for routes
- [ ] Image optimization - use next-gen formats
- [ ] Minification enabled - Vite default
- [ ] Tree shaking enabled - ES modules
- [ ] Bundle analysis - check final size
- [ ] Caching strategy - implement proper headers
- [ ] CDN ready - static assets optimized

### Testing
- [ ] Component tests passing
- [ ] Integration tests for user flows
- [ ] E2E tests for critical paths
- [ ] Cross-browser testing
- [ ] Mobile testing (responsive)
- [ ] Accessibility (a11y) testing
- [ ] Performance profiling done
- [ ] Error scenarios tested

---

## Testing Guide

### Backend API Testing

#### Using curl
```bash
# Health check
curl http://localhost:8000/health

# Register
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePassword123!",
    "full_name": "Test User"
  }'

# Login
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePassword123!"
  }'

# Create workspace (with token)
curl -X POST http://localhost:8000/workspaces \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Workspace"}'
```

#### Using Python
```python
import requests

BASE_URL = "http://localhost:8000"

# Register
response = requests.post(f"{BASE_URL}/auth/register", json={
    "email": "test@example.com",
    "password": "SecurePassword123!",
    "full_name": "Test User"
})
token = response.json()["access_token"]

# Create workspace
headers = {"Authorization": f"Bearer {token}"}
response = requests.post(f"{BASE_URL}/workspaces", 
    json={"name": "Test Workspace"},
    headers=headers)
workspace_id = response.json()["id"]

# Upload document
with open("document.pdf", "rb") as f:
    files = {"file": f}
    response = requests.post(f"{BASE_URL}/documents/upload",
        params={"workspace_id": workspace_id},
        files=files,
        headers=headers)

# Search
response = requests.post(f"{BASE_URL}/search",
    params={"workspace_id": workspace_id},
    json={"query": "test query"},
    headers=headers)
```

#### Using FastAPI Test Client
```python
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200

def test_register():
    response = client.post("/auth/register", json={
        "email": "test@example.com",
        "password": "SecurePassword123!",
        "full_name": "Test User"
    })
    assert response.status_code == 201
    assert "access_token" in response.json()

def test_protected_endpoint():
    # First register/login
    login_response = client.post("/auth/login", json={
        "email": "test@example.com",
        "password": "SecurePassword123!"
    })
    token = login_response.json()["access_token"]

    # Use token to access protected endpoint
    headers = {"Authorization": f"Bearer {token}"}
    workspace_response = client.post("/workspaces",
        json={"name": "Test"},
        headers=headers)
    assert workspace_response.status_code == 201
```

### Frontend Component Testing

#### React Testing Library
```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './LoginForm';

describe('LoginForm', () => {
  it('displays error on invalid credentials', async () => {
    const { container } = render(<LoginForm />);
    
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /login/i });

    await userEvent.type(emailInput, 'test@example.com');
    await userEvent.type(passwordInput, 'wrongpassword');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
    });
  });

  it('submits form on valid credentials', async () => {
    const mockNavigate = jest.fn();
    
    render(<LoginForm />);
    
    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'SecurePassword123!');
    await userEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });
});
```

### E2E Testing with Playwright

```typescript
import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('user can register and login', async ({ page }) => {
    // Register
    await page.goto('http://localhost:3000/register');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'SecurePassword123!');
    await page.fill('input[name="fullName"]', 'Test User');
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL('http://localhost:3000/dashboard');
    
    // Logout
    await page.click('button[aria-label="User menu"]');
    await page.click('text=Logout');

    // Should redirect to login
    await expect(page).toHaveURL('http://localhost:3000/login');

    // Login
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'SecurePassword123!');
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL('http://localhost:3000/dashboard');
  });
});
```

### Load Testing with k6

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
  },
};

export default function () {
  let response = http.get('http://localhost:8000/health');
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
  sleep(1);
}
```

Run with: `k6 run load-test.js`

---

## Deployment Instructions

### Backend (Docker)

```bash
# Build image
docker build -t cogniflow-api:latest -f Dockerfile .

# Run container
docker run -d \
  --name cogniflow-api \
  -p 8000:8000 \
  -e ENVIRONMENT=production \
  -e JWT_SECRET=$(openssl rand -hex 32) \
  -e DATABASE_URL=postgresql://... \
  -e OPENAI_API_KEY=... \
  cogniflow-api:latest

# Check logs
docker logs -f cogniflow-api
```

### Frontend (Nginx)

```bash
# Build
npm run build

# Deploy dist/ folder to web server
# Configure VITE_API_URL to production backend URL

# Nginx config
server {
  listen 80;
  server_name app.cogni-flow.app;
  
  location / {
    root /var/www/cogniflow;
    try_files $uri $uri/ /index.html;
  }
  
  location /api {
    proxy_pass http://api-backend:8000;
  }
}
```

### Environment Variables

**Backend Production (.env)**
```env
ENVIRONMENT=production
DEBUG=false
JWT_SECRET=<generated-secure-key>
DATABASE_URL=postgresql://user:pass@prod-db:5432/cogniflow
CORS_ORIGINS=https://app.cogni-flow.app
```

**Frontend Production (.env.production)**
```env
VITE_API_URL=https://api.cogni-flow.app
VITE_DEBUG=false
VITE_API_TIMEOUT=30000
```

---

## Monitoring & Alerting

### Key Metrics to Monitor

1. **API Response Time**
   - Alert: p95 > 1000ms
   - Alert: p99 > 2000ms

2. **Error Rate**
   - Alert: 5xx errors > 1%
   - Alert: 4xx errors > 10%

3. **Availability**
   - Alert: Uptime < 99.9%
   - Alert: `/health` check failure

4. **Database**
   - Alert: Connection pool exhaustion
   - Alert: Query time > 5s
   - Alert: Replication lag > 10s

5. **Resource Usage**
   - Alert: CPU > 80%
   - Alert: Memory > 85%
   - Alert: Disk > 90%

### Recommended Tools
- **APM**: Sentry, DataDog, New Relic
- **Monitoring**: Prometheus + Grafana
- **Logging**: ELK Stack, CloudWatch, Splunk
- **Alerting**: PagerDuty, Opsgenie, Slack

---

## Rollback Procedure

### Database
```bash
# Rollback last migration
alembic downgrade -1

# Rollback to specific migration
alembic downgrade <revision>
```

### Application
```bash
# Current deployment
docker ps -a | grep cogniflow-api

# Previous image
docker images | grep cogniflow-api

# Roll back
docker stop cogniflow-api
docker rm cogniflow-api
docker run -d --name cogniflow-api <previous-image-id>
```

---

## Conclusion

This checklist ensures production readiness across security, performance, testing, and operational aspects. Review and update regularly as the application evolves.
