# CI and deployment

The CI workflow runs the mocked hosted GUI smoke job and a disposable database-backed Playwright core gate on trusted `deployment` pushes. After all checks pass, that push resets the Pi use-case database and recreates its services from the tested image. Fork pull requests run hosted checks only. See [Playwright GUI and E2E testing](PLAYWRIGHT_E2E.md) for SQL configuration and manual core/full runs.

This repository uses GitHub Actions for continuous integration and for a controlled staging-to-production release. The workflow files are in `.github/workflows/`.

## Before the first run

1. Push or merge `.github/workflows/ci.yml`, `.github/workflows/playwright-e2e.yml`, and `.github/workflows/publish-and-deploy.yml` to the repository default branch. Until then, GitHub may not list the manually triggered workflows.
2. In GitHub, open **Settings → Environments** and create `staging`, `use-case-testing`, and `production`. Add the variables and secrets listed below to `staging` and `production`. Add required reviewers to `use-case-testing` and `production`; production should also restrict eligible branches to the intended release branch.
3. Prepare and initialize both deployment hosts/directories as described under [Server preparation](#server-preparation). Each directory must have its own `.env`, `compose.yaml`, database, Redis, and media volume. Test that the configured SSH user can run `docker compose` on each host and that it can pull the image from GHCR.
4. Confirm that GitHub Actions can reach each SSH host. GitHub-hosted runners need a reachable host; for a private host, arrange a protected self-hosted runner or approved VPN connection.
5. Enable GitHub Actions for the repository. The repository workflow permissions can remain read-only because this workflow declares its own `contents: read` and `packages: write` permissions.

The `CI` workflow runs mocked patient and staff GUI smoke tests on a GitHub-hosted Linux runner. Pushes and same-repository pull requests for `development` and `deployment` also run a Docker build and `npm run test:all` on the self-hosted Linux ARM64 runner. That command runs the Jest coverage gate and then the isolated Playwright core suite. The runner needs the Pi-local SQL paths in `e2e.private.env` and access to `/srv/projects/MDSystem`. Confirm the runner can run `docker info` and `docker compose version` without `sudo`. If the job stays queued, check that the runner is online and labeled `self-hosted`, `Linux`, and `ARM64`. Fork pull requests run the coverage gate and GUI smoke tests on a hosted runner. The separate release workflow uses hosted runners to verify and build multi-architecture release images.

## Run a release

1. In the repository on GitHub, select **Actions → Publish and deploy MDSystem → Run workflow**.
2. In **Use workflow from**, choose the branch to test and release. Start from a branch whose CI is passing. Production environment branch restrictions may reject a branch that is not allowed to deploy.
3. Enter a new, unique version such as `v0.9.6-beta.1`, then select **Run workflow**. Do not reuse a version that has already been published.
4. Watch the `Verify selected branch` job. It records the selected commit, runs the application test commands, builds the web portals, and builds the Docker image. Fix any failure before attempting deployment.
5. The `Build and deploy staging image` job publishes the `-staging` image and updates the staging host. Check the job logs and staging application logs, then run your use-case test checklist against the staging URLs.
6. When staging tests pass, open the pending `Use-case testing approval` job and approve it. If testing fails, reject or leave the job unapproved and fix the issue in a new run/version.
7. The `Build and deploy production image` job will then wait for any configured production reviewers. Approve it only when you want to release. It publishes and deploys the production image using production frontend URLs.
8. Confirm the production services with `docker compose ps` and inspect logs from the deployment host. Record the version and commit SHA for traceability.

If a job fails, open the run in **Actions**, select the failed job, and expand the failed step to read its logs. Missing variables/secrets, an unreachable SSH host, failed tests, or a server that cannot pull from GHCR are common setup causes. Correct the configuration and start a fresh run with a new version if an image was already published.

## How releases work

After coverage and the isolated core suite pass, a push to `development` deploys the tested image to the Pi and preserves database data. A push to `deployment` deploys the tested image after deleting the Pi use-case PostgreSQL and schema-state volumes and rerunning SQL setup. CI checks both portals and verifies the running containers' image revision. The separate publish-and-deploy workflow builds release images and requires both environment backend URLs to return HTTP 200 after deployment.

### Manually deploy or reset the Pi use-case environment

In **Actions > CI > Run workflow**, choose any branch containing the updated workflow under **Use workflow from**, then select `deploy` or `reset-database`. Pushes to branches other than `development` and `deployment` do not trigger Pi operations.

The `deploy` operation runs GUI smoke and application tests, builds the selected branch's image, and recreates the three application services while preserving database data. The `reset-database` operation reuses the installed `mdsystem:local` image and requires the exact confirmation `DELETE_DATABASE`. It stops the services, deletes the `mdsystem_postgres-data` and `mdsystem_schema-state` volumes, starts PostgreSQL and Redis, reruns the configured SQL setup, then starts the application services. This permanently deletes all PostgreSQL records and schema state. Redis and uploaded media volumes are preserved. Check the configured SQL paths before starting the reset.

To start a release, open **Actions → Publish and deploy MDSystem → Run workflow**. GitHub's **Use workflow from** selector chooses the source branch; enter a unique version such as `v0.9.6-beta.1`. The release checks that exact revision, publishes a staging image tagged `v0.9.6-beta.1-staging`, then deploys it to the staging host. After use-case testing is approved, the production job builds from the same source commit, using production frontend URLs, publishes `v0.9.6-beta.1`, and deploys it. Staging and production use separate Docker build arguments because the frontend API URLs are baked into the image.

The automated GUI smoke suite checks that both portals render their login screen, accept form input, submit a login request, and show the expected invalid-credentials message. It mocks the login API and is a quick regression check; it does not replace testing successful authentication, role permissions, appointments, or other use cases against staging. The `use-case-testing` environment remains a human approval gate. Add required reviewers there; approving that job allows production promotion. Add required reviewers to `production` as a second deployment safeguard. Do not approve the use-case gate until the selected release has passed your expected workflows against staging.

To run the GUI smoke suite locally after installing dependencies and building the portals:

```sh
npx playwright install chromium
npm run test:gui
```

The Playwright configuration starts both built portals with Vite Preview on ports `4173` and `4174`, then shuts them down after the tests. Test reports, screenshots, and traces are written under ignored local output directories; CI retains failure traces in its job artifacts.

The workflow file must exist on the repository's default branch for `workflow_dispatch` to be available. The manual run's branch selector can then choose another branch. A production environment can restrict deployable branches to `deployment` (or whichever branch is your release branch).

The staging deployment runs the app in production mode so it exercises production behavior; use-case testing refers to testing that deployment, not changing Node's runtime mode. For local isolated browser tests, `NODE_ENV=test` enables reflected CORS origins and disables Helmet's HTTPS-upgrade CSP directive so plain-HTTP LAN pages can load their assets. Use `node scripts/compose.js ...` for those Compose commands: the launcher sets both published bind addresses to `0.0.0.0`, detects the host LAN IPv4 address, and points the frontend API URLs to that address in test mode. Set `TEST_LAN_IP` or `TEST_VITE_*` variables in `.env` to override detection/URLs. In other modes it uses the configured bind addresses and frontend URLs from `.env`. Do not use test mode on a production host. `HOST=0.0.0.0` is the app's container bind address, separate from the host's published bind addresses.

## GitHub configuration

Create these GitHub repository environments under **Settings → Environments**:

- `staging` — deployment variables and secrets for the staging server.
- `use-case-testing` — required reviewers who sign off on staging use-case checks.
- `production` — production server variables and secrets; configure required reviewers and limit eligible branches.

Set the following **variables** in both `staging` and `production`:

| Variable | Purpose |
| --- | --- |
| `DEPLOY_HOST` | SSH hostname or IPv4 address reachable by the GitHub Actions runner. |
| `DEPLOY_USER` | SSH account that can run Docker Compose in the deployment directory. |
| `DEPLOY_PATH` | Absolute path on the host containing `compose.yaml` and the private `.env`. |
| `VITE_PATIENT_BACKEND_URL` | Patient API base URL embedded in that environment's web build. |
| `VITE_STAFF_BACKEND_URL` | Staff API base URL embedded in that environment's web build. |
| `VITE_GOOGLE_CLIENT_ID` | Optional Google client ID for the frontend build. |
| `VITE_RECAPTCHA_SITE_KEY` | Optional reCAPTCHA site key for the frontend build. |

Set these **secrets** in both deployment environments:

- `DEPLOY_SSH_PRIVATE_KEY` — private key for the deployment account.
- `DEPLOY_SSH_KNOWN_HOSTS` — pinned `known_hosts` entry for the host.

The workflow uses the built-in `GITHUB_TOKEN` with package write permission to publish to GHCR. The deployment host must already be able to pull that package. For a private package, configure a read-only registry credential on the host; do not put that credential in the workflow or the application `.env`.

GitHub-hosted runners need network access to the SSH host. If the server is private, use a protected self-hosted runner inside that network or an approved VPN path. Avoid opening SSH broadly to the internet just to make the workflow work.

## Server preparation

Prepare two separate deployment directories/Compose projects, one for staging and one for production. Each needs the current `compose.yaml`, a server-only `.env`, a valid `SCHEMA_SQL_PATH` for Compose interpolation, and persistent volumes. Set in each `.env`:

```dotenv
MD_SYSTEM_IMAGE=ghcr.io/cyber-six/mdsystem
IMAGE_TAG=local
```

The release script overrides `IMAGE_TAG` for each deployment. Keep staging and production databases, Redis, media volumes, and secrets separate. Staging must use synthetic or de-identified records; never copy production personal or medical records into staging. Initialize the schema and first administrator separately using the documented Docker setup procedure before the first application deployment.

Make sure the deployment account can run `docker compose` without an interactive password prompt. The workflow updates only `patient`, `staff`, and `email-worker`; it does not run database setup or migrations.

## Use-case checklist

Test the cases relevant to the release in staging, for example:

- Sign in and role-based access for patient, staff, and administrator accounts.
- Patient search, appointment booking/rescheduling/cancellation, and notifications.
- Staff workflows for consultation/EMR, document review, and inventory if included in the release.
- Email delivery through the configured SMTP service and media upload/download.
- Health checks, logs, and expected behavior after restarting the application services.

Record the tested version and source commit in your release notes or issue before approving the use-case gate. This checklist is a starting point; it does not imply that each scenario has an automated test today.

## Rollback

The deployed version is controlled by `IMAGE_TAG` in the selected environment's server `.env`. To roll back, set it to the previous known-good image tag, then run from that deployment directory:

```sh
docker compose pull patient staff email-worker
docker compose up -d --no-build --pull never patient staff email-worker
docker compose ps
```

Application image rollback does not reverse database changes. Database migrations need their own compatibility and recovery plan before production deployment.

## Current branch note

The workflows are authored in the working branch. Merge them into the repository's default branch before expecting the manual workflow to appear in GitHub Actions. Confirm the release branch and reconcile branch histories before enabling production deployment protections.
