# Plan 005 - Migrate Build/Test Tooling to Vite and Vitest

## Goal

Replace the current esbuild-based build flow with Vite, and replace Mocha/Chai-based unit testing with Vitest, while keeping the existing TypeScript browser application working from `src/`, `index.html`, and `app.css`.

## Current State

- Build uses `esbuild` via the `build` npm script.
- `index.html` and `app.css` are copied into `dist/` manually.
- Unit tests run with `mocha --require ts-node/register`.
- Assertions use Chai (`expect(...)`).
- Test spies/stubs use Sinon.
- Source is plain TypeScript with DOM APIs and no framework.
- Existing tests are mostly logic/unit tests, with some browser-adjacent types and mocked Web APIs.

## Desired End State

- `npm run build` uses Vite and outputs a production build to `dist/`.
- `npm run dev` is available for local development through the Vite dev server.
- `npm test` uses Vitest in one-shot mode.
- `npm run test:watch` uses Vitest watch mode.
- Existing unit coverage is preserved after the migration.
- Browser app entry and static assets are handled by Vite conventions instead of manual copy steps.

## Constraints / Assumptions

- Do not introduce a UI framework.
- Keep the app as a Vite-powered vanilla TypeScript app.
- Preserve the existing `dist/` output directory.
- Prefer the smallest migration that modernizes tooling without changing app behavior.
- Remove Playwright from the repository for now as part of this tooling migration.

## Migration Plan

### 1. Audit and classify runtime vs test environment needs

- Review all tests and classify them as:
  - pure logic tests that can run in a `node` Vitest environment
  - tests that need DOM/browser globals and should run in `jsdom`
- Confirm whether any current or future tests need Vite-specific path aliasing or setup files.
- Identify any globals currently assumed by Mocha/Chai/Sinon that Vitest will need to replace or explicitly support.

### 2. Replace build tooling with Vite

- Add Vite as a dev dependency.
- Remove `esbuild` from the build path.
- Update npm scripts so that:
  - `build` runs `vite build`
  - `dev` runs `vite`
  - `serve` runs `vite preview`
  - `test` runs `vitest run`
  - `test:watch` runs `vitest`
- Ensure `index.html` is used as Vite’s HTML entry point.
- Update script loading in `index.html` if needed so the app entry points to the TypeScript module Vite expects.
- Ensure `app.css` is included in a Vite-compatible way (either linked from `index.html` or imported from the entry module).
- Add a minimal `vite.config.ts` only if needed for output dir, test config colocation, or future maintainability.

### 3. Update TypeScript configuration for Vite compatibility

- Review `tsconfig.json` for compatibility with Vite/Vitest.
- Likely change module-related settings from CommonJS-oriented testing/build assumptions toward modern ESM/bundler-friendly settings.
- Consider introducing a split config if useful:
  - base app config
  - Vitest-specific config if test compilation needs differ
- Remove or revise settings that are tied to the old build flow and no longer make sense under Vite.

### 4. Replace Mocha/Chai runner with Vitest

- Add Vitest as a dev dependency.
- Remove Mocha, Chai, `@types/mocha`, and `@types/chai` once migration is complete.
- Update `test` to run `vitest run`.
- Add `test:watch` to run `vitest` in watch mode.
- Add a Vitest config block/file to define:
  - test file glob(s)
  - environment (`node` or `jsdom`)
  - globals setting, if desired
  - optional setup files

### 5. Migrate assertions from Chai to Vitest

- Replace `import { expect } from 'chai'` with Vitest imports or globals.
- Update assertion syntax where needed:
  - most `expect(...).to.equal(...)` style assertions will map cleanly
  - verify Chai-specific constructs like `.to.throw(...)`, `.to.deep.equal(...)`, `.to.have.length(...)`, `.to.be.null`, etc. against Vitest’s Chai-compatible matcher support
- Resolve any mismatches by using Vitest-native matcher equivalents where necessary.

### 6. Decide how to handle Sinon

Migrate all test doubles from Sinon to Vitest mocks.

- Replace `sinon.spy/stub/createSandbox/restore` with `vi.fn`, `vi.spyOn`, and `vi.restoreAllMocks`.
- Update call assertions and stub behavior checks to use Vitest-compatible patterns.
- Remove `sinon` and `@types/sinon` after the migration is complete.

### 7. Adapt test files to Vitest lifecycle APIs

- Replace Mocha imports/usage with Vitest equivalents where needed:
  - `describe`, `it`, `beforeEach`, `afterEach`
- If using Vitest globals, remove the need to import these explicitly.
- If not using globals, import them from `vitest` in each test file.
- Confirm async tests, thrown error assertions, and per-test cleanup still behave as expected.

### 8. Verify browser-adjacent test behavior

- Confirm mocked browser APIs still work under Vitest.
- If any tests require DOM globals, move them to `jsdom` via:
  - a global Vitest environment, or
  - per-file environment annotations if only a subset needs it
- Ensure TypeScript recognizes any environment-specific globals used by tests.

### 9. Refresh documentation and developer workflow

- Update `README.md` build/test instructions to reflect:
  - `npm run dev`
  - `npm run build`
  - `npm test`
- Remove references to esbuild, Mocha, and Chai.
- Document any environment split between node-based and jsdom-based Vitest tests.

### 10. Validate the migration end to end

- Run install/update dependency lockfile.
- Run `npm test` and fix any migrated test failures.
- Run `npm run test:watch` to confirm the watch workflow behaves as expected.
- Run `npm run build` and confirm `dist/` is produced correctly.
- Smoke-test the built app locally with `npm run dev` and `npm run serve`.

## Expected File-Level Changes

Likely files to update during implementation:

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `tsconfig.test.json` (possibly remove, repurpose, or replace)
- `index.html`
- test files under `test/`
- `README.md`
- new `vite.config.ts` and/or Vitest config if needed
- any Playwright-related files/config currently present

## Dependency Changes

### Add

- `vite`
- `vitest`
- possibly `jsdom` if jsdom environment is needed explicitly

### Remove

- `mocha`
- `chai`
- `@types/mocha`
- `@types/chai`
- `ts-node`
- `sinon`
- `@types/sinon`
- `@playwright/test`
- potentially `esbuild` if no longer used directly

### Keep

- `typescript`
- `@types/node`

## Risks / Watchouts

- Vite expects an ESM-oriented setup; current TypeScript config is CommonJS-oriented.
- Some tests may rely on Chai or Sinon specifics that do not translate 1:1.
- If `index.html` is not currently Vite-compatible, the app entry wiring will need adjustment.
- Browser globals like `localStorage`, `Notification`, or `AudioContext` may influence the chosen Vitest environment.
- `vite preview` serves the built app differently than the current static server, so workflow docs should be updated clearly.

## Recommended Implementation Sequence

1. Add Vite/Vitest dependencies and update scripts.
2. Make the app build successfully with Vite.
3. Add Vitest config and get one test file passing.
4. Migrate remaining tests.
5. Remove obsolete dependencies/config, including Sinon and Playwright.
6. Update docs.
7. Run full verification.

## Questions to Clarify Before Implementation

## Confirmed Requirements

1. `npm test` should run once via `vitest run`.
2. Add a separate `test:watch` script for watch mode.
3. Migrate all mocks/spies from Sinon to Vitest `vi` APIs.
4. Change `serve` to use `vite preview`.
5. Add `npm run dev` as the standard local development workflow.
6. Remove Playwright for now; future Playwright work will be handled separately.

## Task List

- [ ] Add `vite` and `vitest` dev dependencies.
- [ ] Add `jsdom` if required by the chosen Vitest environment.
- [ ] Remove obsolete tooling dependencies: `mocha`, `chai`, `@types/mocha`, `@types/chai`, `ts-node`, `sinon`, `@types/sinon`, `@playwright/test`, and any no-longer-needed `esbuild` dependency.
- [ ] Update `package.json` scripts so `build` uses `vite build`.
- [ ] Add `npm run dev` using the Vite dev server.
- [ ] Change `serve` to use `vite preview`.
- [ ] Change `npm test` to run `vitest run`.
- [ ] Add `npm run test:watch` to run Vitest in watch mode.
- [ ] Update `index.html` to be Vite-compatible as the app entry point.
- [ ] Ensure `app.css` is loaded in a Vite-compatible way.
- [ ] Add `vite.config.ts` and include Vitest config there if appropriate.
- [ ] Update `tsconfig.json` for Vite/Vitest-compatible module and bundler settings.
- [ ] Update or replace `tsconfig.test.json` if needed for Vitest.
- [ ] Configure Vitest test discovery and environment settings.
- [ ] Migrate test imports from Mocha/Chai to Vitest.
- [ ] Replace all Sinon spies/stubs/mocks with Vitest `vi` APIs.
- [ ] Update any assertion syntax that is not directly compatible with Vitest.
- [ ] Verify browser-adjacent tests under the selected Vitest environment and add setup/config as needed.
- [ ] Remove any Playwright-related files or config that exist in the repository.
- [ ] Update `README.md` to document `npm run dev`, `npm run build`, `npm run serve`, `npm test`, and `npm run test:watch`.
- [ ] Regenerate/update `package-lock.json`.
- [ ] Run `npm test` and fix any failures.
- [ ] Run `npm run test:watch` and confirm watch mode works.
- [ ] Run `npm run build` and verify `dist/` output is correct.
- [ ] Run `npm run dev` and smoke-test the app locally.
- [ ] Run `npm run serve` and smoke-test the production preview locally.
