import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";

export default defineConfig({
  plugins: [pluginReact()],
  html: {
    title: "Schedule Assistant Agent",
  },
  source: {
    entry: {
      index: "./src/main.tsx",
    },
  },
});
