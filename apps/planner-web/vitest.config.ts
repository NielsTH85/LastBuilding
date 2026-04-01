import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "planner-web",
    root: ".",
    environment: "jsdom",
  },
});
