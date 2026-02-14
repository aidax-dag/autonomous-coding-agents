# Database Operations Guide

ACA supports three database backends: InMemory (default), SQLite (local development), and PostgreSQL (production).

## Engine Selection

| Environment | Engine | Use Case |
|-------------|--------|----------|
| Testing / CI | `memory` | Fast, no dependencies, default |
| Local development | `sqlite` | Persistent, zero infrastructure |
| Production | `postgres` | Scalable, concurrent access |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_ENGINE` | Database engine: `memory`, `sqlite`, `postgres` | `memory` |
| `DB_FILE_PATH` | SQLite file path | `./data/aca.db` |
| `DB_CONNECTION_STRING` | PostgreSQL connection URI | — |
| `DB_MAX_CONNECTIONS` | PostgreSQL pool max connections | `5` |
| `DB_ENABLE_WAL` | SQLite WAL mode | `true` |

## ServiceRegistry Configuration

```typescript
import { ServiceRegistry } from './src/core/services/service-registry';

const registry = ServiceRegistry.getInstance();

// SQLite (local)
await registry.initialize({
  enablePersistence: true,
  dbConfig: {
    engine: 'sqlite',
    filePath: './data/aca.db',
    enableWAL: true,
  },
});

// PostgreSQL (production)
await registry.initialize({
  enablePersistence: true,
  dbConfig: {
    engine: 'postgres',
    connectionString: process.env.DB_CONNECTION_STRING,
    maxConnections: 10,
  },
});
```

## Docker Compose (PostgreSQL)

Start the PostgreSQL service:

```bash
# Start postgres only
docker compose --profile db up -d postgres

# Start all services including postgres
docker compose --profile full up -d
```

Default credentials:
- Database: `aca`
- User: `aca`
- Password: `aca_dev` (override with `POSTGRES_PASSWORD`)
- Port: `5432` (override with `POSTGRES_PORT`)

Connection string: `postgresql://aca:aca_dev@localhost:5432/aca`

## Migrations

Migrations are managed by `MigrationEngine` and run automatically on startup when persistence is enabled.

### Manual Migration

```typescript
import { createMigrationEngine } from './src/core/persistence/migration-engine';
import * as schema001 from './migrations/001_initial_schema';

const engine = createMigrationEngine(dbClient);
engine.addMigration({
  version: schema001.id,
  name: schema001.name,
  up: schema001.up,
  down: schema001.down,
});

// Apply pending migrations
await engine.migrate();

// Check status
const status = await engine.getStatus();

// Rollback last migration
await engine.rollback();
```

### Schema (001_initial_schema)

Tables created:
- `tasks` — Work items (id, description, status, team, timestamps)
- `sessions` — Agent working sessions (id, project_root, timing, metadata)
- `agent_logs` — Activity logs (id, session_id, agent_type, action, timestamp)

## Health Check

```typescript
const client = registry.getDBClient();
if (client?.isConnected()) {
  // For PostgresClient: await client.healthCheck()
  // For SQLiteClient: client.healthCheck() (synchronous)
}
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `CONNECT_ERROR` | Database unreachable | Check connection string, ensure DB is running |
| `Cannot find module 'pg'` | Missing dependency | `npm install pg` |
| `Cannot find module 'better-sqlite3'` | Missing dependency | `npm install better-sqlite3` |
| `SQLITE_BUSY` | Concurrent writes | Enable WAL mode (`enableWAL: true`) |
| Pool exhaustion | Too many connections | Increase `maxConnections` or check for leaks |
