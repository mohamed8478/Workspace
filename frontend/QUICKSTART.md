<!-- QUICKSTART.md - Get Started with Auth in 5 Minutes -->

# Quick Start Guide

## 1. Configure Backend API URL

Edit `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/api'  // ← Change to your backend
};
```

## 2. Run the Application

```bash
npm start
```

App runs at `http://localhost:4200`

## 3. Test Login Flow

Navigate to `http://localhost:4200/auth/login`

**Test Credentials:**
- Email: `user@example.com`
- Password: `Test@123`

## 4. Available Routes

| Route | Component | Protected | Notes |
|-------|-----------|-----------|-------|
| `/auth/login` | LoginComponent | No | Redirects to dashboard if already logged in |
| `/auth/register` | RegisterComponent | No | Redirects to dashboard if already logged in |
| `/dashboard` | DashboardComponent | Yes | Shows user info, requires login |
| `/` | Redirects to `/dashboard` | - | - |

## 5. API Endpoints Expected

Your backend should implement these endpoints:

### POST /auth/login
```
Request:
{
  "email": "user@example.com",
  "password": "password"
}

Response:
{
  "accessToken": "jwt_token",
  "refreshToken": "refresh_token",
  "user": {
    "id": "123",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "roles": ["USER"]
  }
}
```

### POST /auth/register
```
Request:
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "StrongPass@123"
}

Response:
Same as login response
```

### POST /auth/refresh
```
Request:
{
  "refreshToken": "refresh_token"
}

Response:
{
  "accessToken": "new_jwt_token"
}
```

### POST /auth/logout
```
Request: {} or empty body
Response: {} or 200 OK
```

### POST /auth/forgot-password
```
Request:
{
  "email": "user@example.com"
}

Response: {} or 200 OK
(Always return success regardless of whether email exists)
```

## 6. JWT Token Structure

Your access token should contain these claims:

```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "roles": ["USER"],
  "iat": 1234567890,
  "exp": 1234571490
}
```

## 7. Using Auth in Components

### Inject Services

```typescript
import { AuthService } from './core/services/auth.service';

export class MyComponent {
  constructor(private authService: AuthService) {}
}
```

### Access User Data

```typescript
export class MyComponent {
  currentUser$ = this.authService.currentUser$;
  isAuthenticated$ = this.authService.isAuthenticated$;

  // In template
  // @if (isAuthenticated$ | async as user) {
  //   <p>Hello {{ user.firstName }}</p>
  // }
}
```

### Logout

```typescript
this.authService.logout();
```

### Check Roles

```typescript
const isAdmin = this.authService.hasRole('ADMIN');
const hasPerm = this.authService.hasAnyRole(['ADMIN', 'MODERATOR']);
```

## 8. Common Issues & Solutions

### "Cannot GET /auth/login"
- Make sure you're using the correct base URL with `/` prefix
- Routes are configured, no backend needed for frontend routes

### "401 Unauthorized"
- Token is expired or invalid
- AuthInterceptor will attempt refresh automatically
- If refresh fails, user is logged out

### "CORS Error"
- Backend needs CORS headers
- Add to backend: `Access-Control-Allow-Origin: http://localhost:4200`

### Tokens Not Being Sent
- Check browser DevTools → Network
- Should see `Authorization: Bearer token_here` header
- If missing, AuthInterceptor may not be registered

### Lost on Refresh (F5)
- This is expected - tokens are in sessionStorage
- On app startup, AuthService checks for valid token
- If valid, user is restored and stays logged in
- If invalid, user is redirected to login

## 9. Customization

### Change Password Validation Rules

Edit `src/app/shared/validators/strong-password.validator.ts`

### Customize Notification Position

Edit `src/app/shared/components/notifications/notifications.component.ts`

### Change Loading Spinner

Edit `src/app/shared/components/loader/loader.component.ts`

### Add New Route

```typescript
// In app.routes.ts
{
  path: 'new-feature',
  component: NewFeatureComponent,
  canActivate: [authGuard]  // Add guard if protected
}
```

## 10. Next Steps

1. ✅ Configure backend API URL
2. ✅ Implement backend endpoints
3. ✅ Test login/register
4. ✅ Add more features
5. ✅ Deploy to production

## Need Help?

- See detailed docs in `AUTH_SETUP.md`
- Check `CLAUDE.md` for coding standards
- Review component files for examples
