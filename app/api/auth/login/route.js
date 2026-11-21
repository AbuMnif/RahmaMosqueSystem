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

    if (profileError || !profile || !profile.is_active) {
      return NextResponse.json(
        { error: "اسم المستخدم أو كلمة المرور غير صحيحة" },
        { status: 401 }
      );
    }

    const supabase = await createSupabaseServer();

    const email = `${profile.username.toLowerCase()}@rahma.invalid`;

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
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
