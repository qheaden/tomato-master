import { playwright } from '@vitest/browser-playwright';
import { defineConfig, defineProject } from 'vitest/config';

import { browserCommands } from './test/e2e/helpers/browserCommands';

export default defineConfig({
  build: {
    outDir: 'dist',
  },
  test: {
    projects: [
      defineProject({
        test: {
          name: 'unit',
          include: ['test/unit/**/*.test.ts'],
          environment: 'node',
        },
      }),
      defineProject({
        test: {
          name: 'e2e',
          include: ['test/e2e/**/*.test.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            api: {
              host: '127.0.0.1',
              port: 51234,
              strictPort: true,
            },
            instances: [
              {
                browser: 'chromium',
                viewport: {
                  width: 1280,
                  height: 900,
                },
              },
            ],
            commands: browserCommands,
          },
        },
      }),
    ],
  },
});
