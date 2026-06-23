# YO STUDIOS API

Production-oriented modular backend for the YO STUDIOS commerce platform. The static `/frontend` consumes its versioned API without coupling visual components to backend internals.

## Security model

- Prices, product state and inventory are read only from PostgreSQL.
- Passwords and refresh secrets are hashed with Argon2id.
- Access tokens are short-lived JWTs. Refresh tokens are rotated and stored only as hashes.
- Reuse of a valid revoked refresh token revokes every active session for that user.
- Authentication is required globally; public routes are explicitly marked.
- Admin controllers require `ADMIN` or `SUPER_ADMIN`.
- Creating, promoting, demoting or disabling administrators requires `SUPER_ADMIN`.
- Profile, address, cart and order queries always scope database access by the authenticated user ID.
- Checkout recalculates prices and conditionally reserves inventory in one serializable transaction.
- Only a verified payment-provider webhook can transition an order to `PAID`.
- Payment webhooks are idempotent by `(provider, providerEventId)` and payload hash.
- The default Grow provider is fail-closed: it rejects sessions and webhooks until the official adapter is configured.
- Pino logs redact authorization and cookie headers. Every response carries `x-correlation-id`.
- Administrator accounts support TOTP authenticator 2FA. No access or refresh token is issued before the second factor succeeds.
- Failed login counters and temporary account locks are persisted in PostgreSQL; admin accounts lock sooner than customer accounts.
- Privileged users can inspect and revoke their active sessions. Role changes revoke the affected user's sessions immediately.
- `AdminAuditLog` is append-only at the PostgreSQL level: application UPDATE and DELETE operations are rejected by triggers.
- SUPER_ADMIN role or activation changes require the operator's current password again.

## API contract

All business APIs are versioned under `/api/v1`.

### Public

- `GET /health`
- `GET /api/v1/products`
- `GET /api/v1/products/:slug`
- `GET /api/v1/seasons`
- `GET /api/v1/seasons/featured/current`
- `GET /api/v1/seasons/preview/:slug?token=...`
- `GET /api/v1/seasons/:slug`
- `GET /api/v1/shipping/options`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/password-reset/request`
- `POST /api/v1/auth/password-reset/confirm`
- `POST /api/v1/auth/email/verify`
- `POST /api/v1/payments/webhooks/grow` (signature verification is mandatory)
- `GET /api/v1/game-assets/:id/image`
- `GET /api/v1/game-assets/levels/active`

### Customer account

- `GET/PATCH /api/v1/users/me`
- `GET/POST /api/v1/users/me/addresses`
- `PATCH/DELETE /api/v1/users/me/addresses/:id`
- `GET /api/v1/users/me/orders`
- `GET /api/v1/cart`
- `POST /api/v1/cart/items`
- `PATCH/DELETE /api/v1/cart/items/:id`
- `DELETE /api/v1/cart`
- `POST /api/v1/orders/checkout`
- `POST /api/v1/shipping/quote`
- `GET /api/v1/orders/:id`
- `POST /api/v1/payments/orders/:orderId/session`

Checkout requires an `Idempotency-Key` header with 16–128 safe characters.

### Administration

- `GET/POST/PATCH /api/v1/admin/products...`
- `GET/POST/PATCH /api/v1/admin/seasons...`
- `POST /api/v1/admin/seasons/:id/preview-token`
- `GET/POST/PATCH /api/v1/admin/shipping...`
- `PATCH /api/v1/admin/products/variants/:id/inventory`
- `GET/PATCH /api/v1/admin/orders...`
- `GET/PATCH /api/v1/admin/users...`
- `GET/DELETE /api/v1/admin/security/sessions...`
- `POST /api/v1/admin/security/sessions/revoke-others`
- `POST /api/v1/admin/security/mfa/enroll|confirm|disable`

The Game Asset/Level Editor is intentionally stricter than the rest of the admin area: every
`/api/v1/admin/game-editor/*` route requires `SUPER_ADMIN`. It stores validated PNG data and
versioned mask/level JSON separately. Built-in assets may be reconfigured but cannot be deleted.

To grant administrator access, sign in as `SUPER_ADMIN`, open **USERS**, select `ADMIN` for the target account, click **SAVE**, and confirm with the current super-admin password. The backend rejects this operation from an ordinary `ADMIN`, records the action, and revokes the target user's existing sessions. Grant `SUPER_ADMIN` only to an emergency owner account.

Swagger is available at `/api/docs` only when `NODE_ENV=development`, `ENABLE_SWAGGER=true`, and the optional `@fastify/static` package is installed.

## Local setup

1. Copy `.env.example` to `.env` and replace every placeholder secret.
2. Start PostgreSQL with `docker compose up postgres -d` from the repository root.
3. Install dependencies with `pnpm install` in `/backend`.
4. Run `pnpm prisma:deploy`, then `pnpm prisma:seed` if sample data is wanted.
5. Start the API with `pnpm dev`.

Use at least 32 cryptographically random characters for `JWT_ACCESS_SECRET`. Grow credentials remain empty until the official merchant documentation and webhook signing rules are supplied.
Generate a separate MFA encryption key with 32 cryptographically random bytes and store its base64 value in `MFA_ENCRYPTION_KEY`. Never reuse the JWT secret and never rotate this key without a controlled MFA re-enrollment migration.

Production still requires infrastructure credentials outside this repository: Redis for distributed rate limiting, an S3/R2 bucket for scanned image uploads, an email provider for alerts and verification, and Cloudflare/WAF configuration at the DNS/proxy layer. The API fails closed where provider credentials are absent; these services cannot be activated safely with invented credentials.

Serve `/frontend` over HTTP (for example on `http://localhost:4173`) rather than opening HTML through `file://`. On localhost the frontend uses `http://localhost:3000/api/v1`; in production it defaults to the same-origin `/api/v1` reverse-proxy path. Set `window.YO_API_BASE` before `api.js` only when the deployment uses a different API origin.

## Database and tests

- Production database: PostgreSQL only.
- Prisma schema: `prisma/schema.prisma`.
- Migrations: `prisma/migrations/*/migration.sql`.
- Unit tests: `pnpm test`.
- PostgreSQL integration tests: migrate a dedicated database whose name contains `test`, set `TEST_DATABASE_URL`, then run `pnpm test:integration`.
- Build: `pnpm build`.

The test suite covers refresh-token reuse, RBAC, cart inventory validation, atomic checkout failure and fail-closed payment webhook handling.
