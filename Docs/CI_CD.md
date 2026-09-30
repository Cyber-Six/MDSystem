# CI and deployment

This repository uses GitHub Actions for continuous integration and for a controlled staging-to-production release. The workflow files are in `.github/workflows/`.

## Before the first run

1. Push or merge `.github/workflows/ci.yml` and `.github/workflows/publish-and-deploy.yml` to the repository's default branch. Until then, GitHub may not list the manually triggered release workflow.
2. In GitHub, open **Settings → Environments** and create `staging`, `use-case-testing`, and `production`. Add the variables and secrets listed below to `staging` and `production`. Add required reviewers to `use-case-testing` and `production`; production should also restrict eligible branches to the intended release branch.
3. Prepare and initialize both deployment hosts/directories as described under [Server preparation](#server-preparation). Each directory must have its own `.env`, `compose.yaml`, database, Redis, and media volume. Test that the configured SSH user can run `docker compose` on each host and that it can pull the image from GHCR.
4. Confirm that GitHub Actions can reach each SSH host. GitHub-hosted runners need a reachable host; for a private host, arrange a protected self-hosted runner or approved VPN connection.
5. Enable GitHub Actions for the repository. The repository workflow permissions can remain read-only because this workflow declares its own `contents: read` and `packages: write` permissions.

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

The `CI` workflow runs on pull requests and pushes to `development`, `docker-testing`, and `deployment`. It installs dependencies, runs the existing backend, patient, staff, and mobile test commands, builds the web portals, validates Compose configuration, and builds the runtime Docker image.

To start a release, open **Actions → Publish and deploy MDSystem → Run workflow**. GitHub's **Use workflow from** selector chooses the source branch; enter a unique version such as `v0.9.6-beta.1`. The release checks that exact revision, publishes a staging image tagged `v0.9.6-beta.1-staging`, then deploys it to the staging host. After use-case testing is approved, the production job builds from the same source commit, using production frontend URLs, publishes `v0.9.6-beta.1`, and deploys it. Staging and production use separate Docker build arguments because the frontend API URLs are baked into the image.

Use-case testing is a human approval gate, not an automated browser test suite. Add required reviewers to the `use-case-testing` GitHub environment; approving that job allows production promotion. Add required reviewers to `production` as a second deployment safeguard. Do not approve the use-case gate until the selected release has passed your expected workflows against staging.

The workflow file must exist on the repository's default branch for `workflow_dispatch` to be available. The manual run's branch selector can then choose another branch. A production environment can restrict deployable branches to `deployment` (or whichever branch is your release branch).

The staging deployment runs the app in production mode so it exercises production behavior; use-case testing refers to testing that deployment, not changing Node's runtime mode. For local isolated browser tests, `NODE_ENV=test` enables reflected CORS origins. Use `node scripts/compose.js ...` for those Compose commands: the launcher sets both published bind addresses to `0.0.0.0` in test mode; in other modes it reads the configured addresses from `.env` (default `127.0.0.1`). Do not use test mode on a production host. `HOST=0.0.0.0` is the app's container bind address, separate from the host's published bind addresses.

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
