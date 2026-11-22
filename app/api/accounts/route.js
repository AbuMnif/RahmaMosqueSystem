import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createSupabaseServer } from "../../../lib/supabaseServer";
import { createSupabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
const ROLES = ["teacher", "guardian"];

async function access() {
  const supabase = await createSupabaseServer();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: "يجب تسجيل الدخول أولًا.", status: 401 };
  const admin = createSupabaseAdmin();
  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("id, full_name, role, is_active").eq("id", user.id).maybeSingle();
  if (profileError || !profile || !profile.is_active || !["admin", "supervisor", "platform_supervisor"].includes(profile.role))
    return { error: "ليس لديك صلاحية الوصول إلى إدارة الحسابات.", status: 403 };
  return { admin, profile };
}

export async function GET() {
  try {
    const ctx = await access();
    if (ctx.error) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { data: profiles, error } = await ctx.admin.from("profiles")
      .select("id, username, full_name, role, is_active, created_at")
      .in("role", ROLES).order("created_at", { ascending: false });
    if (error) throw error;
    const guardianIds = (profiles || []).filter(p => p.role === "guardian").map(p => p.id);
    let students = [];
    if (guardianIds.length) {
      const result = await ctx.admin.from("students").select("id, first_name, middle_name, last_name, guardian_id").in("guardian_id", guardianIds);
      if (result.error) throw result.error;
      students = result.data || [];
    }
    return NextResponse.json({ accounts: (profiles || []).map(p => ({ ...p, students: students.filter(s => s.guardian_id === p.id) })) });
  } catch (e) {
    console.error("accounts GET", e);
    return NextResponse.json({ error: "تعذر تحميل الحسابات." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const ctx = await access();
    if (ctx.error) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    if (ctx.profile.role !== "admin") return NextResponse.json({ error: "إنشاء الحسابات متاح لمدير النظام فقط." }, { status: 403 });
    const body = await request.json();
    const username = String(body.username || "").trim();
    const full_name = String(body.full_name || "").trim();
    const password = String(body.password || "");
    const role = String(body.role || "");
    if (username.length < 3 || username.length > 40 || /\s/.test(username)) return NextResponse.json({ error: "اسم المستخدم يجب أن يكون من 3 إلى 40 حرفًا دون مسافات." }, { status: 400 });
    if (!full_name || !ROLES.includes(role) || password.length < 8) return NextResponse.json({ error: "أكمل البيانات، واجعل كلمة المرور 8 أحرف على الأقل." }, { status: 400 });
    const { data: duplicate, error: dupError } = await ctx.admin.from("profiles").select("id").ilike("username", username).limit(1);
    if (dupError) throw dupError;
    if (duplicate?.length) return NextResponse.json({ error: "اسم المستخدم مستخدم بالفعل." }, { status: 409 });
    const email = `${role}-${randomUUID()}@accounts.rahma.internal`;
    const { data: created, error: authError } = await ctx.admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } });
    if (authError || !created?.user) throw authError || new Error("auth user creation failed");
    const { error: insertError } = await ctx.admin.from("profiles").insert({ id: created.user.id, username, full_name, role, is_active: true });
    if (insertError) {
      await ctx.admin.auth.admin.deleteUser(created.user.id);
      if (insertError.code === "23505") return NextResponse.json({ error: "اسم المستخدم مستخدم بالفعل." }, { status: 409 });
      throw insertError;
    }
    return NextResponse.json({ success: true, message: "تم إنشاء الحساب بنجاح." }, { status: 201 });
  } catch (e) {
    console.error("accounts POST", e);
    return NextResponse.json({ error: "تعذر إنشاء الحساب. تحقق من إعدادات Supabase ثم حاول مجددًا." }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const ctx = await access();
    if (ctx.error) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    if (ctx.profile.role !== "admin") return NextResponse.json({ error: "تعديل الحسابات متاح لمدير النظام فقط." }, { status: 403 });
    const body = await request.json();
    const id = String(body.id || "");
    if (!id || id === ctx.profile.id) return NextResponse.json({ error: "لا يمكن تعديل حسابك من هذه الصفحة." }, { status: 400 });
    const { data: target, error: targetError } = await ctx.admin.from("profiles").select("id, role").eq("id", id).maybeSingle();
    if (targetError) throw targetError;
    if (!target || !ROLES.includes(target.role)) return NextResponse.json({ error: "الحساب غير موجود." }, { status: 404 });
    if (typeof body.password === "string" && body.password.length) {
      if (body.password.length < 8) return NextResponse.json({ error: "كلمة المرور يجب ألا تقل عن 8 أحرف." }, { status: 400 });
      const { error } = await ctx.admin.auth.admin.updateUserById(id, { password: body.password });
      if (error) throw error;
    }
    if (typeof body.is_active === "boolean") {
      const { error } = await ctx.admin.from("profiles").update({ is_active: body.is_active }).eq("id", id);
      if (error) throw error;
    }
    return NextResponse.json({ success: true, message: "تم تحديث الحساب." });
  } catch (e) {
    console.error("accounts PATCH", e);
    return NextResponse.json({ error: "تعذر تحديث الحساب." }, { status: 500 });
  }
}
