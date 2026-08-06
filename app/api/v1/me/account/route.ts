import { eq } from "drizzle-orm";
import { accountDeleteSchema } from "@atlas/api-contracts";
import { databaseSchema, getDatabase } from "@atlas/db";
import { authenticatedPrincipal } from "../../../_lib/auth";
import { problemResponse, validationProblem } from "../../../_lib/http";

export async function DELETE(request: Request) {
  const auth = await authenticatedPrincipal(request);
  if ("response" in auth) return auth.response;
  const parsed = accountDeleteSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationProblem(parsed.error);
  const userId = auth.principal.subject!;
  const database = getDatabase();
  const deleted = await database.transaction(async (transaction) => {
    await transaction.insert(databaseSchema.auditEvents).values({
      actorId: userId,
      actorRole: auth.principal.role,
      action: "user-data.deleted",
      resourceType: "user",
      resourceId: userId,
      metadata: { method: "self-service-hard-delete" },
    });
    return transaction.delete(databaseSchema.users)
      .where(eq(databaseSchema.users.id, userId))
      .returning({ id: databaseSchema.users.id });
  });
  if (!deleted.length) return problemResponse(404, "未找到账户");
  return new Response(null, {
    status: 204,
    headers: { "set-cookie": "atlas_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" },
  });
}
