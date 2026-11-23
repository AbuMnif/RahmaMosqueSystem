import { redirect } from "next/navigation";
import { createSupabaseServer } from "../../../lib/supabaseServer";
import GuardianDashboardClient from "./GuardianDashboardClient";
import "./page.css";

export default async function GuardianPage() {
  const supabase = await createSupabaseServer();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,full_name,role,is_active")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.is_active) redirect("/login");
  if (profile.role !== "guardian") redirect("/dashboard");

  return <GuardianDashboardClient profile={profile} />;
}
