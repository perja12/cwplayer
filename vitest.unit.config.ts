import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/unit/**/*.spec.ts"],
    setupFiles: ["./tests/unit/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // Type-only modules and generated declarations have no runtime code.
      exclude: ["src/vite-env.d.ts", "src/model/types.ts", "src/audio/messages.ts"],
      reporter: ["text", "html"],
      reportsDirectory: "coverage",
      thresholds: {
        // Whole-src floor. Controllers and audio are exercised by Playwright;
        // these thresholds keep the unit-testable layers from regressing.
        statements: 35,
        branches: 93,
        functions: 70,
        lines: 35,
        "src/model/**": { statements: 100, branches: 95, functions: 100, lines: 100 },
        "src/ui/**": { statements: 100, branches: 100, functions: 100, lines: 100 },
        "src/views/**": { statements: 100, branches: 95, functions: 100, lines: 100 },
        "src/app/*-store.ts": { statements: 100, branches: 95, functions: 100, lines: 100 },
      },
    },
  },
});
