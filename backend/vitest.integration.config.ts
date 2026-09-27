import {
  dirname,
  resolve,
} from 'node:path';
import {
  fileURLToPath,
} from 'node:url';

import {
  defineConfig,
} from 'vitest/config';

const backendDirectory =
  dirname(
    fileURLToPath(
      import.meta.url,
    ),
  );

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(
        backendDirectory,
        '../shared',
      ),
    },
  },
  test: {
    environment: 'node',
    include: [
      'backend/src/**/*.integration.spec.ts',
    ],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    restoreMocks: true,
  },
});
