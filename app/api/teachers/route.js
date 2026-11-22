import { NextResponse } from "next/server";
import { createSupabaseServer } from "../../../lib/supabaseServer";
import { createSupabaseAdmin } from "../../../lib/supabaseAdmin";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا." }, { status: 401 });
    const admin = createSupabaseAdmin();
    const { data: me, error: meError } = await admin.from("profiles").select("role,is_active").eq("id", user.id).maybeSingle();
    if (meError || !me?.is_active || !["admin", "supervisor", "platform_supervisor"].includes(me.role)) return NextResponse.json({ error: "ليس لديك صلاحية الوصول." }, { status: 403 });
    const [{ data: teachers, error }, { data: assignments, error: aError }, { data: classes, error: cError }] = await Promise.all([
      admin.from("profiles").select("id,username,full_name,is_active,created_at").eq("role", "teacher").order("full_name"),
      admin.from("class_teachers").select("id,class_id,teacher_id,teaching_days"),
      admin.from("classes").select("id,name,is_active")
    ]);
    if (error || aError || cError) throw error || aError || cError;
    const classMap = new Map((classes || []).map(c => [c.id, c]));
    return NextResponse.json({ teachers: (teachers || []).map(t => ({ ...t, classes: (assignments || []).filter(a => a.teacher_id === t.id).map(a => ({ ...a, class: classMap.get(a.class_id) || null })).filter(a => a.class) })) });
  } catch (e) {
    console.error("teachers GET", e);
    return NextResponse.json({ error: "تعذر تحميل بيانات المعلمين." }, { status: 500 });
  }
}
