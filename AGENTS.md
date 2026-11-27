# Working on MDSystem

Start with the [system context and orchestration guide](Docs/SYSTEM_CONTEXT.md). Use the [documentation index](Docs/README.md) to find the detailed guide for the feature you are changing.

## Coordination

- The lead agent owns scope, acceptance criteria, task boundaries, integration, and final verification. When work is delegated, agree on shared contracts first, assign one writer per overlapping file set, and capture the evidence each agent returns.
- Treat the active server mounts, client callers, schemas, and tests as the source of truth for behavior. Check both Express entry points before assuming an endpoint belongs to one server.
- For changes to a shared contract, check the affected patient web, staff web, and mobile callers. Include applicable permissions, old data, failure paths, and downstream notifications or documents in verification.
- Use synthetic fixtures and local or disposable environments for verification where possible. Keep authentication material and identifiable patient data out of prompts, handoffs, commits, logs, and test artifacts.
- Check the target and side effects before running persistent E2E workflows, migrations, releases, or database resets. The deployment branch can trigger a reset of the Pi use-case PostgreSQL database.
- Report the exact checks run, their outcomes, and any environment-dependent checks that remain open.
