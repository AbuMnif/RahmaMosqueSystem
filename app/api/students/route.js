import { NextResponse } from "next/server";
import { createSupabaseServer } from "../../../lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createSupabaseServer();

    // التحقق من جلسة المستخدم
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "يجب تسجيل الدخول أولًا." },
        { status: 401 }
      );
    }

    // التحقق من صلاحية المدير أو المشرف
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, role, is_active")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || !profile.is_active) {
      return NextResponse.json(
        { error: "الحساب غير نشط أو غير صالح." },
        { status: 403 }
      );
    }

    if (!["admin", "supervisor"].includes(profile.role)) {
      return NextResponse.json(
        { error: "ليس لديك صلاحية إدارة الطلاب." },
        { status: 403 }
      );
    }

    // جلب الطلاب
    const { data: students, error: studentsError } = await supabase
      .from("students")
      .select(`
        id,
        first_name,
        middle_name,
        last_name,
        birth_date,
        gender,
        guardian_id,
        notes,
        is_active,
        created_at
      `)
      .order("created_at", { ascending: false });

    if (studentsError) {
      console.error("Students query error:", studentsError);

      return NextResponse.json(
        { error: "تعذر جلب بيانات الطلاب من قاعدة البيانات." },
        { status: 500 }
      );
    }

    if (!students || students.length === 0) {
      return NextResponse.json({
        success: true,
        students: [],
      });
    }

    // استخراج معرفات أولياء الأمور دون تكرار
    const guardianIds = [
      ...new Set(
        students
          .map((student) => student.guardian_id)
          .filter(Boolean)
      ),
    ];

    // جلب أسماء أولياء الأمور
    let guardiansMap = new Map();

    if (guardianIds.length > 0) {
      const { data: guardians, error: guardiansError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", guardianIds);

      if (guardiansError) {
        console.error("Guardians query error:", guardiansError);

        return NextResponse.json(
          { error: "تعذر جلب بيانات أولياء الأمور." },
          { status: 500 }
        );
      }

      guardiansMap = new Map(
        (guardians || []).map((guardian) => [
          guardian.id,
          guardian,
        ])
      );
    }

    // جلب التسجيلات الحالية للطلاب
    const studentIds = students.map((student) => student.id);

    const { data: enrollments, error: enrollmentsError } = await supabase
      .from("student_enrollments")
      .select("id, student_id, class_id, start_date")
      .in("student_id", studentIds)
      .is("end_date", null)
      .order("start_date", { ascending: false });

    if (enrollmentsError) {
      console.error("Enrollments query error:", enrollmentsError);

      return NextResponse.json(
        { error: "تعذر جلب تسجيلات الطلاب في الحلقات." },
        { status: 500 }
      );
    }

    // اختيار أحدث تسجيل حالي لكل طالب
    const currentEnrollmentsMap = new Map();

    for (const enrollment of enrollments || []) {
      if (!currentEnrollmentsMap.has(enrollment.student_id)) {
        currentEnrollmentsMap.set(enrollment.student_id, enrollment);
      }
    }

    // استخراج معرفات الحلقات الحالية
    const classIds = [
      ...new Set(
        [...currentEnrollmentsMap.values()]
          .map((enrollment) => enrollment.class_id)
          .filter(Boolean)
      ),
    ];

    // جلب أسماء الحلقات
    let classesMap = new Map();

    if (classIds.length > 0) {
      const { data: classes, error: classesError } = await supabase
        .from("classes")
        .select("id, name")
        .in("id", classIds);

      if (classesError) {
        console.error("Classes query error:", classesError);

        return NextResponse.json(
          { error: "تعذر جلب بيانات الحلقات." },
          { status: 500 }
        );
      }

      classesMap = new Map(
        (classes || []).map((item) => [
          item.id,
          item,
        ])
      );
    }

    // تجهيز البيانات للواجهة
    const formattedStudents = students.map((student) => {
      const enrollment = currentEnrollmentsMap.get(student.id);

      return {
        ...student,

        guardian: guardiansMap.get(student.guardian_id) || null,

        current_enrollment: enrollment
          ? {
              id: enrollment.id,
              start_date: enrollment.start_date,
              class: classesMap.get(enrollment.class_id) || null,
            }
          : null,
      };
    });

    return NextResponse.json({
      success: true,
      students: formattedStudents,
    });
  } catch (error) {
    console.error("GET /api/students error:", error);

    return NextResponse.json(
      { error: "حدث خطأ غير متوقع أثناء تحميل بيانات الطلاب." },
      { status: 500 }
    );
  }
}
