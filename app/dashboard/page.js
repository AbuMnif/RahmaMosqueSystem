import { redirect } from "next/navigation";
import { createSupabaseServer } from "../../lib/supabaseServer";
import DashboardClient from "./DashboardClient";
import "./page.css";

export default async function DashboardPage() {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, full_name, role, is_active")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || !profile.is_active) {
    redirect("/login");
  }

  if (profile.role === "guardian") redirect("/dashboard/guardian");

  return <DashboardClient profile={profile} />;
}
