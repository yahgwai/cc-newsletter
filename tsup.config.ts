import { defineConfig } from "tsup";

export default defineConfig({
  entry: { collect: "src/cli.ts" },
  format: "esm",
  target: "node18",
  bundle: true,
  splitting: false,
  noExternal: [/.*/],
  platform: "node",
  // rss-parser is CJS and does require("http") etc. — the default ESM shim
  // can't resolve Node builtins, so we inject a real require function.
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  outDir: "dist",
  clean: true,
});
