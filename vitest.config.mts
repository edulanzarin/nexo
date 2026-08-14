import { defineConfig } from "vitest/config";

// Testes de unidade das libs de cálculo PURAS (sem DB, sem server-only). Os
// arquivos server-only não entram aqui — importá-los quebraria por design.
// Ambiente node: nada de DOM, é lógica de domínio.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
