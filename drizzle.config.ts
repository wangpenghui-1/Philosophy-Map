import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./packages/db/src/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // Schema generation is intentionally available before a managed database
    // is provisioned. Migration execution still uses the real DATABASE_URL.
    url: process.env.DATABASE_URL ?? "postgres://atlas:atlas@127.0.0.1:5432/atlas",
  },
  strict: true,
  verbose: true,
});
