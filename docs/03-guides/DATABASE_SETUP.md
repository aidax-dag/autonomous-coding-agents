# Database Setup Guide

This guide covers configuring the ACA persistence layer for development, staging, and production environments. The system supports three database engines: **InMemory** (default), **SQLite**, and **PostgreSQL**.

---

## Quick Start (InMemory -- Development)

No configuration is needed. When no database engine is specified, ACA uses an in-memory store that resets on each restart. This is suitable for local development and running tests.

```bash
# Start the API server with default in-memory database
npm run dev:api
```

There are no environment variables to set. All data lives in process memory and is lost when the server stops.

---

## SQLite Setup (Single-Node / Local Deployment)

SQLite is a good choice for single-node deployments, CI pipelines, or local environments where you need data persistence without running a separate database server.

### Prerequisites

Install the optional SQLite driver:

```bash
npm install better-sqlite3
```

### Configuration

Set the following environment variables (or add them to your `.env` file):

| Variable | Value | Description |
|---|---|---|
| `DB_ENGINE` | `sqlite` | Selects the SQLite driver |
| `DB_FILE_PATH` | `./data/aca.db` | Path to the database file |

```bash
# .env
DB_ENGINE=sqlite
DB_FILE_PATH=./data/aca.db
```

SQLite defaults to WAL (Write-Ahead Logging) journal mode and enables foreign key constraints automatically.

### Run Migrations

```bash
npm run db:migrate
```

### Verify

```bash
npm run db:status
```

---

## PostgreSQL Setup (Production / Multi-Node)

PostgreSQL is recommended for production deployments, multi-node setups, and environments that require full ACID compliance with concurrent access.

### Prerequisites

Install the optional PostgreSQL driver:

```bash
npm install pg
```

### Configuration

Set the following environment variables:

| Variable | Value | Description |
|---|---|---|
| `DB_ENGINE` | `postgres` | Selects the PostgreSQL driver |
| `DB_CONNECTION_STRING` | `postgresql://aca:aca_dev@localhost:5432/aca` | PostgreSQL connection URI |

Optional tuning variables:

| Variable | Default | Description |
|---|---|---|
| `DB_MAX_CONNECTIONS` | `5` | Maximum connection pool size |

```bash
# .env
DB_ENGINE=postgres
DB_CONNECTION_STRING=postgresql://aca:aca_dev@localhost:5432/aca
DB_MAX_CONNECTIONS=10
```

### Start PostgreSQL with Docker Compose

The project includes a PostgreSQL service in `docker-compose.yml` under the `database` and `full` profiles.

```bash
# Start only the PostgreSQL container
docker compose --profile database up -d

# Or start everything (API + web + PostgreSQL + observability)
docker compose --profile full up -d
```

The default credentials are:

| Parameter | Value |
|---|---|
| User | `aca` |
| Password | `aca_dev` (override with `POSTGRES_PASSWORD` env var) |
| Database | `aca` |
| Port | `5432` (override with `POSTGRES_PORT` env var) |

For production, always override the password:

```bash
POSTGRES_PASSWORD=your_secure_password docker compose --profile database up -d
```

### Run Migrations

```bash
npm run db:migrate
```

### Verify Connection

```bash
npm run db:status
```

You can also check the database health endpoint once the API server is running:

```bash
curl http://localhost:3000/api/db/health
```

Expected response when healthy:

```json
{
  "status": "healthy",
  "engine": "postgres",
  "connected": true,
  "reachable": true,
  "latencyMs": 1.23,
  "checkedAt": "2026-02-15T12:00:00.000Z"
}
```

---

## Migration Commands

The project provides three migration CLI commands through npm scripts. They all read database configuration from environment variables.

### Run Pending Migrations

```bash
npm run db:migrate
```

Applies all unapplied migrations in version order. Safe to run multiple times -- already-applied migrations are skipped.

### Check Migration Status

```bash
npm run db:status
```

Shows the current schema version, applied migrations with timestamps, and any pending migrations that have not been applied yet.

### Rollback Migrations

```bash
# Rollback the last applied migration
npm run db:rollback

# Rollback the last 3 migrations (pass count via --)
npx tsx scripts/db-migrate.ts rollback 3
```

Rollback executes the `down()` function of each migration in reverse order.

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `DB_ENGINE` | No | `memory` | Database engine: `memory`, `sqlite`, or `postgres` |
| `DB_FILE_PATH` | SQLite only | `:memory:` | File path for SQLite database |
| `DB_CONNECTION_STRING` | PostgreSQL only | -- | PostgreSQL connection URI |
| `DB_MAX_CONNECTIONS` | No | `5` | Maximum pool size for PostgreSQL |
| `DATABASE_URL` | No | -- | Alternative to `DB_CONNECTION_STRING` (used by migration CLI) |
| `POSTGRES_PASSWORD` | No | `aca_dev` | Password for Docker Compose PostgreSQL service |
| `POSTGRES_PORT` | No | `5432` | Host port mapping for Docker Compose PostgreSQL service |

---

## DB Health Check Endpoint

The API server exposes a dedicated database health endpoint:

```
GET /api/db/health
```

This endpoint is unauthenticated (like `/api/health`) so load balancers and monitoring probes can reach it.

**Response Fields:**

| Field | Type | Description |
|---|---|---|
| `status` | `string` | `healthy`, `degraded`, or `unhealthy` |
| `engine` | `string` | `sqlite`, `postgres`, or `memory` |
| `connected` | `boolean` | Whether the client is connected |
| `reachable` | `boolean` | Whether SELECT 1 succeeded |
| `latencyMs` | `number` | Probe latency in milliseconds |
| `checkedAt` | `string` | ISO 8601 timestamp |
| `error` | `string?` | Error message when unhealthy |

**HTTP Status Codes:**

- `200` -- Database is healthy and reachable
- `503` -- Database is unreachable or not connected

---

## Docker Compose Usage

### Profiles

The PostgreSQL service is gated behind Docker Compose profiles to keep the default `docker compose up` lightweight.

| Profile | Services Started |
|---|---|
| *(none)* | `api`, `web` |
| `database` or `db` | `api`, `web`, `postgres` |
| `observability` | `api`, `web`, `jaeger`, `prometheus`, `grafana` |
| `full` | All services |

```bash
# Development with PostgreSQL only
docker compose --profile database up -d

# Full stack
docker compose --profile full up -d

# Stop everything
docker compose --profile full down
```

### Persistent Volumes

PostgreSQL data is stored in the `aca-pgdata` Docker volume. To reset the database:

```bash
docker compose --profile database down -v
```

This removes the volume and all data.

---

## Troubleshooting

### "Failed to connect to SQLite"

- Verify `better-sqlite3` is installed: `npm ls better-sqlite3`
- Ensure the directory in `DB_FILE_PATH` exists and is writable
- On Apple Silicon, `better-sqlite3` requires a native rebuild: `npm rebuild better-sqlite3`

### "Failed to connect to PostgreSQL"

- Verify `pg` is installed: `npm ls pg`
- Confirm PostgreSQL is running: `docker compose --profile database ps`
- Test connectivity: `pg_isready -h localhost -p 5432 -U aca`
- Check the connection string format: `postgresql://user:password@host:port/database`

### "Database client is not connected"

- The database client must call `connect()` before queries. This happens automatically during server startup when `DB_ENGINE` is configured.
- If using the migration CLI, ensure environment variables are set before running `npm run db:migrate`.

### Migration "Table already exists" Errors

- Migrations use `CREATE TABLE IF NOT EXISTS` to be idempotent. If you see this error, the migration file may have a plain `CREATE TABLE` statement. Update it to include `IF NOT EXISTS`.

### Connection Pool Exhaustion (PostgreSQL)

- Increase `DB_MAX_CONNECTIONS` if you see timeout errors under load.
- Monitor active connections: `SELECT count(*) FROM pg_stat_activity WHERE datname = 'aca';`
- The default pool size of 5 is appropriate for development. Production deployments with multiple API instances should set this to 10-20 per instance, keeping total connections below PostgreSQL's `max_connections` (default 100).

### Docker Compose PostgreSQL Not Starting

- Check logs: `docker compose --profile database logs postgres`
- Ensure port 5432 is not already in use: `lsof -i :5432`
- If the volume is corrupted, reset it: `docker compose --profile database down -v && docker compose --profile database up -d`
