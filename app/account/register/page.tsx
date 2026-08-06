import { isDatabaseConfigured } from "@atlas/db"; import { isEmailConfigured } from "../../api/_lib/email"; import { AuthPanel } from "../AuthPanel";
export default function RegisterPage() { return <AuthPanel enabled={isDatabaseConfigured() && isEmailConfigured()} mode="register" />; }
