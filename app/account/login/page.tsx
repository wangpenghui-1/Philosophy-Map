import { isDatabaseConfigured } from "@atlas/db";
import { AuthPanel } from "../AuthPanel";
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) { const requested = (await searchParams).next; const nextPath = requested?.startsWith("/account") ? requested : "/account"; return <AuthPanel enabled={isDatabaseConfigured()} mode="login" nextPath={nextPath} />; }
