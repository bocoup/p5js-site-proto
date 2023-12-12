import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import compress from "astro-compress";
import preact from "@astrojs/preact";

// https://astro.build/config
export default defineConfig({
  integrations: [mdx(), preact({ compat: true }), compress()],
  trailingSlash: "always",
  build: {
    format: "directory",
  },
  experimental: {
    // https://docs.astro.build/en/guides/internationalization/
    i18n: {
      defaultLocale: "en",
      locales: ["en", "es"],
      fallback: {
        es: "en",
      },
      routingStrategy: "prefix-always",
    },
  },
});
