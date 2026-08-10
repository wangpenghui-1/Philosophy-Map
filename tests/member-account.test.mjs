import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { memberRegisterSchema, passwordResetSchema } from "../packages/api-contracts/src/index.ts";
import { hashPassword, verifyPassword } from "../packages/auth/src/index.ts";
import { clearedSessionCookie, sessionCookie } from "../app/api/_lib/session.ts";

test("member passwords require length, letters, and numbers", () => {
  assert.equal(memberRegisterSchema.safeParse({ email: "member@example.com", password: "onlyletterslong", displayName: "Member", acceptPrivacy: true }).success, false);
  assert.equal(passwordResetSchema.safeParse({ token: "x".repeat(43), password: "secure-password-2026" }).success, true);
});

test("member password hashes are salted and never retain plaintext", async () => {
  const password = "member-password-2026";
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.equal(first.includes(password), false);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword("wrong-password-2026", first), false);
});

test("member cookies are strict, httpOnly, and secure on HTTPS", () => {
  const request = new Request("https://ideaglobemap.cn/api/v1/auth/login");
  const issued = sessionCookie(request, "opaque-token", 60);
  assert.match(issued, /HttpOnly/);
  assert.match(issued, /SameSite=Strict/);
  assert.match(issued, /Secure/);
  assert.match(clearedSessionCookie(request), /Max-Age=0/);
});

test("user persistence routes set a transaction-local RLS context", async () => {
  const client = await readFile(new URL("../packages/db/src/client.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../drizzle/0000_striped_maestro.sql", import.meta.url), "utf8");
  assert.match(client, /set_config\('app\.user_id'/);
  for (const table of ["user_profiles", "favorites", "reading_progress", "journey_progress", "conversations", "memory_items"]) {
    assert.match(migration, new RegExp(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`));
    assert.match(migration, new RegExp(`CREATE POLICY "${table.replace("reading_progress", "reading_progress").replace("journey_progress", "journey_progress").replace("user_profiles", "user_profiles").replace("memory_items", "memory_items")}_owner_policy"`));
  }
});

test("member registration establishes its RLS identity before profile creation", async () => {
  const source = await readFile(new URL("../packages/auth/src/index.ts", import.meta.url), "utf8");
  const registration = source.slice(source.indexOf("export async function registerMember"), source.indexOf("async function findActiveAuthToken"));
  const userInsert = registration.indexOf("insert(databaseSchema.users)");
  const userContext = registration.indexOf("set_config('app.user_id'");
  const profileInsert = registration.indexOf("insert(databaseSchema.userProfiles)");

  assert.ok(userInsert >= 0, "registration must create the user first");
  assert.ok(userContext > userInsert, "registration must derive the RLS identity from the created user");
  assert.ok(profileInsert > userContext, "registration must set the RLS identity before writing the profile");
});

test("member registration never exposes database error details", async () => {
  const route = await readFile(new URL("../app/api/v1/auth/register/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(route, /problemResponse\([^\n]+error\.message/);
  assert.match(route, /注册服务暂时不可用，请稍后重试。/);
  assert.match(route, /errorName: error instanceof Error \? error\.name/);
});

test("auth token migration stores only unique token hashes with expiry and consumption", async () => {
  const migration = await readFile(new URL("../drizzle/0004_ordinary_blur.sql", import.meta.url), "utf8");
  assert.match(migration, /"token_hash" varchar\(128\) NOT NULL/);
  assert.match(migration, /"expires_at" timestamp with time zone NOT NULL/);
  assert.match(migration, /"consumed_at" timestamp with time zone/);
  assert.doesNotMatch(migration, /"token" varchar/);
});
