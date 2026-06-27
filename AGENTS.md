# Tomato Master

## Tech Stack

- TypeScript
- Node.js / Mocha / Chai for JS unit testing
- Vanilla CSS
- HTML5

## Building

- Run `npx build` to compile the TypeScript and output everything to the `dist` directory
- The `npx build` command copies the `index.html` and `app.css` files to the `dist` directory for serving

## Serving

- Run `npx run serve` to run an HTTP server serving the application on `http://localhost:3000`
- The serve command is a blocking command, so when testing, you will need to run it in the background and kill it once you are done with it.

## Unit Testing

- All TypeScript code must be unit tested
- Tests must pass before any work is considered complete
- Use mocking where appropriate to not depend on external services
- Run unit tests with `npm run test:unit`

## E2E Testing

- Use Playwright for end-to-end tests that verify user-facing behavior in the browser
- Any change that affects the UI for users must include a Playwright test covering the affected behavior
- Keep E2E tests deterministic and avoid depending on external services; mock or stub external integrations where appropriate
- E2E tests must pass before any UI-impacting work is considered complete
- Run E2E tests with `npm run test:e2e`
