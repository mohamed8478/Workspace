<!-- AUTH_SETUP.md - Authentication Implementation Guide -->

# Authentication Implementation Guide

This document explains the JWT authentication system implemented in this Angular frontend.

## Overview

The authentication system is based on:
- **JWT tokens** (access + refresh) stored in `sessionStorage`
- **HTTP interceptors** that automatically attach tokens and handle token refresh
- **Route guards** that protect authenticated pages
- **Services** that manage auth state and provide authentication methods

## Architecture

### 1. TokenService (`core/services/token.service.ts`)

**Responsibility:** Single point for all JWT token operations

**Methods:**
- `saveTokens(access, refresh)` - Saves both tokens to sessionStorage
- `getAccessToken()` - Returns access token
- `getRefreshToken()` - Returns refresh token
- `clearTokens()` - Removes tokens from storage
- `decodePayload()` - Decodes JWT payload (for display only)
- `isTokenExpired()` - Checks token expiration
- `hasValidToken()` - Checks if token exists and is valid

**Storage:**
- Uses `sessionStorage` (cleared when browser tab closes)
- Never use `localStorage` for tokens
- Access token and refresh token stored separately

### 2. AuthApiService (`api/auth-api.service.ts`)

**Responsibility:** Raw HTTP calls only - no side effects

**Endpoints:**
- `POST /auth/login` - Login with email/password
- `POST /auth/register` - Create new account
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout (server-side invalidation)
- `POST /auth/forgot-password` - Request password reset

### 3. AuthService (`core/services/auth.service.ts`)

**Responsibility:** Orchestrates entire auth flow

**Public Observables:**
- `currentUser$` - Current authenticated user
- `isAuthenticated$` - Authentication state

**Methods:**
- `login(credentials)` - Authenticates user
- `register(credentials)` - Creates new account
- `logout()` - Logs out user
- `refreshAccessToken()` - Refreshes expired token
- `getRoles()` - Gets user roles from token
- `hasRole(role)` - Checks if user has specific role
- `hasAnyRole(roles)` - Checks if user has any of given roles

**State Management:**
- Uses `BehaviorSubject` for reactive state
- Observables available throughout app with `currentUser$` and `isAuthenticated$`
- Never use component properties for auth state - always use these observables

### 4. Interceptors

#### AuthInterceptor (`core/interceptors/auth.interceptor.ts`)

**Responsibilities:**
1. Attaches Bearer token to every HTTP request (except refresh endpoint)
2. Handles 401 responses by:
   - Attempting token refresh
   - Retrying original request with new token
   - On refresh failure: logs out and redirects to login

**Token Refresh Flow:**
```
Original Request (401)
    ↓
Check if already refreshing?
    ├─ No: Call /auth/refresh
    │   ├─ Success: Retry original request
    │   └─ Failure: Logout, redirect to login
    └─ Yes: Wait for refresh to complete, then retry
```

#### ErrorInterceptor (`core/interceptors/error.interceptor.ts`)

**Responsibilities:**
- Catches all HTTP errors
- Displays user-friendly error messages
- Handles specific status codes (401, 403, 500, etc.)

#### LoadingInterceptor (`core/interceptors/loading.interceptor.ts`)

**Responsibilities:**
- Shows loading indicator on request start
- Hides loading indicator on request completion (success or failure)
- Tracks concurrent requests (counter-based)

### 5. Route Guards

#### authGuard (`core/guards/auth.guard.ts`)

**Protection:** Blocks unauthenticated users

```typescript
{
  path: 'dashboard',
  component: DashboardComponent,
  canActivate: [authGuard]  // ← Protects this route
}
```

- Redirects to `/auth/login` if no valid token
- Check: `TokenService.hasValidToken()`

#### roleGuard (`core/guards/role.guard.ts`)

**Protection:** Checks user roles

```typescript
{
  path: 'admin',
  component: AdminComponent,
  canActivate: [roleGuard],
  data: { roles: ['ADMIN'] }  // ← Required roles
}
```

- Reads `route.data.roles` array
- Decodes JWT and checks user's roles
- Redirects to dashboard if insufficient permissions

#### noAuthGuard (`core/guards/no-auth.guard.ts`)

**Protection:** Redirects authenticated users away from login/register

```typescript
{
  path: 'login',
  component: LoginComponent,
  canActivate: [noAuthGuard]  // ← Already logged in? Go to dashboard
}
```

## Components

### LoginComponent (`features/auth/login/login.component.ts`)

**Features:**
- Email and password fields
- Form validation with error display
- Loading state during submission
- "Forgot password" link
- Link to register page
- NO OAuth (Google, Microsoft removed as requested)

**Validation:**
- Email: required, valid email format
- Password: required

### RegisterComponent (`features/auth/register/register.component.ts`)

**Features:**
- First name, last name, email, password, confirm password
- Strong password validator
- Password match validator
- Form-level validation
- Comprehensive error messages
- Loading state during submission
- Link to login page

**Validation:**
- First name: required
- Last name: required
- Email: required, valid email format
- Password: required, strong (8+ chars, uppercase, lowercase, number, special char)
- Confirm password: required, must match password

### DashboardComponent (`features/dashboard/dashboard.component.ts`)

**Features:**
- Protected page requiring authentication
- Displays current user info
- Logout button
- Shows user email, ID, and roles

## UI Components

### LoaderComponent (`shared/components/loader/`)

- Global loading overlay during HTTP requests
- Spinner animation
- Fixed position overlay

### NotificationsComponent (`shared/components/notifications/`)

- Toast notifications for success, error, warning, info
- Auto-dismiss after configurable duration
- Animated appearance/disappearance
- Close button
- Fixed position (bottom-right, responsive)

## Usage Examples

### Login Example

```typescript
// In login.component.ts
const credentials: LoginRequest = { 
  email: 'user@example.com', 
  password: 'password' 
};

this.authService.login(credentials).subscribe({
  next: () => {
    // Automatically redirects to dashboard
  },
  error: (error) => {
    // Error already displayed by interceptor/notification service
  }
});
```

### Check Authentication

```typescript
// In any component
export class MyComponent {
  isAuthenticated$ = this.authService.isAuthenticated$;
  currentUser$ = this.authService.currentUser$;

  constructor(private authService: AuthService) {}
}

// In template
@if (isAuthenticated$ | async) {
  <p>{{ (currentUser$ | async)?.email }}</p>
}
```

### Check Roles

```typescript
// In component
hasAdminAccess = this.authService.hasRole('ADMIN');

// In template
@if (hasAdminAccess) {
  <button>Admin Panel</button>
}
```

### Display Loading State

```typescript
isLoading$ = this.loadingService.loading$;

// In template
@if (isLoading$ | async) {
  <p>Loading...</p>
}
```

## Security Best Practices Implemented

1. ✅ Tokens stored in `sessionStorage` (cleared on browser close)
2. ✅ No hardcoded API URLs (uses `environment.apiUrl`)
3. ✅ No user enumeration on forgot-password (always shows success)
4. ✅ Token only decoded in `TokenService` (never in components)
5. ✅ Refresh token only sent to `/auth/refresh` endpoint
6. ✅ JWT payload used for display only (never security decisions)
7. ✅ CSRF protection enabled via `HttpClientXsrfModule`
8. ✅ All HTTP errors logged (no sensitive info in console)
9. ✅ Role checks from JWT, not local state
10. ✅ Strict TypeScript (`no any`, typed observables)

## Environment Configuration

### `environment.ts` (Development)

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/api'  // Your backend URL
};
```

### `environment.prod.ts` (Production)

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://api.yourdomain.com/api'  // Your production API
};
```

## Expected Backend Responses

### Login / Register Response

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "123",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "roles": ["USER"]
  }
}
```

### JWT Payload Structure

```json
{
  "sub": "user_id_123",
  "email": "user@example.com",
  "roles": ["USER", "ADMIN"],
  "iat": 1234567890,
  "exp": 1234571490
}
```

### Refresh Token Response

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## Customization

### Change API Base URL

Edit `environment.ts` and `environment.prod.ts`

### Add New Role Guard

```typescript
// In your route
{
  path: 'moderator-panel',
  component: ModeratorComponent,
  canActivate: [roleGuard],
  data: { roles: ['MODERATOR', 'ADMIN'] }
}
```

### Add New Interceptor

```typescript
// 1. Create interceptor file
// 2. Register in app.config.ts:

{
  provide: HTTP_INTERCEPTORS,
  useClass: YourNewInterceptor,
  multi: true
}
```

### Customize Token Storage

Modify `TokenService.saveTokens()` and related methods to use localStorage, sessionStorage, or IndexedDB

## Troubleshooting

### Token Not Being Attached

- Check `AuthInterceptor` is registered in `app.config.ts`
- Verify token exists: `TokenService.getAccessToken()`
- Check endpoint is not `/auth/refresh` (skipped by interceptor)

### Infinite Login Loop

- Check `noAuthGuard` on login route
- Verify `authGuard` redirects only to `/auth/login`
- Check token expiration time is in future

### 401 Errors After Login

- Refresh token may be invalid
- Check backend is setting correct token expiration
- Verify `AuthInterceptor` retry logic

### CSRF Issues

- `HttpClientXsrfModule` configured in `app.config.ts`
- Check backend CSRF header name matches: `X-XSRF-TOKEN`
- Verify backend cookie name matches: `XSRF-TOKEN`

## Flow Diagrams

### Login Flow

```
User enters credentials → LoginComponent → AuthService.login()
→ AuthApiService.login() → Backend /auth/login
→ Backend returns tokens + user info
→ TokenService.saveTokens()
→ AuthService updates currentUser$ and isAuthenticated$
→ Router navigates to /dashboard
```

### Automatic Token Refresh

```
Any HTTP Request → AuthInterceptor attaches token
→ Backend responds 401 (token expired)
→ AuthInterceptor detects 401
→ AuthApiService.refreshToken()
→ Backend /auth/refresh returns new accessToken
→ AuthInterceptor retries original request
→ Request succeeds
```

### Protected Route Access

```
User navigates to /dashboard
→ authGuard checks TokenService.hasValidToken()
→ Valid? Allow access : Redirect to /auth/login
```

## Next Steps

1. Update `environment.ts` with your backend API URL
2. Implement backend endpoints (/auth/login, /auth/register, etc.)
3. Test login/register flow
4. Add additional features (profile, settings, etc.)
5. Customize UI styling as needed
