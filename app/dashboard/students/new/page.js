import { redirect } from "next/navigation";
import { createSupabaseServer } from "../../../../lib/supabaseServer";
import NewStudentClient from "./NewStudentClient";
import "./page.css";

export default async function NewStudentPage() {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("id", user.id)
    .single();

  if (
    !profile?.is_active ||
    !["admin", "supervisor"].includes(profile.role)
  ) {
    redirect("/dashboard");
  }

  return <NewStudentClient profile={profile} />;
}
