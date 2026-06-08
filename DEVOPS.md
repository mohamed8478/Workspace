# DevOps and DevSecOps

This folder is a safe copy of the project. The original project is not required for these Docker, CI, and security checks.

## Docker

Run the full stack:

```bash
docker compose up --build
```

Services:

- Frontend: `http://localhost:4200`
- Backend: `http://localhost:8080`
- MySQL: `localhost:3306`

## Files Added

- `frontend/Dockerfile`
- `frontend/nginx.conf`
- `Backend/Dockerfile`
- `docker-compose.yml`
- `.env.example`
- `.github/workflows/ci.yml`
- `.github/workflows/devsecops.yml`

## CI

The CI workflow checks that:

- the Angular frontend builds
- the Spring Boot backend builds
- both Docker images build

There is no deployment step.

## DevSecOps

The DevSecOps workflow runs:

- Gitleaks secret scanning
- `npm audit` for frontend dependency vulnerabilities
- OWASP Dependency Check for backend dependencies
- Trivy scans for Docker images

The security workflow is currently non-blocking with `continue-on-error: true`. This is intentional for the first version because the project already contains hardcoded keys that should be reported first, then fixed safely.

## Security Notes

Do not commit real secrets in:

- `application.yml`
- Angular environment files
- `.env`

Use `.env.example` for documentation only. Real values should stay in a local `.env` file or GitHub repository secrets.
