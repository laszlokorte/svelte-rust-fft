import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import mkcert from "vite-plugin-mkcert";

export default defineConfig({
  plugins: [sveltekit(), wasm(), topLevelAwait(), mkcert(), { enforce: "pre" }],
  ssr: {
    noExternal: ["three"],
  },
});
