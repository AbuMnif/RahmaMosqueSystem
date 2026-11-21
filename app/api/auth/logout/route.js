import { NextResponse } from "next/server";
import { createSupabaseServer } from "../../../../lib/supabaseServer";

export async function POST() {
  try {
    const supabase = await createSupabaseServer();

    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
    });

  } catch (error) {
    console.error("Logout error:", error);

    return NextResponse.json(
      { error: "تعذر تسجيل الخروج" },
      { status: 500 }
    );
  }
}
