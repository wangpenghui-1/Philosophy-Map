import { eq } from "drizzle-orm";
import { apiEnvelope, journeyProgressUpdateSchema } from "@atlas/api-contracts";
import { databaseSchema, getDatabase, withUserContext } from "@atlas/db";
import { authenticatedPrincipal } from "../../../../../_lib/auth";
import { jsonResponse, problemResponse, validationProblem } from "../../../../../_lib/http";

export async function PUT(request: Request, { params }: { params: Promise<{ journeyId: string }> }) {
  const auth = await authenticatedPrincipal(request); if ("response" in auth) return auth.response;
  const parsed = journeyProgressUpdateSchema.safeParse(await request.json().catch(() => ({}))); if (!parsed.success) return validationProblem(parsed.error);
  const { journeyId } = await params; const database = getDatabase();
  const [journey] = await database.select({ id: databaseSchema.journeys.id }).from(databaseSchema.journeys).where(eq(databaseSchema.journeys.stableKey, journeyId)).limit(1);
  if (!journey) return problemResponse(404, "未找到思想旅程");
  const [progress] = await withUserContext(auth.principal.subject!, (transaction) => transaction.insert(databaseSchema.journeyProgress).values({ userId: auth.principal.subject!, journeyId: journey.id, nodeOrdinal: parsed.data.nodeOrdinal, completedAt: parsed.data.completed ? new Date() : null }).onConflictDoUpdate({ target: [databaseSchema.journeyProgress.userId, databaseSchema.journeyProgress.journeyId], set: { nodeOrdinal: parsed.data.nodeOrdinal, completedAt: parsed.data.completed ? new Date() : null, updatedAt: new Date() } }).returning());
  return jsonResponse(apiEnvelope(progress));
}
