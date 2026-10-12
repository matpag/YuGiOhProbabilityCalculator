import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/YuGiOhProbabilityCalculator/',
  test: { include: ['src/**/*.test.ts'] },
});
