import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Todo teste roda num fuso diferente do consultório (Tóquio, UTC+9, sem horário
// de verão): se alguma regra de data dependesse do fuso do aparelho, falharia
// aqui em vez de passar por acaso numa máquina em São Paulo.
process.env.TZ = 'Asia/Tokyo';

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
            'src/dominio/**/*.test.ts',
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
