import { isDatabaseConfigured } from "@atlas/db"; import { isEmailConfigured } from "../../api/_lib/email"; import { AuthPanel } from "../AuthPanel";
export default function ForgotPage() { return <AuthPanel enabled={isDatabaseConfigured() && isEmailConfigured()} mode="forgot" />; }
