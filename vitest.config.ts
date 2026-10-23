import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        // Regras, serviços, dados e banco: sem navegador.
        test: {
          name: 'unidade',
          environment: 'node',
          globals: true,
          include: [
            'src/regras/**/*.test.ts',
            'src/servicos/**/*.test.ts',
            'src/dados/**/*.test.ts',
            'supabase/tests/**/*.test.ts',
          ],
        },
      },
      {
        // Telas e componentes: DOM simulado.
        plugins: [react()],
        test: {
          name: 'interface',
          environment: 'jsdom',
          globals: true,
          include: ['src/**/*.test.tsx'],
          setupFiles: ['./src/testes/preparar.ts'],
        },
      },
    ],
  },
});
