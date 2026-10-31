# Testing APIForge

APIForge separates fast generator checks from tests that install and run generated projects.
Run commands from the repository root.

## Generator tests

```sh
npm test
```

This checks generated source, configuration, dependency selection, documentation, and CLI help.
It does not discover tests inside generated sample projects.

## Generated-app integration tests

```sh
npm run test:integration
npm run test:features
```

The integration command creates temporary projects, installs their dependencies, starts the
generated server, and verifies the health endpoint. The feature command checks generated syntax and
dependency selection across the optional features on the required Express baseline, then verifies
authenticated and unauthenticated Socket.IO handshakes. They need npm registry access and may take
several minutes.

## Database/ORM smoke tests

The database test creates a temporary project for one database/ORM pair, installs its packages,
sets up the ORM, then connects and runs `SELECT 1` (or a MongoDB ping). Supply a database that is
already running and a URL for it:

```sh
API_FORGE_TEST_DATABASE=MySQL \
API_FORGE_TEST_ORM=Sequelize \
API_FORGE_TEST_URL='mysql://root:password@127.0.0.1:3306/api_forge_test' \
npm run test:database
```

Supported SQL database names are `PostgreSQL`, `MySQL`, and `SQLite`; supported SQL ORMs are
`Prisma`, `Drizzle`, `TypeORM`, and `Sequelize`. For MongoDB, set
`API_FORGE_TEST_DATABASE=MongoDB`, `API_FORGE_TEST_ORM=Mongoose`, and
`API_FORGE_TEST_URL` to a MongoDB connection string. The database must exist and the supplied user
must have access. Encode reserved URL characters in credentials.

PowerShell example:

```powershell
$env:API_FORGE_TEST_DATABASE = "MySQL"
$env:API_FORGE_TEST_ORM = "Sequelize"
$env:API_FORGE_TEST_URL = "mysql://root:password@127.0.0.1:3306/api_forge_test"
npm run test:database
```

To run the database matrix locally, start the matching test services with Docker Compose:

```sh
docker compose -f docker-compose.test.yml up -d --wait mysql
```

Use `postgres` or `mongo` instead of `mysql` for those services. Stop them after testing with:

```sh
docker compose -f docker-compose.test.yml down
```

