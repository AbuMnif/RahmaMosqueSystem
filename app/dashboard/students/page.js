import { redirect } from "next/navigation";
import { createSupabaseServer } from "../../../lib/supabaseServer";
import StudentsClient from "./StudentsClient";
import "./page.css";

export default async function StudentsPage() {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("id", user.id)
    .single();

  if (
    profileError ||
    !profile ||
    !profile.is_active ||
    !["admin", "supervisor", "platform_supervisor"].includes(profile.role)
  ) {
    redirect("/dashboard");
  }

  return <StudentsClient profile={profile} />;
}
