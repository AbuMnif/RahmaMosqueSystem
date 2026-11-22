import { NextResponse } from "next/server";
import { createSupabaseServer } from "../../../../lib/supabaseServer";
import { createSupabaseAdmin } from "../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createSupabaseServer();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "يجب تسجيل الدخول." },
        { status: 401 }
      );
    }

    const admin = createSupabaseAdmin();

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (
      profileError ||
      !profile?.is_active ||
      !["admin", "supervisor", "platform_supervisor"].includes(profile.role)
    ) {
      return NextResponse.json(
        { error: "ليس لديك صلاحية." },
        { status: 403 }
      );
    }

    const { data: classes, error: classesError } = await admin
      .from("classes")
      .select("id, name")
      .eq("is_active", true)
      .order("name");

    if (classesError) throw classesError;

    const { data: guardians, error: guardiansError } = await admin
      .from("profiles")
      .select("id, full_name, username")
      .eq("role", "guardian")
      .eq("is_active", true)
      .order("full_name");

    if (guardiansError) throw guardiansError;

    return NextResponse.json({
      success: true,
      classes: classes || [],
      guardians: guardians || [],
    });
  } catch (error) {
    console.error("Student options error:", error);

    return NextResponse.json(
      { error: "تعذر تحميل الحلقات وأولياء الأمور." },
      { status: 500 }
    );
  }
}
