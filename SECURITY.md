# Security Policy — STEELSCAN

## 🔒 Reporting a Vulnerability

We take the security of STEELSCAN seriously. If you discover a security vulnerability, please do NOT open a public issue. Instead, report it privately to the repository maintainer or email:
**security@steelscan.local** (or directly contact the project maintainer).

Please provide:
- Description of the vulnerability.
- Steps or proof-of-concept to reproduce the issue.
- Potential impact on factory floor data and OCR endpoints.

---

## 🛡️ Deployment Hardening Checklist

When deploying STEELSCAN to cloud or plant floor environments (Render, Vercel, Docker, On-Prem Kiosks):

### 1. Database & Persistence
- **PostgreSQL Connection**: Set `DATABASE_URL` to a hosted PostgreSQL instance (e.g. Render PostgreSQL). The application normalizes `postgres://` or `postgresql://` URIs to `postgresql+psycopg2://`.
- **Database Schema & Migrations Note**: Older local SQLite database files (e.g. `steelscan.db`) must be deleted and recreated with the updated schema. Automatic schema migrations via Alembic will be introduced in Phase 4.
- **Engine Resiliency**: SQLAlchemy engine runs with `pool_pre_ping=True` to automatically handle recycled connections.

### 2. Secrets & Admin Provisioning
- **`SECRET_KEY`**: Generate a strong 256-bit cryptographically random secret (`openssl rand -hex 32`) and configure it in the backend environment. Placeholder and default keys cause startup to fail in production (`APP_ENV=production`).
- **Initial Administrator**: Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` (minimum 10 characters, not blacklisted). If `APP_ENV=production`, no admin exists, and `ADMIN_PASSWORD` is missing, startup fails immediately. Default accounts with hardcoded passwords (`admin`/`admin123`, `employee`/`employee123`) have been removed.
- **First Login Password Rotation**: All initial or admin-reset accounts are created with `must_change_password=True`. Operators and administrators must change passwords immediately upon first login; access to operational endpoints (`/scan`, `/records`) is denied until changed.
- **Token Rotation & Reuse Detection**: Refresh tokens are stored as SHA-256 hashes in the database. Rotating refresh tokens invalidates the used token, and any detected token reuse revokes the entire active token family.
- **Session Termination & Deactivation**: Logging out, changing password, or administrative deactivation revokes all active refresh tokens immediately. Deactivated users are rejected on every request.

### 3. Network, CORS & Reverse Proxy
- **`FRONTEND_ORIGIN`**: Explicitly specify authorized frontend domains (e.g. `https://steelscan.vercel.app`). Wildcard `*` origins fail startup in production.
- **Proxy Header Trust**:
  - `TRUST_PROXY_HEADERS` (default `false`): Enables parsing `X-Forwarded-For` counting from the right by `PROXY_HOPS`.
  - `PROXY_HOPS` (default `1`): Number of upstream reverse proxy hops.
  - `TRUST_CF_HEADER` (default `false`): Enables reading `CF-Connecting-IP` behind Cloudflare.

### 4. Rate Limiting & Quota Protection
- **Rate Limits**: IP-based rate limiting on `/auth/login` (`10/minute`), user-ID-based rate limiting on `/scan` (`20/minute`).
- **Account Lockout**: Automatically locks out accounts for 15 minutes after 5 consecutive failed login attempts.
- **Vision AI Quota**: Persistent daily quota tracker in the database (`DAILY_VISION_CALL_CAP`, default 500/day) with `VISION_AI_ENABLED` toggle. When reached or disabled, falls back directly to local OCR without quota burn.

### 5. Input & Upload Validation
- Uploaded images undergo multi-layer verification:
  - Allowed MIME types: JPEG, PNG, WebP.
  - File size cap: 5 MB default (`MAX_UPLOAD_BYTES`).
  - Pillow image verification: header inspection, format validation, dimension checks (max 4096x4096px) before full decode, and `Image.MAX_IMAGE_PIXELS` set to prevent decompression bomb DoS attacks.

---

## ⚠️ Known Limitations & Architectural Notes

1. **Browser `localStorage` Token Storage**:
   - The React frontend stores the access token and refresh token in browser `localStorage` for PWA offline usability. While standard for many SPAs, `localStorage` is accessible by JavaScript. In Phase 4+, moving refresh tokens to HttpOnly, SameSite cookies is recommended.
2. **Account Lockout Denial-of-Service Risk**:
   - Because the login endpoint enforces temporary lockout after 5 consecutive failed attempts, a malicious actor who knows a target user's username could intentionally trigger a lockout by spamming incorrect passwords. Rate limiting per IP mitigates bulk attacks, but targeted account lockout is a known trade-off against brute-force password cracking.
3. **Legacy Git History & Leaked Credentials**:
   - An early prototype commit in git history contained a local MySQL root connection string used during initial development. While that local database was never exposed to the public internet, the password in git history must be treated as permanently compromised and never reused anywhere.
4. **Free-Tier Cold Starts & Ephemeral Storage**:
   - On free hosting tiers (such as Render Free Tier), backend containers sleep after inactivity and spin up on incoming requests (30-50s cold start). The Axios client has a 30-second timeout with friendly retry notices.
   - Without an external PostgreSQL `DATABASE_URL`, local SQLite instances are ephemeral and wiped on restart. Persistent deployments require a managed PostgreSQL instance.
