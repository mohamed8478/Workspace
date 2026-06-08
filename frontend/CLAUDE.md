# CLAUDE.md — Angular Frontend (JWT Auth)

This file tells Claude how to generate code for this project.
Read it fully before writing any file.

---

## Project overview

Angular 17+ frontend with JWT authentication.
Backend is a REST API (Spring Boot) that returns `accessToken` + `refreshToken` on login.
This is a SPA — no SSR.

---

## Stack

| Layer | Tool |
|---|---|
| Framework | Angular 17+ (standalone components) |
| Language | TypeScript strict mode |
| HTTP | Angular HttpClient |
| Forms | Reactive Forms only |
| Routing | Angular Router with lazy-loaded routes |
| State | RxJS BehaviorSubject (no NgRx unless asked) |
| Styles | Plain CSS + CSS variables, no SCSS, no Tailwind |
| Testing | Jasmine + Karma (don't generate tests unless asked) |

---

## Folder structure

This is the architecture for the entire app — auth and every other feature.
Follow this structure for all new files without exception.

```
src/
├── app/
│   │
│   ├── core/                               ← singletons, loaded once at startup
│   │   ├── interceptors/
│   │   │   ├── auth.interceptor.ts         ← attaches Bearer token to every request
│   │   │   ├── error.interceptor.ts        ← global HTTP error handler (401, 403, 500)
│   │   │   └── loading.interceptor.ts      ← toggles global loading state on HTTP
│   │   ├── guards/
│   │   │   ├── auth.guard.ts               ← blocks unauthenticated users
│   │   │   ├── role.guard.ts               ← checks JWT roles claim
│   │   │   └── no-auth.guard.ts            ← redirects logged-in users away from /login
│   │   └── services/
│   │       ├── auth.service.ts             ← orchestrates login/logout/refresh flow
│   │       ├── token.service.ts            ← single place for JWT read/write/decode
│   │       ├── notification.service.ts     ← app-wide toast/snackbar messages
│   │       └── loading.service.ts          ← global loading state (BehaviorSubject)
│   │
│   ├── features/                           ← one folder per app section, lazy-loaded
│   │   ├── auth/
│   │   │   ├── auth.routes.ts
│   │   │   ├── login/
│   │   │   │   ├── login.component.ts
│   │   │   │   ├── login.component.html
│   │   │   │   └── login.component.css
│   │   │   ├── register/
│   │   │   │   ├── register.component.ts
│   │   │   │   ├── register.component.html
│   │   │   │   └── register.component.css
│   │   │   └── forgot-password/
│   │   │       ├── forgot-password.component.ts
│   │   │       ├── forgot-password.component.html
│   │   │       └── forgot-password.component.css
│   │   │
│   │   ├── dashboard/
│   │   │   ├── dashboard.routes.ts
│   │   │   ├── dashboard.service.ts        ← local service, only used by this feature
│   │   │   ├── dashboard.component.ts
│   │   │   ├── dashboard.component.html
│   │   │   └── dashboard.component.css
│   │   │
│   │   ├── users/                          ← example of a full CRUD feature
│   │   │   ├── users.routes.ts
│   │   │   ├── users.service.ts            ← calls UsersApiService, holds feature state
│   │   │   ├── users-list/
│   │   │   │   ├── users-list.component.ts
│   │   │   │   ├── users-list.component.html
│   │   │   │   └── users-list.component.css
│   │   │   ├── user-detail/
│   │   │   │   ├── user-detail.component.ts
│   │   │   │   ├── user-detail.component.html
│   │   │   │   └── user-detail.component.css
│   │   │   └── user-form/
│   │   │       ├── user-form.component.ts
│   │   │       ├── user-form.component.html
│   │   │       └── user-form.component.css ← shared by create and edit
│   │   │
│   │   └── [feature-name]/                 ← copy this pattern for every new feature
│   │       ├── [feature].routes.ts
│   │       ├── [feature].service.ts
│   │       ├── [feature]-list/
│   │       ├── [feature]-detail/
│   │       └── [feature]-form/
│   │
│   ├── api/                                ← HttpClient lives here only, one file per resource
│   │   ├── auth-api.service.ts
│   │   ├── users-api.service.ts
│   │   └── [resource]-api.service.ts       ← add one per backend resource
│   │
│   ├── layouts/                            ← shell components that host <router-outlet>
│   │   ├── main-layout/
│   │   │   ├── main-layout.component.ts    ← navbar + sidebar + <router-outlet>
│   │   │   ├── navbar/
│   │   │   │   └── navbar.component.ts
│   │   │   └── sidebar/
│   │   │       └── sidebar.component.ts
│   │   └── auth-layout/
│   │       └── auth-layout.component.ts    ← centered card, no nav
│   │
│   ├── shared/                             ← reusable, zero business logic
│   │   ├── components/
│   │   │   ├── loader/
│   │   │   ├── data-table/
│   │   │   ├── modal/
│   │   │   ├── alert/
│   │   │   ├── empty-state/
│   │   │   └── pagination/
│   │   ├── models/
│   │   │   ├── user.model.ts
│   │   │   ├── api-response.model.ts       ← ApiResponse<T>, PagedResponse<T>
│   │   │   ├── pagination.model.ts
│   │   │   └── role.enum.ts
│   │   ├── pipes/
│   │   │   ├── date-format.pipe.ts
│   │   │   ├── truncate.pipe.ts
│   │   │   └── status-label.pipe.ts
│   │   ├── directives/
│   │   │   ├── has-role.directive.ts       ← *appHasRole="['ADMIN']"
│   │   │   └── click-outside.directive.ts
│   │   ├── validators/
│   │   │   ├── password-match.validator.ts
│   │   │   └── strong-password.validator.ts
│   │   └── utils/
│   │       ├── date.utils.ts
│   │       ├── string.utils.ts
│   │       └── jwt.utils.ts
│   │
│   ├── app.routes.ts                       ← root routes, layouts as parents
│   └── app.config.ts                       ← bootstrap config, interceptors registered here
│
└── environments/
    ├── environment.ts                      ← { production: false, apiUrl: '...' }
    └── environment.prod.ts                 ← { production: true,  apiUrl: '...' }
```

### Where does a new file go?

| What you are building | Where it goes |
|---|---|
| A new page / screen | `features/[name]/` |
| HTTP calls for a new resource | `api/[resource]-api.service.ts` |
| State + logic for a feature | `features/[name]/[name].service.ts` |
| A UI component used in 2+ features | `shared/components/` |
| A UI component used in 1 feature only | `features/[name]/[component]/` |
| A TypeScript interface / enum | `shared/models/` |
| A custom form validator | `shared/validators/` |
| A reusable pipe or directive | `shared/pipes/` or `shared/directives/` |
| Something app-wide (auth, loading, errors) | `core/services/` |
| A new route guard | `core/guards/` |

### Feature folder pattern (use for every new feature)

Every feature follows this exact internal structure:

```
features/[name]/
├── [name].routes.ts              ← route definitions for this feature
├── [name].service.ts             ← state + business logic, calls api/[name]-api.service.ts
├── [name]-list/
│   ├── [name]-list.component.ts
│   ├── [name]-list.component.html
│   └── [name]-list.component.css
├── [name]-detail/
│   ├── [name]-detail.component.ts
│   ├── [name]-detail.component.html
│   └── [name]-detail.component.css
└── [name]-form/
    ├── [name]-form.component.ts
    ├── [name]-form.component.html
    └── [name]-form.component.css  ← used for both create and edit
```

When generating a new file, always state its full path.
If a folder does not exist yet, say so explicitly.

---

## TypeScript rules

- Always use `strict: true` — no `any`, no `!` non-null assertions unless truly needed
- Prefer `readonly` on interface properties that never mutate
- Use `interface` for data shapes, `type` for unions
- All Observables must be typed: `Observable<AuthResponse>` not `Observable<any>`
- Every `subscribe()` must be unsubscribed — use `takeUntilDestroyed(this.destroyRef)` with `DestroyRef`
- Never use `tap()` for side effects that belong in the component

`takeUntilDestroyed` correct usage — never inject it directly:
```typescript
// ❌ Wrong
private readonly destroyRef = inject(takeUntilDestroyed);

// ✅ Correct
private readonly destroyRef = inject(DestroyRef);

someObservable$.pipe(
  takeUntilDestroyed(this.destroyRef)
).subscribe(...)
```

---

## Angular rules

- Use **standalone components** everywhere — no NgModules
- Use `inject()` function instead of constructor injection
- Use `signal()` for all local component state that affects the template — never plain class properties with OnPush
- Use `computed()` for derived values
- Use `HttpClient` only inside `api/` services — never in components or guards
- Routes must use `loadComponent` for lazy loading, not `loadChildren`
- Always add `changeDetection: ChangeDetectionStrategy.OnPush` to every component

### Component file separation rule

Always split into 3 separate files — never use inline `template` or `styles`:

```
[name].component.ts      ← class logic only, uses templateUrl + styleUrl
[name].component.html    ← template
[name].component.css     ← styles
```

```typescript
// ✅ Always use templateUrl and styleUrl
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  // ✅ Use signals for all state that the template reads
  isLoading = signal(false);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });
}
```

### Signal rules

With `ChangeDetectionStrategy.OnPush`, plain class properties do NOT trigger re-render.
Use `signal()` for every piece of state the template reads:

```typescript
// ❌ Won't update the template with OnPush
isLoading = false;
errorMessage = '';

// ✅ Will update the template
isLoading = signal(false);
errorMessage = signal('');

// Set:  this.isLoading.set(true)
// Read in template: [disabled]="isLoading()"
```

---

## CSS rules

- Plain CSS only — no SCSS, no Sass, no Less, no Tailwind
- Each component has its own `.css` file referenced via `styleUrl`
- Use CSS custom properties (`--color-primary`) for any value used in more than one place
- Class naming: BEM with kebab-case — `.login-form__error`, `.submit-button--loading`
- Never use inline `style=""` attributes in templates
- Never use `!important`
- CSS resets and global styles go in `src/styles.css` only — not in component files
- Component CSS is automatically scoped by Angular — no need for extra specificity

```css
/* ✅ Good — flat, scoped, uses custom properties */
.login-container {
  width: 100%;
}

.submit-button {
  padding: 0.75rem 1.5rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.submit-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
```

---



1. **Token storage**: always use `sessionStorage`, never `localStorage`
2. **Token reading**: all token access goes through `TokenService` — no direct `sessionStorage` calls anywhere else
3. **Interceptor**: `AuthInterceptor` attaches the token, handles 401 refresh + retry, then redirects to `/login` on second failure
4. **Refresh token**: only ever sent to `/auth/refresh` — the interceptor must NOT attach it to every request
5. **JWT decode**: only `TokenService` decodes the payload. Use it only for UI display (roles, username) — never for security decisions on the client
6. **No secrets in environment files**: `environment.ts` only holds `apiUrl` and feature flags

`TokenService` interface to respect:
```typescript
class TokenService {
  saveTokens(access: string, refresh: string): void
  getAccessToken(): string | null
  getRefreshToken(): string | null
  clearTokens(): void
  decodePayload(): JwtPayload | null   // returns { sub, roles, exp }
  isTokenExpired(): boolean
}
```

---

## HTTP & API layer rules

- `auth-api.service.ts` contains raw HTTP calls only — no `tap`, no `catchError`, no routing logic
- Every API method returns a typed `Observable<T>`
- Use `environment.apiUrl` as the base URL — never hardcode URLs
- Response models live in `shared/models/`

`AuthApiService` methods to respect:
```typescript
login(req: LoginRequest): Observable<AuthResponse>
register(req: RegisterRequest): Observable<AuthResponse>
refreshToken(token: string): Observable<{ accessToken: string }>
logout(): Observable<void>
requestPasswordReset(email: string): Observable<void>
```

---

## Forms rules

- **Reactive Forms only** — never Template-driven forms
- Validators: use built-in Angular validators + custom ones from `shared/validators/`
- Show validation errors only on `touched` state, not on `dirty`
- Never disable the submit button based on form validity alone — show inline errors instead
- Password fields: always use `strongPasswordValidator`
- Register form: always use `passwordMatchValidator` as a form-group-level validator

Error display pattern to follow:
```html
@if (form.get('email')?.touched && form.get('email')?.hasError('required')) {
  <span class="error">Email is required</span>
}
```

---

## Security rules

- **No user enumeration**: forgot-password form always shows a success message regardless of whether the email exists
- **No sensitive info in console.log** — remove all debug logs before asking for a review
- **CSRF**: `HttpClientXsrfModule` is configured in `app.config.ts` — don't remove it
- **Role guard**: reads roles from JWT payload via `TokenService.decodePayload()` — never from a local variable or component state

---

## Naming conventions

| Thing | Convention | Example |
|---|---|---|
| Components | PascalCase + suffix | `LoginComponent` |
| Services | PascalCase + suffix | `AuthService` |
| Files | kebab-case | `auth.service.ts` |
| Interfaces | PascalCase, no `I` prefix | `AuthResponse` |
| Observables | camelCase + `$` suffix | `currentUser$` |
| Signals | camelCase, no suffix | `isLoading` |
| Route paths | lowercase, hyphenated | `/forgot-password` |
| CSS classes | BEM, kebab-case | `.login-form__error` |
| CSS files | kebab-case, `.css` extension | `login.component.css` |

---

## What Claude should NOT do

- Do not use `NgModule` — this project uses standalone components only
- Do not use `localStorage` for tokens
- Do not put `HttpClient` calls inside components or guards
- Do not use `any` type
- Do not use constructor injection — use `inject()`
- Do not generate unit tests unless explicitly asked
- Do not add new dependencies (npm packages) without asking first
- Do not use template-driven forms
- Do not hardcode API URLs — always use `environment.apiUrl`
- Do not add `console.log` in generated code
- Do not use inline `template` or `styles` in `@Component` — always use `templateUrl` and `styleUrl`
- Do not use SCSS, Sass, or Less — plain CSS only
- Do not use inline `style=""` attributes in HTML templates
- Do not use plain class properties for state in OnPush components — use `signal()`
- Do not inject `takeUntilDestroyed` directly — inject `DestroyRef` and pass it as an argument

---

## How to respond to code requests

1. Always state which file(s) you are creating or editing and their full path
2. Generate complete files — no `// ... rest of the code` shortcuts
3. If a request is ambiguous, ask one clarifying question before generating
4. If the request would break one of the rules above, say so and suggest the correct approach
5. Add a short comment block at the top of each generated file explaining its responsibility

---

## Auth flow reference

```
LoginComponent
  → AuthService.login(credentials)
    → AuthApiService.login()        (HTTP POST /auth/login)
    → TokenService.saveTokens()
    → Router.navigate(['/dashboard'])

Every HTTP request
  → AuthInterceptor clones request + adds Bearer token
  → On 401: AuthApiService.refreshToken() → retry once → on fail: Router /login

Route change
  → authGuard checks TokenService.isTokenExpired()
  → roleGuard checks TokenService.decodePayload().roles
```