import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
export default defineConfig({
  resolve: { alias: Object.fromEntries(['protocol','domain','adapters','cli'].map(name => [`@aquarium/${name}`, resolve(`packages/${name}/src/index.ts`)])) },
  test: { include: ['packages/**/*.test.ts', 'apps/**/*.test.ts', 'tests/**/*.test.ts'], exclude: ['**/node_modules/**','**/dist/**','.worktrees/**'], testTimeout: 10000 }
});
