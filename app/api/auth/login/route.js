import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import { createSupabaseServer } from "../../../../lib/supabaseServer";

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      !username.trim() ||
      !password
    ) {
      return NextResponse.json(
        { error: "اسم المستخدم أو كلمة المرور غير صحيحة" },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdmin();

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, username, is_active")
      .ilike("username", username.trim())
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "اسم المستخدم أو كلمة المرور غير صحيحة" },
        { status: 401 }
      );
    }

    if (!profile.is_active) {
      return NextResponse.json(
        { error: "تم تعطيل حسابك، يرجى التواصل مع إدارة المسجد." },
        { status: 403 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await admin.auth.admin.getUserById(profile.id);

    if (userError || !user?.email) {
      return NextResponse.json(
        { error: "تعذر العثور على حساب المصادقة" },
        { status: 401 }
      );
    }

    const supabase = await createSupabaseServer();

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });

    if (loginError) {
      return NextResponse.json(
        { error: "اسم المستخدم أو كلمة المرور غير صحيحة" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      redirect: "/dashboard",
    });
  } catch (error) {
    console.error("Login error:", error);

    return NextResponse.json(
      { error: "حدث خطأ أثناء تسجيل الدخول" },
      { status: 500 }
    );
  }
}
