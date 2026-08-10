import { AuthPanel } from "../AuthPanel";
export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) { return <AuthPanel enabled token={(await searchParams).token} mode="reset" />; }
