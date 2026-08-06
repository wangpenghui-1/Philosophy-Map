import { eq } from "drizzle-orm";
import { hashPassword } from "../packages/auth/src/index.ts";
import { closeDatabase, databaseSchema, getDatabase } from "../packages/db/src/index.ts";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLocaleLowerCase("en-US");
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
if (!email || !email.includes("@")) throw new Error("ADMIN_BOOTSTRAP_EMAIL must be a valid email address.");
if (!password || password.length < 12 || password.length > 128) {
  throw new Error("ADMIN_BOOTSTRAP_PASSWORD must contain 12 to 128 characters.");
}

const database = getDatabase();
const passwordHash = await hashPassword(password);

await database.transaction(async (transaction) => {
  const [existingUser] = await transaction.select().from(databaseSchema.users)
    .where(eq(databaseSchema.users.email, email)).limit(1);
  const user = existingUser ?? (await transaction.insert(databaseSchema.users).values({
    email,
    emailVerifiedAt: new Date(),
  }).returning())[0];
  const [credential] = await transaction.select().from(databaseSchema.passwordCredentials)
    .where(eq(databaseSchema.passwordCredentials.userId, user.id)).limit(1);
  if (credential && process.env.ADMIN_BOOTSTRAP_FORCE !== "1") {
    throw new Error("This account already has a password. Set ADMIN_BOOTSTRAP_FORCE=1 only when intentionally rotating it.");
  }
  if (credential) {
    await transaction.update(databaseSchema.passwordCredentials).set({
      passwordHash,
      failedAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(databaseSchema.passwordCredentials.userId, user.id));
  } else {
    await transaction.insert(databaseSchema.passwordCredentials).values({ userId: user.id, passwordHash });
  }
  await transaction.insert(databaseSchema.userProfiles).values({
    userId: user.id,
    displayName: "思想星图管理员",
  }).onConflictDoNothing();
  await transaction.insert(databaseSchema.userRoles).values({
    userId: user.id,
    role: "owner",
    grantedBy: user.id,
  }).onConflictDoNothing();
  await transaction.insert(databaseSchema.auditEvents).values({
    actorId: user.id,
    actorRole: "owner",
    action: credential ? "auth.owner.password-rotated" : "auth.owner.bootstrapped",
    resourceType: "user",
    resourceId: user.id,
    metadata: { method: "bootstrap-cli" },
  });
});

console.log(`Owner account ready: ${email}`);
await closeDatabase();
