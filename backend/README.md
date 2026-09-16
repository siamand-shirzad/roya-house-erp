# Roya House backend

Express + TypeScript + PostgreSQL through `pg`. Prisma files are legacy references, not the running ORM or migration system.

See the [root README](../README.md) for local setup and isolated integration testing, and [DEPLOY.md](../DEPLOY.md) for deployment.

- `npm run dev`: development server on port 4000 by default.
- `npm run build`: TypeScript production build.
- `npm start`: run the compiled server.
- `npm run db:setup`: apply schema and seed catalog/sample records; check the target database first.
- `npm run test:integration`: compile and exercise document concurrency and pricing against the dedicated local test database.
- `npm run hash-password`: existing administrator password reset utility.

Required environment: `DATABASE_URL`. Optional: `PORT`, `CORS_ORIGIN`. The actual schema is `src/lib/db.ts`; startup applies its idempotent DDL. No Prisma migrate/studio scripts exist.
