import { defineConfig } from 'vitest/config';

// An explicit config keeps this workspace isolated from the legacy V1 Vite
// configuration at the repository root.
export default defineConfig({
  test: {
    root: import.meta.dirname,
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
