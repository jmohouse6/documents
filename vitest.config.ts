import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: {
          configPath: './wrangler.toml',
          vars: {
            API_KEY: 'test-api-key',
          },
        },
      },
    },
  },
});
