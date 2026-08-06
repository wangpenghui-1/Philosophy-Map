import type { Permission, Role } from "@atlas/domain";
import { hasPermission } from "@atlas/domain";
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { databaseSchema, getDatabase, isDatabaseConfigured } from "@atlas/db";

export interface AuthPrincipal {
  subject: string | null;
  role: Role;
  sessionId?: string;
  organizationId?: string;
  mode?: "database" | "local-preview";
}

export interface AuthPort {
  resolve(request: Request): Promise<AuthPrincipal>;
}

export class AnonymousAuthAdapter implements AuthPort {
  async resolve(): Promise<AuthPrincipal> {
    return { subject: null, role: "anonymous" };
  }
}

const rolePriority: Role[] = [
  "anonymous", "member", "contributor", "editor", "reviewer", "publisher", "admin", "owner",
];

export function isAdminConsoleRole(role: Role) {
  return rolePriority.indexOf(role) >= rolePriority.indexOf("contributor");
}

export async function highestRoleForUser(userId: string) {
  const assigned = await getDatabase().select({ role: databaseSchema.userRoles.role })
    .from(databaseSchema.userRoles)
    .where(eq(databaseSchema.userRoles.userId, userId));
  return assigned.reduce<Role>((highest, row) =>
    rolePriority.indexOf(row.role) > rolePriority.indexOf(highest) ? row.role : highest,
  "member");
}

function readCookie(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

function requestPath(request: Request) {
  try { return new URL(request.url).pathname; } catch { return "/"; }
}

function isLoopbackRequest(request: Request) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const hostname = host
    ? host.split(":")[0].replace(/^\[|\]$/g, "")
    : new URL(request.url).hostname;
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}

export function isLocalAdminPreviewRequest(request: Request) {
  const path = requestPath(request);
  return !isDatabaseConfigured()
    && isLoopbackRequest(request)
    && (path === "/admin" || path.startsWith("/admin/") || path.startsWith("/api/admin/"))
    && readCookie(request, "atlas_admin_preview") === "1";
}

export class DatabaseSessionAuthAdapter implements AuthPort {
  async resolve(request: Request): Promise<AuthPrincipal> {
    if (isLocalAdminPreviewRequest(request)) {
      return { subject: "local-preview", role: "owner", mode: "local-preview" };
    }
    if (!isDatabaseConfigured()) return { subject: null, role: "anonymous" };
    const token = readCookie(request, "atlas_session");
    if (!token || token.length < 32) return { subject: null, role: "anonymous" };
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const database = getDatabase();
    const [session] = await database.select({
      id: databaseSchema.sessions.id,
      userId: databaseSchema.sessions.userId,
    }).from(databaseSchema.sessions)
      .innerJoin(databaseSchema.users, eq(databaseSchema.users.id, databaseSchema.sessions.userId))
      .where(and(
        eq(databaseSchema.sessions.tokenHash, tokenHash),
        gt(databaseSchema.sessions.expiresAt, new Date()),
        isNull(databaseSchema.sessions.revokedAt),
        isNull(databaseSchema.users.disabledAt),
        isNull(databaseSchema.users.deletedAt),
      )).limit(1);
    if (!session) return { subject: null, role: "anonymous" };
    const role = await highestRoleForUser(session.userId);
    return { subject: session.userId, role, sessionId: session.id, mode: "database" };
  }
}

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const MAX_FAILED_ATTEMPTS = 8;
const LOCK_MINUTES = 15;

function derivePassword(password: string, salt: Buffer, length: number, options: { N: number; r: number; p: number; maxmem: number }) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, length, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = await derivePassword(password, salt, 64, { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, n, r, p, saltValue, hashValue] = encoded.split("$");
  if (algorithm !== "scrypt" || !n || !r || !p || !saltValue || !hashValue) return false;
  const expected = Buffer.from(hashValue, "base64url");
  const actual = await derivePassword(password, Buffer.from(saltValue, "base64url"), expected.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function authenticatePassword(email: string, password: string) {
  if (!isDatabaseConfigured()) return null;
  const database = getDatabase();
  const normalizedEmail = email.trim().toLocaleLowerCase("en-US");
  const [record] = await database.select({
    userId: databaseSchema.users.id,
    passwordHash: databaseSchema.passwordCredentials.passwordHash,
    failedAttempts: databaseSchema.passwordCredentials.failedAttempts,
    lockedUntil: databaseSchema.passwordCredentials.lockedUntil,
    disabledAt: databaseSchema.users.disabledAt,
    deletedAt: databaseSchema.users.deletedAt,
  }).from(databaseSchema.users)
    .innerJoin(
      databaseSchema.passwordCredentials,
      eq(databaseSchema.passwordCredentials.userId, databaseSchema.users.id),
    )
    .where(eq(databaseSchema.users.email, normalizedEmail))
    .limit(1);
  if (!record || record.disabledAt || record.deletedAt) return null;
  if (record.lockedUntil && record.lockedUntil > new Date()) return null;

  const valid = await verifyPassword(password, record.passwordHash);
  if (!valid) {
    const failedAttempts = record.failedAttempts + 1;
    await database.update(databaseSchema.passwordCredentials).set({
      failedAttempts,
      lockedUntil: failedAttempts >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCK_MINUTES * 60_000)
        : null,
      updatedAt: new Date(),
    }).where(eq(databaseSchema.passwordCredentials.userId, record.userId));
    return null;
  }

  await database.update(databaseSchema.passwordCredentials).set({
    failedAttempts: 0,
    lockedUntil: null,
    updatedAt: new Date(),
  }).where(eq(databaseSchema.passwordCredentials.userId, record.userId));
  return record.userId;
}

export async function createDatabaseSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1_000);
  const database = getDatabase();
  const [session] = await database.insert(databaseSchema.sessions).values({
    userId,
    tokenHash,
    expiresAt,
  }).returning({ id: databaseSchema.sessions.id });
  return { token, sessionId: session.id, expiresAt, maxAge: SESSION_TTL_SECONDS };
}

export async function revokeDatabaseSession(token: string | undefined) {
  if (!token || !isDatabaseConfigured()) return;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await getDatabase().update(databaseSchema.sessions).set({ revokedAt: new Date() })
    .where(eq(databaseSchema.sessions.tokenHash, tokenHash));
}

export function sessionTokenFromRequest(request: Request) {
  return readCookie(request, "atlas_session");
}

export function requireAuthenticated(principal: AuthPrincipal) {
  if (!principal.subject) throw new Error("Authentication required.");
  return principal.subject;
}

export function requirePermission(
  principal: AuthPrincipal,
  permission: Permission,
) {
  if (!hasPermission(principal.role, permission)) {
    throw new Error(`Permission ${permission} is required.`);
  }
}
