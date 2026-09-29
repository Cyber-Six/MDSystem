# Docker deployment

The Compose stack runs the patient API and portal, staff API and portal, email worker, PostgreSQL, and Redis. SMTP and the chatbot remain external. On the Raspberry Pi, keep Cloudflare Tunnel on the host and route the patient hostname to `http://127.0.0.1:3000` and staff hostname to `http://127.0.0.1:3001`.

## Prerequisites

- Docker Engine with the Compose plugin (Docker Desktop on Windows, Docker Engine on Raspberry Pi OS).
- A complete, plain SQL `schema.psql` containing the tables and required reference data. The existing `Backend/config/data/post_build_setup.sql` is supplemental and is not the initial schema.
- SMTP credentials and the application's existing required secrets. Preserve `JWT_SECRET` and `TOTP_ENCRYPTION_KEY` when continuing to use existing application data.
- On Windows, use Docker Desktop with Linux containers enabled.

Copy `.env.example` to `.env`, fill in private values, then set `SCHEMA_SQL_PATH` to the absolute path of the schema file. Use forward slashes in Windows paths (for example `D:/secure/mdsystem/schema.psql`). Never commit `.env` or the database schema.

Generate a 64-character hex TOTP key with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Set distinct, long random values for PostgreSQL, Redis, and JWT credentials. Set `VITE_GOOGLE_CLIENT_ID` and `VITE_RECAPTCHA_SITE_KEY` before building if those browser features are enabled. These two Vite values are embedded in the public browser bundle; do not put secrets there.

## First start

Run each command separately. Do not concatenate commands such as `docker compose psdocker compose down`.

Build the three application images:

```sh
docker compose --profile setup build
```

Start PostgreSQL and Redis first:

```sh
docker compose up -d postgres redis
docker compose ps
```

Wait until both services show `healthy`, then initialize the database:

```sh
docker compose --profile setup run --rm schema-init
```

The one-shot schema initializer waits for PostgreSQL, executes the mounted schema, then executes `Backend/config/data/post_build_setup.sql`, and finally runs the root `startup.sql` first-admin bootstrap. The default bootstrap account is `mdsystem@tip.edu.ph` with initial password `mdsystem`; only its bcrypt hash is stored. Change this password immediately after first login and complete the normal admin transfer process for the real administrator. Override `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH` in `.env` when deploying elsewhere. All configured steps must finish successfully before initialization is marked complete.

Start the application services:

```sh
docker compose up -d patient staff email-worker
docker compose ps
```

All services can also be started in one command after the schema has been initialized:

```sh
docker compose up -d
```

The `setup` profile is intended for the explicit one-shot schema command and is not required for routine starts.

The initializer executes the supplied file as-is, so it must be plain SQL that targets the configured database and must not create/switch databases or rely on interactive `psql` commands. Test it against a disposable PostgreSQL database first. PostgreSQL's own data-directory initialization only runs when its data volume is empty.

For routine subsequent starts, use `docker compose up -d`. To rebuild changed application code, use `docker compose build patient staff email-worker` and then `docker compose up -d patient staff email-worker`. Compose publishes only loopback ports. For local patient access open `http://localhost:3000`; for the staff portal use `http://staff.localhost:3001` so the backend recognizes the staff hostname. Configure local CORS origins accordingly.

Check the running stack with:

```sh
docker compose ps
docker compose logs --tail=100 patient staff email-worker
curl -I http://localhost:3000
curl -I http://localhost:3001
```

PostgreSQL and Redis checks are:

```sh
docker compose exec postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"
docker compose exec redis sh -c 'redis-cli --user "$REDIS_USERNAME" -a "$REDIS_PASSWORD" ping'
```

The Redis command must be run inside the container. Git Bash does not automatically export variables from `.env` into your shell.

`docker compose restart patient staff email-worker` only restarts existing containers. If `docker compose ps` is empty because you previously ran `docker compose down`, use `docker compose up -d patient staff email-worker` instead. `docker compose down` removes containers and the network but preserves named volumes. Use `docker compose down -v` only when intentionally deleting the database, Redis, media, and schema-state volumes.

## Configuration and data

Compose sets PostgreSQL and Redis hostnames to their service names and binds application servers to `0.0.0.0` inside the containers. Ensure `.env` contains the required configuration listed in `Backend/config/config.js`, including SMTP credentials, JWT secret, Redis credentials, and TOTP encryption key. Redis uses authenticated ACL access, append-only persistence, and `noeviction` for BullMQ. Keep Redis's configured username/password consistent with the app.

PostgreSQL, Redis, media uploads, and schema initialization state live in named volumes. The patient and staff services share the media volume so uploads are visible through either portal. Logs go to the container console. Use `docker compose logs -f patient staff email-worker postgres redis` to inspect them.

Back up PostgreSQL with `docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > mdsystem.sql` from a shell that has the matching variables loaded. Back up the `media-data` volume as well. To restore, stop the app services, restore the SQL dump into PostgreSQL, restore media files, and start the app services. Keep backup files outside the repository.

## Operations and current limits

- `docker compose down` stops and removes containers and the network while preserving named volumes.
- `docker compose down -v` deletes persistent database, Redis, media, and initialization data; use only when intentionally discarding all local data.
- The current Express servers have no dedicated readiness endpoints or container health checks. Compose checks PostgreSQL and Redis readiness before starting dependent services; check app logs and portal/API routes to verify application startup.
- Application images use Node 22 and include native `canvas` runtime libraries. Build/test on both `linux/amd64` (Docker Desktop) and `linux/arm64` (Pi); native dependencies can expose architecture-specific issues.
- Cloud hosting is outside this setup. Keep the host Cloudflare Tunnel ingress pointing at the loopback ports above.
