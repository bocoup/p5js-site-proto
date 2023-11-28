import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import compress from "astro-compress";
import preact from "@astrojs/preact";

// https://astro.build/config
export default defineConfig({
  integrations: [mdx(), preact(), compress()],
  trailingSlash: "always",
  build: {
    format: "directory",
  },
});
