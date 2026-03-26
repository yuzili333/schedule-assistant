import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";

export default defineConfig({
  plugins: [pluginReact()],
  html: {
    title: "Schedule Assistant Agent",
  },
  resolve: {
    alias: {
      "@schedule-assistant/agent": "../packages/agent/src/index.ts",
    },
  },
  source: {
    entry: {
      index: "./src/main.tsx",
    },
  },
});
