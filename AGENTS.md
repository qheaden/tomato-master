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

## Browser Testing

- All browser testing must be performed by the qa-engineer subagent
- If qa-engineer returns problems to fix, you must fix all issues and ask it to review again
- Do not consider the application complete until the qa-engineer says all issues are fixed
