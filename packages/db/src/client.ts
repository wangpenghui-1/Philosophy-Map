import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import { sql } from "drizzle-orm";
import * as schema from "./schema.ts";

let sqlClient: Sql | null = null;
let database: PostgresJsDatabase<typeof schema> | null = null;

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function getDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured. Static compatibility mode remains available.");
  }
  if (!database) {
    sqlClient = postgres(process.env.DATABASE_URL, {
      max: Number(process.env.DATABASE_POOL_SIZE ?? 5),
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
    database = drizzle(sqlClient, { schema });
  }
  return database;
}

export async function closeDatabase() {
  if (sqlClient) await sqlClient.end({ timeout: 5 });
  sqlClient = null;
  database = null;
}

export async function withUserContext<T>(userId: string, operation: (transaction: Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0]) => Promise<T>) {
  return getDatabase().transaction(async (transaction) => {
    await transaction.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    return operation(transaction);
  });
}
