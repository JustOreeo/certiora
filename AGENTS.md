# Certiora — Multi-Tenant EdTech Assessment Platform

## Cursor Cloud specific instructions

### Services overview

| Service | Command | Port | Required |
|---|---|---|---|
| Next.js app | `npm run dev` | 3000 | Yes |
| PostgreSQL | system service | 5432 | Yes |
| BullMQ worker | `npm run worker` | N/A | No (needs Redis) |

### Starting PostgreSQL

```
sudo pg_ctlcluster 16 main start
```

Database: `certiora`, user: `certiora`, password: `certiora_dev`. Connection string is in `.env` as `DATABASE_URL`.

### Running the app

Standard commands from `package.json`:
- **Dev server:** `npm run dev`
- **Lint:** `npm run lint`
- **Tests:** `npm run test`
- **Seed DB:** `NODE_ENV=development npm run db:seed`
- **Prisma studio:** `npm run db:studio`

### Gotchas

- ESLint config (`.eslintrc.json`) must exist before `npm run lint` works; without it, `next lint` prompts interactively and hangs.
- The seed script requires `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` environment variables and `NODE_ENV=development` to create test tenants.
- Two pre-existing test failures in `src/lib/fsrs/__tests__/scheduler.test.ts` (FSRS scheduler edge cases) — these are not caused by environment setup.
- Redis, S3, Upstash, and OpenAI are all optional; the app degrades gracefully without them.

### Seeded test accounts

| Role | Email | Password | Tenant slug |
|---|---|---|---|
| Super Admin | admin@certiora.dev | AdminPass123! | N/A |
| Tenant Admin | admin@review-center-1.com | Admin123! | review-center-1 |
| Student | student1@review-center-1.com | Student123! | review-center-1 |
