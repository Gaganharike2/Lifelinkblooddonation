# Production Risk Report

## Risk Level
High until production environment is configured and browser-based Playwright visual tests are run in CI.

## Risks
- Production readiness script fails until NODE_ENV, HTTPS APP_URL, strong JWT secret, live payment, SMTP and map settings are configured.
- .env contains live-looking local secrets; rotate exposed credentials before beta distribution.
- Browser screenshot tests could not run in this sandbox because Node child-process spawning is blocked; run npx playwright test on a normal workstation/CI for visual screenshots.
