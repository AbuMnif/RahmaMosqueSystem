import { NextResponse } from "next/server";
import { createSupabaseServer } from "../../../lib/supabaseServer";
import { createSupabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

async function getManager() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: "يجب تسجيل الدخول أولًا.", status: 401 };
  }

  const admin = createSupabaseAdmin();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    !profile.is_active ||
    !["admin", "supervisor", "platform_supervisor"].includes(profile.role)
  ) {
    return {
      error: "ليس لديك صلاحية الوصول إلى الحلقات.",
      status: 403,
    };
  }

  return { admin, profile };
}

export async function GET() {
  try {
    const manager = await getManager();

    if (manager.error) {
      return NextResponse.json(
        { error: manager.error },
        { status: manager.status }
      );
    }

    const { admin } = manager;

    const { data: classes, error } = await admin
      .from("classes")
      .select("id, name, description, is_active, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const classIds = (classes || []).map((item) => item.id);

    let enrollments = [];
    let assignments = [];

    if (classIds.length) {
      const [enrollmentResult, assignmentResult] = await Promise.all([
        admin
          .from("student_enrollments")
          .select("class_id, student_id")
          .in("class_id", classIds)
          .is("end_date", null),

        admin
          .from("class_teachers")
          .select("id, class_id, teacher_id, teaching_days")
          .in("class_id", classIds),
      ]);

      if (enrollmentResult.error) throw enrollmentResult.error;
      if (assignmentResult.error) throw assignmentResult.error;

      enrollments = enrollmentResult.data || [];
      assignments = assignmentResult.data || [];
    }

    const teacherIds = [
      ...new Set(assignments.map((item) => item.teacher_id)),
    ];

    let teachersMap = new Map();

    if (teacherIds.length) {
      const { data: teachers, error: teachersError } = await admin
        .from("profiles")
        .select("id, full_name")
        .in("id", teacherIds);

      if (teachersError) throw teachersError;

      teachersMap = new Map(
        (teachers || []).map((item) => [item.id, item])
      );
    }

    const formatted = (classes || []).map((item) => {
      const studentCount = new Set(
        enrollments
          .filter((row) => row.class_id === item.id)
          .map((row) => row.student_id)
      ).size;

      const classAssignments = assignments
        .filter((row) => row.class_id === item.id)
        .map((row) => ({
          ...row,
          teacher: teachersMap.get(row.teacher_id) || null,
        }));

      return {
        ...item,
        student_count: studentCount,
        teachers: classAssignments,
      };
    });

    const { data: teacherProfiles, error: teacherProfilesError } = await admin
      .from("profiles")
      .select("id, full_name, username, is_active")
      .eq("role", "teacher")
      .order("full_name", { ascending: true });
    if (teacherProfilesError) throw teacherProfilesError;

    return NextResponse.json({
      success: true,
      classes: formatted,
      teachers: teacherProfiles || [],
    });
  } catch (error) {
    console.error("GET classes error:", error);

    return NextResponse.json(
      { error: "تعذر تحميل الحلقات." },
      { status: 500 }
    );
  }
}

async function requireEditor() {
  const manager = await getManager();

  if (manager.error) return manager;

  if (manager.profile.role === "platform_supervisor") {
    return {
      error: "حساب مشرف المنصة مخصص للمشاهدة فقط.",
      status: 403,
    };
  }

  return manager;
}

export async function POST(request) {
  try {
    const manager = await requireEditor();

    if (manager.error) {
      return NextResponse.json(
        { error: manager.error },
        { status: manager.status }
      );
    }

    const body = await request.json();

    if (body.action === "assign_teacher") {
      const classId = String(body.class_id || "");
      const teacherId = String(body.teacher_id || "");
      const teachingDays = Array.isArray(body.teaching_days) ? [...new Set(body.teaching_days.map(String))] : [];
      const validDays = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
      if (!classId || !teacherId || !teachingDays.length || teachingDays.some(day => !validDays.includes(day))) {
        return NextResponse.json({ error: "اختر الحلقة والمعلم ويوم تدريس واحدًا على الأقل." }, { status: 400 });
      }
      const { admin } = manager;
      const [{ data: classRow }, { data: teacher }] = await Promise.all([
        admin.from("classes").select("id").eq("id", classId).maybeSingle(),
        admin.from("profiles").select("id, full_name").eq("id", teacherId).eq("role", "teacher").eq("is_active", true).maybeSingle(),
      ]);
      if (!classRow || !teacher) return NextResponse.json({ error: "الحلقة أو حساب المعلم غير موجود أو غير نشط." }, { status: 404 });
      const { data: existing, error: existingError } = await admin.from("class_teachers").select("id").eq("class_id", classId).eq("teacher_id", teacherId).maybeSingle();
      if (existingError) throw existingError;
      if (existing) return NextResponse.json({ error: "هذا المعلم مسند إلى الحلقة بالفعل. يمكنك تعديل أيامه." }, { status: 409 });
      const { data, error } = await admin.from("class_teachers").insert({ class_id: classId, teacher_id: teacherId, teaching_days: teachingDays }).select("id, class_id, teacher_id, teaching_days").single();
      if (error) throw error;
      return NextResponse.json({ success: true, assignment: { ...data, teacher } }, { status: 201 });
    }

    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();

    if (!name) {
      return NextResponse.json(
        { error: "يرجى إدخال اسم الحلقة." },
        { status: 400 }
      );
    }

    const { admin } = manager;

    const { data: duplicate, error: duplicateError } = await admin
      .from("classes")
      .select("id")
      .ilike("name", name)
      .limit(1);

    if (duplicateError) throw duplicateError;

    if (duplicate?.length) {
      return NextResponse.json(
        { error: "اسم الحلقة مستخدم بالفعل." },
        { status: 409 }
      );
    }

    const { data, error } = await admin
      .from("classes")
      .insert({
        name,
        description: description || null,
        is_active: true,
      })
      .select("id, name, description, is_active, created_at, updated_at")
      .single();

    if (error) throw error;

    return NextResponse.json(
      {
        success: true,
        class: {
          ...data,
          student_count: 0,
          teachers: [],
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST classes error:", error);

    return NextResponse.json(
      { error: "تعذر إنشاء الحلقة." },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const manager = await requireEditor();

    if (manager.error) {
      return NextResponse.json(
        { error: manager.error },
        { status: manager.status }
      );
    }

    const body = await request.json();

    if (body.action === "update_assignment") {
      const assignmentId = String(body.assignment_id || "");
      const teachingDays = Array.isArray(body.teaching_days) ? [...new Set(body.teaching_days.map(String))] : [];
      const validDays = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
      if (!assignmentId || !teachingDays.length || teachingDays.some(day => !validDays.includes(day))) return NextResponse.json({ error: "حدد أيام تدريس صحيحة." }, { status: 400 });
      const { data, error } = await manager.admin.from("class_teachers").update({ teaching_days: teachingDays }).eq("id", assignmentId).select("id, class_id, teacher_id, teaching_days").maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: "الإسناد غير موجود." }, { status: 404 });
      return NextResponse.json({ success: true, assignment: data });
    }

    const id = String(body.id || "");
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();

    const isActive =
      typeof body.is_active === "boolean"
        ? body.is_active
        : null;

    if (!id) {
      return NextResponse.json(
        { error: "معرّف الحلقة غير موجود." },
        { status: 400 }
      );
    }

    if (isActive === null && !name) {
      return NextResponse.json(
        { error: "بيانات الحلقة غير مكتملة." },
        { status: 400 }
      );
    }

    const { admin } = manager;

    if (isActive !== null) {
      const { data, error } = await admin
        .from("classes")
        .update({ is_active: isActive })
        .eq("id", id)
        .select("id, name, description, is_active, created_at, updated_at")
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        return NextResponse.json(
          { error: "الحلقة غير موجودة." },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        class: data,
      });
    }

    const { data: duplicate, error: duplicateError } = await admin
      .from("classes")
      .select("id")
      .ilike("name", name)
      .neq("id", id)
      .limit(1);

    if (duplicateError) throw duplicateError;

    if (duplicate?.length) {
      return NextResponse.json(
        { error: "اسم الحلقة مستخدم بالفعل." },
        { status: 409 }
      );
    }

    const { data, error } = await admin
      .from("classes")
      .update({
        name,
        description: description || null,
      })
      .eq("id", id)
      .select("id, name, description, is_active, created_at, updated_at")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { error: "الحلقة غير موجودة." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      class: data,
    });
  } catch (error) {
    console.error("PATCH classes error:", error);

    return NextResponse.json(
      { error: "تعذر تحديث بيانات الحلقة." },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const manager = await requireEditor();
    if (manager.error) return NextResponse.json({ error: manager.error }, { status: manager.status });
    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get("assignment_id");
    if (!assignmentId) return NextResponse.json({ error: "معرّف الإسناد غير موجود." }, { status: 400 });
    const { error } = await manager.admin.from("class_teachers").delete().eq("id", assignmentId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE class assignment error:", error);
    return NextResponse.json({ error: "تعذر إلغاء إسناد المعلم." }, { status: 500 });
  }
}
