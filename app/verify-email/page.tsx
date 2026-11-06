import type { Metadata } from "next";
import AuthForm from "../auth-form";
export const metadata: Metadata = { title: "Resend confirmation | Office Inventory Management" };
export default function VerifyEmailPage() { return <AuthForm mode="verify" />; }
