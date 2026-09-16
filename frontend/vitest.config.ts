import { defineConfig, defaultExclude } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    // e2e/ เป็น Playwright spec ไม่ใช่ vitest ต้องกันไม่ให้ vitest สแกนเข้าไปเจอ
    exclude: [...defaultExclude, 'e2e/**'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
