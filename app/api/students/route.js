import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
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
    !["admin", "supervisor"].includes(profile.role)
  ) {
    return {
      error: "ليس لديك صلاحية تنفيذ هذه العملية.",
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

    const { data: students, error: studentsError } = await admin
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

    if (studentsError) throw studentsError;

    if (!students?.length) {
      return NextResponse.json({
        success: true,
        students: [],
      });
    }

    const guardianIds = [
      ...new Set(students.map((item) => item.guardian_id)),
    ];

    const { data: guardians, error: guardiansError } = await admin
      .from("profiles")
      .select("id, full_name, username, is_active")
      .in("id", guardianIds);

    if (guardiansError) throw guardiansError;

    const guardiansMap = new Map(
      (guardians || []).map((item) => [item.id, item])
    );

    const studentIds = students.map((item) => item.id);

    const { data: enrollments, error: enrollmentsError } = await admin
      .from("student_enrollments")
      .select("id, student_id, class_id, start_date")
      .in("student_id", studentIds)
      .is("end_date", null)
      .order("start_date", { ascending: false });

    if (enrollmentsError) throw enrollmentsError;

    const currentEnrollments = new Map();

    for (const item of enrollments || []) {
      if (!currentEnrollments.has(item.student_id)) {
        currentEnrollments.set(item.student_id, item);
      }
    }

    const classIds = [
      ...new Set(
        [...currentEnrollments.values()].map((item) => item.class_id)
      ),
    ];

    let classesMap = new Map();

    if (classIds.length) {
      const { data: classes, error: classesError } = await admin
        .from("classes")
        .select("id, name")
        .in("id", classIds);

      if (classesError) throw classesError;

      classesMap = new Map(
        (classes || []).map((item) => [item.id, item])
      );
    }

    const formattedStudents = students.map((student) => {
      const enrollment = currentEnrollments.get(student.id);

      return {
        ...student,
        guardian: guardiansMap.get(student.guardian_id) || null,
        current_enrollment: enrollment
          ? {
              ...enrollment,
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
    console.error("GET students error:", error);

    return NextResponse.json(
      { error: "تعذر تحميل بيانات الطلاب." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  let createdAuthUserId = null;
  let createdProfileId = null;

  try {
    const manager = await getManager();

    if (manager.error) {
      return NextResponse.json(
        { error: manager.error },
        { status: manager.status }
      );
    }

    const { admin } = manager;
    const body = await request.json();

    const firstName = String(body.first_name || "").trim();
    const middleName = String(body.middle_name || "").trim();
    const lastName = String(body.last_name || "").trim();
    const birthDate = body.birth_date || null;
    const notes = String(body.notes || "").trim();
    const classId = body.class_id;
    const guardianMode = body.guardian_mode;

    if (!firstName || !lastName || !classId) {
      return NextResponse.json(
        { error: "يرجى إدخال اسم الطالب واختيار الحلقة." },
        { status: 400 }
      );
    }

    if (
      birthDate &&
      !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)
    ) {
      return NextResponse.json(
        { error: "تاريخ الميلاد غير صالح." },
        { status: 400 }
      );
    }

    const { data: selectedClass, error: classError } = await admin
      .from("classes")
      .select("id, name, is_active")
      .eq("id", classId)
      .maybeSingle();

    if (classError || !selectedClass || !selectedClass.is_active) {
      return NextResponse.json(
        { error: "الحلقة المحددة غير موجودة أو غير نشطة." },
        { status: 400 }
      );
    }

    const { data: teacherAssignments, error: teacherError } = await admin
      .from("class_teachers")
      .select("teacher_id")
      .eq("class_id", classId);

    if (teacherError) throw teacherError;

    const teacherIds = [
      ...new Set((teacherAssignments || []).map((item) => item.teacher_id)),
    ];

    let teacherNames = [];

    if (teacherIds.length) {
      const { data: teachers, error: teachersError } = await admin
        .from("profiles")
        .select("id, full_name")
        .in("id", teacherIds);

      if (teachersError) throw teachersError;

      teacherNames = (teachers || []).map((item) => item.full_name);
    }

    let guardianId;
    let guardianName;
    let guardianUsername;
    let initialPassword = null;
    let guardianIsNew = false;

    if (guardianMode === "existing") {
      const existingGuardianId = body.guardian_id;

      if (!existingGuardianId) {
        return NextResponse.json(
          { error: "يرجى اختيار ولي الأمر." },
          { status: 400 }
        );
      }

      const { data: guardian, error: guardianError } = await admin
        .from("profiles")
        .select("id, full_name, username, role, is_active")
        .eq("id", existingGuardianId)
        .maybeSingle();

      if (
        guardianError ||
        !guardian ||
        guardian.role !== "guardian" ||
        !guardian.is_active
      ) {
        return NextResponse.json(
          { error: "حساب ولي الأمر غير موجود أو غير نشط." },
          { status: 400 }
        );
      }

      guardianId = guardian.id;
      guardianName = guardian.full_name;
      guardianUsername = guardian.username;
    } else if (guardianMode === "new") {
      guardianName = String(body.guardian_name || "").trim();
      guardianUsername = String(body.username || "").trim();
      initialPassword = String(body.password || "");

      if (!guardianName || !guardianUsername || !initialPassword) {
        return NextResponse.json(
          { error: "يرجى إدخال اسم ولي الأمر واسم المستخدم وكلمة المرور." },
          { status: 400 }
        );
      }

      if (guardianUsername.length < 3 || guardianUsername.length > 40) {
        return NextResponse.json(
          { error: "اسم المستخدم يجب أن يكون بين 3 و40 حرفًا." },
          { status: 400 }
        );
      }

      if (/\s/.test(guardianUsername)) {
        return NextResponse.json(
          { error: "اسم المستخدم لا يقبل المسافات." },
          { status: 400 }
        );
      }

      if (initialPassword.length < 8) {
        return NextResponse.json(
          { error: "كلمة المرور يجب ألا تقل عن 8 أحرف." },
          { status: 400 }
        );
      }

      const { data: duplicate, error: duplicateError } = await admin
        .from("profiles")
        .select("id")
        .ilike("username", guardianUsername)
        .maybeSingle();

      if (duplicateError) throw duplicateError;

      if (duplicate) {
        return NextResponse.json(
          { error: "اسم المستخدم مستخدم بالفعل، اختر اسمًا آخر." },
          { status: 409 }
        );
      }

      const authEmail = `guardian-${randomUUID()}@accounts.rahma.internal`;

      const {
        data: authData,
        error: authError,
      } = await admin.auth.admin.createUser({
        email: authEmail,
        password: initialPassword,
        email_confirm: true,
        user_metadata: {
          full_name: guardianName,
        },
      });

      if (authError || !authData?.user) {
        throw authError || new Error("تعذر إنشاء حساب المصادقة.");
      }

      guardianId = authData.user.id;
      createdAuthUserId = guardianId;

      const { error: profileInsertError } = await admin
        .from("profiles")
        .insert({
          id: guardianId,
          username: guardianUsername,
          full_name: guardianName,
          role: "guardian",
          is_active: true,
        });

      if (profileInsertError) {
        throw profileInsertError;
      }

      createdProfileId = guardianId;
      guardianIsNew = true;
    } else {
      return NextResponse.json(
        { error: "نوع حساب ولي الأمر غير صالح." },
        { status: 400 }
      );
    }

    const { data: student, error: studentError } = await admin
      .from("students")
      .insert({
        first_name: firstName,
        middle_name: middleName || null,
        last_name: lastName,
        birth_date: birthDate,
        gender: "male",
        guardian_id: guardianId,
        notes: notes || null,
        is_active: true,
      })
      .select()
      .single();

    if (studentError) throw studentError;

    const { error: enrollmentError } = await admin
      .from("student_enrollments")
      .insert({
        student_id: student.id,
        class_id: classId,
        start_date: new Date().toISOString().slice(0, 10),
      });

    if (enrollmentError) {
      await admin.from("students").delete().eq("id", student.id);
      throw enrollmentError;
    }

    return NextResponse.json({
      success: true,
      student: {
        id: student.id,
        first_name: student.first_name,
        middle_name: student.middle_name,
        last_name: student.last_name,
        birth_date: student.birth_date,
      },
      guardian: {
        id: guardianId,
        full_name: guardianName,
        username: guardianUsername,
        is_new: guardianIsNew,
      },
      class: {
        id: selectedClass.id,
        name: selectedClass.name,
      },
      teacher_names: teacherNames,
      registration_date: new Date().toISOString().slice(0, 10),
      initial_password: guardianIsNew ? initialPassword : null,
    });
  } catch (error) {
    console.error("POST students error:", error);

    try {
      const admin = createSupabaseAdmin();

      if (createdProfileId) {
        await admin.from("profiles").delete().eq("id", createdProfileId);
      }

      if (createdAuthUserId) {
        await admin.auth.admin.deleteUser(createdAuthUserId);
      }
    } catch (cleanupError) {
      console.error("Guardian cleanup error:", cleanupError);
    }

    const duplicateUsername =
      error?.code === "23505" ||
      String(error?.message || "").toLowerCase().includes("username");

    return NextResponse.json(
      {
        error: duplicateUsername
          ? "اسم المستخدم مستخدم بالفعل."
          : "تعذر إكمال تسجيل الطالب. لم يتم اعتماد بطاقة التسجيل.",
      },
      { status: 500 }
    );
  }
}
