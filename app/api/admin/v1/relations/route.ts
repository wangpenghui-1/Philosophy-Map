import { apiEnvelope, createRelationDraftSchema } from "@atlas/api-contracts";
import { authenticatedPrincipal } from "../../../_lib/auth";
import { versionEtag } from "../../../_lib/editorial";
import { jsonResponse, problemResponse, validationProblem } from "../../../_lib/http";
import { createRelationDraft } from "../../../_lib/relations";
export async function POST(request: Request) { const auth = await authenticatedPrincipal(request); if ("response" in auth) return auth.response; const parsed = createRelationDraftSchema.safeParse(await request.json().catch(() => ({}))); if (!parsed.success) return validationProblem(parsed.error); try { const value = await createRelationDraft(auth.principal, parsed.data); return jsonResponse(apiEnvelope(value), { status: 201, headers: { etag: versionEtag(value) } }); } catch (error) { const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 403; return problemResponse(status, "无法创建关系候选", error instanceof Error ? error.message : undefined); } }
