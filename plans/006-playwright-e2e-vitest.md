# Plan 006 - Reintroduce Playwright E2E Tests with Vitest Browser Mode

## Goal

Reintroduce browser-based end-to-end coverage for Tomato Master using Vitest Browser Mode with the Playwright provider. E2E tests should live under `test/e2e`, run against the Vite dev server at `http://localhost:5173`, and be started together with the dev server via `concurrently`.

## Documentation Notes

Fetched the Vitest Playwright provider documentation with `curl` from `https://vitest.dev/config/browser/playwright`.

Key points to apply:

- Install and configure `@vitest/browser-playwright`.
- Configure Vitest browser mode with `test.browser.provider: playwright()`.
- Configure at least one browser instance, e.g. `instances: [{ browser: 'chromium' }]`.
- Use `test.browser.headless`, not Playwright `launchOptions.headless`, for headless execution.
- Vitest Browser Mode creates one browser page/context per test file, not per individual test, so tests need explicit app-state cleanup or separate files where useful.
- Vitest Browser Mode does not start the application server being tested; this project must start `npm run dev` separately.

## Current State

- The app is a Vite-powered vanilla TypeScript browser app.
- Unit tests live under `test/unit` and run in the Vitest `node` environment.
- `vite.config.ts` currently has a single Vitest config targeting `test/unit/**/*.test.ts`.
- `package.json` has:
  - `dev`: `vite`
  - `test`: `vitest run`
  - no Playwright/Vitest Browser provider dependency
  - no `concurrently` dependency
- The app's main UI supports:
  - Pomodoro timer controls
  - task management
  - side quest management
  - context notes after cancelled/completed work sessions
  - theme preference buttons
  - YouTube playlist URL loading/removal

## Desired End State

- E2E tests exist under `test/e2e`.
- Unit tests remain under `test/unit` and continue running in the `node` environment.
- Vitest config supports separate unit and e2e projects.
- E2E project runs in Vitest Browser Mode using Playwright Chromium.
- E2E tests use `http://localhost:5173` as the application base URL.
- `npm run test:e2e` starts both:
  - the Vite dev server via `npm run dev`
  - the e2e Vitest run
- The dev server is killed automatically after the e2e test process completes.
- Existing `npm test` behavior remains practical for unit tests, with an optional all-tests script if desired.

## Implementation Plan

### 1. Add dependencies

Add development dependencies:

- `@vitest/browser-playwright`
- `playwright`
- `concurrently`

Also ensure Chromium browser binaries are available after install. If the environment skips Playwright browser downloads, document or run:

```bash
npx playwright install chromium
```

### 2. Split Vitest configuration into projects

Update `vite.config.ts` to preserve unit tests and add an e2e project.

Recommended structure:

- Unit project:
  - `name: 'unit'`
  - `include: ['test/unit/**/*.test.ts']`
  - `environment: 'node'`
- E2E project:
  - `name: 'e2e'`
  - `include: ['test/e2e/**/*.test.ts']`
  - `browser.enabled: true`
  - `browser.provider: playwright()`
  - `browser.headless: true`
  - `browser.instances: [{ browser: 'chromium' }]`
  - optionally set a stable viewport such as `1280x900`

Keep build config unchanged.

### 3. Add npm scripts

Add scripts similar to:

```json
{
  "test": "vitest run --project unit",
  "test:watch": "vitest --project unit",
  "test:e2e:run": "vitest run --project e2e",
  "test:e2e": "concurrently -k --success first -n dev,e2e \"npm run dev\" \"npm run test:e2e:run\"",
  "test:all": "npm test && npm run test:e2e"
}
```

Notes:

- `--success first` lets the command finish successfully when the e2e test process exits successfully, then `concurrently` kills the still-running dev server.
- The e2e test code should wait/retry for `http://localhost:5173` so test startup does not race Vite startup.

### 4. Create E2E test helpers

Create a helper under `test/e2e`, for example `test/e2e/helpers/appFrame.ts`, containing:

- `APP_BASE_URL = 'http://localhost:5173'`
- a `waitForApp()` helper that retries fetching/loading the base URL before assertions begin
- a `mountApp()` helper that:
  - clears the current test document body
  - creates an iframe pointed at `APP_BASE_URL`
  - marks it with a test id, e.g. `data-testid="app-frame"`
  - returns `page.frameLocator(...)` for interacting with the app UI

Because the tested app is on `localhost:5173` while Vitest Browser Mode runs its own page separately, using an iframe plus `page.frameLocator` keeps tests focused on the real app server without navigating away from Vitest's own runner page.

### 5. Handle state isolation

Vitest Browser Mode isolates by test file, not each test. Avoid localStorage leakage by doing one or both of the following:

- keep test files focused and avoid cross-test dependencies
- add a browser command or setup helper that clears the app origin's localStorage before each test

Preferred approach:

- add a custom browser command in the e2e project config, e.g. `clearAppStorage`, that uses the Playwright provider context to open `http://localhost:5173`, run `localStorage.clear()`, and close the temporary page
- call this command in each `beforeEach` before mounting the app iframe

This keeps tests independent without relying on browser-context-per-test behavior that Vitest Browser Mode does not provide.

### 6. Add focused E2E coverage

Do not over-test every branch; cover the main user flows that give confidence the UI works.

Recommended test files:

#### `test/e2e/app-smoke.e2e.test.ts`

Verify initial app rendering:

- page heading/title shows Tomato Master
- timer starts at `25:00`
- timer label is `Ready`
- Work, Short Break, and Long Break buttons are present
- task and side quest empty states are shown
- note modal is not visible

#### `test/e2e/tasks.e2e.test.ts`

Verify task and side quest basics:

- add a task with the input and add button or Enter key
- task appears in the task list
- first task becomes active and appears in the `Working on:` banner
- completing a task marks it completed and removes/updates active state
- deleting a task removes it from the list
- add a side quest and verify the `Break plan:` banner appears

#### `test/e2e/timer-and-notes.e2e.test.ts`

Verify timer controls and context notes:

- click Work and assert:
  - label changes to `Work Session`
  - control buttons appear
  - timer type buttons become disabled
- pause and resume the work timer using aria labels
- cancel the work timer and assert:
  - timer returns to Ready/idle UI
  - note modal opens with `Session Cancelled`
- save a context note and assert the note banner appears with the saved note
- dismiss the note banner
- optionally verify Short Break starts with `05:00` and does not show the note modal when cancelled

#### `test/e2e/preferences-and-youtube.e2e.test.ts`

Verify secondary but visible UI behavior:

- click dark/light/system theme buttons and assert `body[data-theme]` and active button state update
- enter a valid YouTube playlist URL containing a `list` parameter
- click Load Playlist and assert the button changes to `Remove playlist` and the player container becomes visible
- click Remove Playlist and assert the input is cleared and button returns to `Load playlist`

Avoid depending on the external YouTube iframe API actually loading; this test should only verify the app's local URL parsing and UI state changes.

### 7. Use accessible selectors where possible

Prefer Vitest Browser locators by role/label/text:

- `getByRole('button', { name: /work/i })`
- `getByLabelText('New task')`
- `getByRole('list', { name: 'Tasks' })`
- `getByText(...)`

Use CSS selectors only for state assertions that do not have accessible equivalents, such as `body[data-theme="dark"]` or app-specific class toggles.

### 8. Update docs

Update `README.md` test instructions to include:

- `npm test` for unit tests
- `npm run test:e2e` for browser e2e tests, including that it starts `npm run dev` automatically
- `npm run test:all` if added
- note that e2e tests use Playwright Chromium through Vitest Browser Mode

### 9. Validate implementation

After implementation, run:

```bash
npm install
npm test
npm run test:e2e
npm run build
```

If browser binaries are missing, run:

```bash
npx playwright install chromium
npm run test:e2e
```

## Risks / Watchouts

- Starting dev server and tests concurrently can race; e2e setup should wait for `http://localhost:5173` before mounting/asserting.
- Vitest Browser Mode is not the Playwright test runner; tests should use `vitest/browser` APIs and Playwright through Vitest's provider.
- Vitest Browser Mode does not isolate every test in a fresh page/context, so localStorage cleanup matters.
- The app currently injects the YouTube iframe API script on startup; e2e tests should not require external YouTube network success.
- Browser notification permission prompts should not be part of normal assertions; avoid depending on notification behavior in e2e tests.
- If `npm test` is changed to run only unit tests, document `npm run test:all` clearly for full verification.

## Task List

- [x] Add `@vitest/browser-playwright`, `playwright`, and `concurrently` dev dependencies.
- [x] Ensure Chromium browser binaries are available.
- [x] Convert Vitest config to unit/e2e projects.
- [x] Configure the e2e project for Playwright Chromium in headless browser mode.
- [x] Add e2e npm scripts using `concurrently` and `npm run dev`.
- [x] Add shared e2e helper(s) for app base URL, server readiness, app iframe mounting, and state cleanup.
- [x] Add smoke e2e tests under `test/e2e`.
- [x] Add task and side quest e2e tests under `test/e2e`.
- [x] Add timer and context note e2e tests under `test/e2e`.
- [x] Add theme and YouTube playlist UI e2e tests under `test/e2e`.
- [x] Update README test instructions.
- [x] Run `npm test`.
- [x] Run `npm run test:e2e`.
- [x] Run `npm run build`.

## Completed 2026-06-27

- Reintroduced browser E2E coverage with Vitest Browser Mode + Playwright Chromium.
- Split unit and E2E Vitest projects and added `test/e2e` coverage for smoke, tasks, timer/notes, theme, and YouTube UI flows.
- Updated scripts to run E2E alongside the Vite dev server and verified `npm test`, `npm run test:e2e`, and `npm run build`.
