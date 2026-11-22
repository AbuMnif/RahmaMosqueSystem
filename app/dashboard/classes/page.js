import { redirect } from "next/navigation";
import { createSupabaseServer } from "../../../lib/supabaseServer";
import ClassesClient from "./ClassesClient";
import "./page.css";

export default async function ClassesPage() {
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
    .select("id, full_name, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    !profile.is_active ||
    !["admin", "supervisor", "platform_supervisor"].includes(profile.role)
  ) {
    redirect("/dashboard");
  }

  return <ClassesClient profile={profile} />;
}
