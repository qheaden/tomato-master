# Tomato Master

A Pomodoro timer app with integrated task management and context note-taking. Built to help exercise the ability to automate software development with agentic coding tools such as Claude Code.

## Purpose

Tomato Master helps you stay focused using the [Pomodoro Technique](https://en.wikipedia.org/wiki/Pomodoro_Technique): work in focused 25-minute sessions separated by short or long breaks. Key features include:

- **Pomodoro timer** with 25-minute work sessions, 5-minute short breaks, and 15-minute long breaks
- **Task list** to track what you're working on, with the ability to mark an active task that displays during a session
- **Context notes** — after each work session, you're prompted to jot down where you left off so you can pick up quickly after your break

## Why Another Pomodoro App?

The main idea behind this repository isn't to revolutionize Pomodoro tracking apps — it's to learn how to automate software development using agentic coding tools. This project is an exercise in figuring out how to properly give a coding agent the tools and context it needs for long-horizon planning and work.

For each feature added to the app, the goal is to be as hands-off as possible outside of writing the plan. The app itself is the vehicle; the real focus is on the process of human-agent collaboration and what it takes to delegate meaningful software work end-to-end.

## Building

Install dependencies:

```bash
npm install
```

Start the Vite dev server:

```bash
npm run dev
```

Build the app for production into `dist/`:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run serve
```

Then open the preview URL shown by Vite in your browser.

## Running Tests

Run the unit test suite once:

```bash
npm test
```

Run the browser E2E suite with Vitest Browser Mode and Playwright Chromium:

```bash
npm run test:e2e
```

This command starts `npm run dev` automatically and stops it when the E2E run finishes.

Run all tests:

```bash
npm run test:all
```

Run Vitest in watch mode for unit tests:

```bash
npm run test:watch
```

All current unit tests run in Vitest's `node` environment; no `jsdom` setup is required.

## Usage

1. **Add tasks** — type a task in the input field and press Enter or click the + button
2. **Set an active task** — click a task's name to mark it as the one you're currently working on; it will display as a banner above the timer
3. **Start a session** — click **Work** to begin a 25-minute focus session, or choose **Short Break** (5m) or **Long Break** (15m)
4. **Pause / cancel** — use the pause and stop buttons that appear once a session is running
5. **Leave a context note** — when a work session ends (or is cancelled), a prompt appears to write a quick note about where you left off; this note is shown when you return from your break
6. **Complete tasks** — check the checkbox next to a task to mark it done, or use the delete button to remove it

