import { redirect } from "next/navigation";
import { createSupabaseServer } from "../../../lib/supabaseServer";
import AccountsClient from "./AccountsClient";
export default async function AccountsPage() {
  const supabase = await createSupabaseServer();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("id,full_name,role,is_active").eq("id", user.id).maybeSingle();
  if (!profile?.is_active || !["admin", "supervisor", "platform_supervisor"].includes(profile.role)) redirect("/dashboard");
  return <AccountsClient profile={profile} />;
}
