import Link from "next/link";
export const metadata = { title: "Request account | OfficeStock" };
export default function SignupPage(){return <main className="user-management"><h1>Request an account</h1><p className="alert error">Only Sharmila can create accounts. Kindly email your ID to <a href="mailto:sharmila@selangorproperties.com.my">sharmila@selangorproperties.com.my</a> for verification.</p><Link className="button" href="/login">Back to sign in</Link></main>;}
