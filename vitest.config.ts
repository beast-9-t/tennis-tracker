import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    clearMocks: true,
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
