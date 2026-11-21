import { redirect } from "next/navigation";
import { createSupabaseServer } from "../../lib/supabaseServer";

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
    .select("username, full_name, role, is_active")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || !profile.is_active) {
    redirect("/login");
  }

  const roles = {
    admin: "مدير النظام",
    supervisor: "المشرف",
    teacher: "المعلم",
    guardian: "ولي الأمر",
  };

  return (
    <main className="welcome" dir="rtl">
      <section className="welcomeCard">
        <p className="eyebrow">مسجد التراحم</p>

        <h1>مرحبًا، {profile.full_name}</h1>

        <p className="description">
          تم تسجيل دخولك بنجاح إلى منظومة رحَمة الإدارية.
        </p>

        <div className="status">
          {roles[profile.role] || "مستخدم"}
        </div>
      </section>
    </main>
  );
}
