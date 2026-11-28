import { NextResponse } from "next/server";
import { createSupabaseServer } from "../../../lib/supabaseServer";
import { createSupabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

async function getManager() {
  const supabase = await createSupabaseServer();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: "يجب تسجيل الدخول أولًا.", status: 401 };

  const admin = createSupabaseAdmin();
  const { data: profile, error: profileError } = await admin
    .from("profiles").select("id, full_name, role, is_active").eq("id", user.id).maybeSingle();

  if (profileError || !profile || !profile.is_active ||
      !["admin", "supervisor", "platform_supervisor"].includes(profile.role)) {
    return { error: "ليس لديك صلاحية تنفيذ هذه العملية.", status: 403 };
  }
  return { admin, profile };
}

function denyPlatformSupervisor(profile) {
  return profile.role === "platform_supervisor"
    ? NextResponse.json({ error: "حساب مشرف المنصة مخصص للمشاهدة فقط." }, { status: 403 })
    : null;
}

export async function GET() {
  try {
    const ctx = await getManager();
    if (ctx.error) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const { data: students, error } = await ctx.admin.from("students").select(`
      id, first_name, middle_name, last_name, birth_date, gender, guardian_id,
      notes, is_active, created_at
    `).order("created_at", { ascending: false });
    if (error) throw error;
    if (!students?.length) return NextResponse.json({ success: true, students: [] });

    const guardianIds = [...new Set(students.map(s => s.guardian_id).filter(Boolean))];
    let guardiansMap = new Map();
    if (guardianIds.length) {
      const { data: guardians, error: guardianError } = await ctx.admin.from("profiles")
        .select("id, full_name, username, is_active").in("id", guardianIds);
      if (guardianError) throw guardianError;
      guardiansMap = new Map((guardians || []).map(g => [g.id, g]));
    }

    const studentIds = students.map(s => s.id);
    const { data: enrollments, error: enrollmentError } = await ctx.admin.from("student_enrollments")
      .select("id, student_id, class_id, start_date, end_date")
      .in("student_id", studentIds).is("end_date", null).order("start_date", { ascending: false });
    if (enrollmentError) throw enrollmentError;

    const currentEnrollments = new Map();
    for (const item of enrollments || []) if (!currentEnrollments.has(item.student_id)) currentEnrollments.set(item.student_id, item);

    const classIds = [...new Set([...currentEnrollments.values()].map(e => e.class_id).filter(Boolean))];
    let classesMap = new Map();
    if (classIds.length) {
      const { data: classes, error: classError } = await ctx.admin.from("classes").select("id, name").in("id", classIds);
      if (classError) throw classError;
      classesMap = new Map((classes || []).map(c => [c.id, c]));
    }

    return NextResponse.json({
      success: true,
      students: students.map(student => {
        const enrollment = currentEnrollments.get(student.id);
        return {
          ...student,
          guardian: student.guardian_id ? guardiansMap.get(student.guardian_id) || null : null,
          current_enrollment: enrollment ? { ...enrollment, class: classesMap.get(enrollment.class_id) || null } : null,
        };
      }),
    });
  } catch (error) {
    console.error("GET students error:", error);
    return NextResponse.json({ error: "تعذر تحميل بيانات الطلاب." }, { status: 500 });
  }
}

export async function POST(request) {
  let createdAuthUserId = null;
  let createdProfileId = null;
  try {
    const ctx = await getManager();
    if (ctx.error) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const denied = denyPlatformSupervisor(ctx.profile);
    if (denied) return denied;

    const body = await request.json();
    const clean = value => String(value || "").trim();
    const firstName = clean(body.first_name) || null;
    const middleName = clean(body.middle_name) || null;
    const lastName = clean(body.last_name) || null;
    const birthDate = body.birth_date || null;
    const gender = ["male", "female"].includes(body.gender) ? body.gender : null;
    const notes = clean(body.notes) || null;
    const classId = clean(body.class_id) || null;

    if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      return NextResponse.json({ error: "تاريخ الميلاد غير صالح." }, { status: 400 });
    }

    let guardianId = clean(body.guardian_id) || null;
    let guardian = null;
    let initialPassword = null;
    let guardianIsNew = false;
    const guardianMode = body.guardian_mode || "none";

    if (guardianMode === "existing") {
      if (!guardianId) return NextResponse.json({ error: "اختر ولي الأمر أو اتركه دون ربط." }, { status: 400 });
      const { data, error } = await ctx.admin.from("profiles")
        .select("id, full_name, username, role, is_active").eq("id", guardianId).maybeSingle();
      if (error) throw error;
      if (!data || data.role !== "guardian" || !data.is_active) {
        return NextResponse.json({ error: "حساب ولي الأمر غير موجود أو غير نشط." }, { status: 400 });
      }
      guardian = data;
    } else if (guardianMode === "new") {
      const guardianName = clean(body.guardian_name);
      const username = clean(body.username);
      initialPassword = String(body.password || "");
      const anyGuardianField = guardianName || username || initialPassword;
      if (anyGuardianField && (!guardianName || !username || initialPassword.length < 8)) {
        return NextResponse.json({ error: "لإنشاء حساب ولي الأمر أكمل الاسم واسم المستخدم وكلمة مرور من 8 أحرف على الأقل، أو اترك الحقول كلها فارغة." }, { status: 400 });
      }
      if (anyGuardianField) {
        if (username.length < 3 || username.length > 40 || /\s/.test(username)) {
          return NextResponse.json({ error: "اسم المستخدم يجب أن يكون بين 3 و40 حرفًا دون مسافات." }, { status: 400 });
        }
        const { data: duplicate, error: duplicateError } = await ctx.admin.from("profiles")
          .select("id").ilike("username", username).limit(1);
        if (duplicateError) throw duplicateError;
        if (duplicate?.length) return NextResponse.json({ error: "اسم المستخدم مستخدم بالفعل." }, { status: 409 });

        const { data: authData, error: authError } = await ctx.admin.auth.admin.createUser({
          email: `guardian-${crypto.randomUUID()}@accounts.rahma.internal`,
          password: initialPassword,
          email_confirm: true,
          user_metadata: { full_name: guardianName },
        });
        if (authError || !authData?.user) throw authError || new Error("تعذر إنشاء حساب ولي الأمر.");
        guardianId = authData.user.id;
        createdAuthUserId = guardianId;
        const { error: profileError } = await ctx.admin.from("profiles").insert({
          id: guardianId, username, full_name: guardianName, role: "guardian", is_active: true,
        });
        if (profileError) throw profileError;
        createdProfileId = guardianId;
        guardian = { id: guardianId, full_name: guardianName, username, is_active: true };
        guardianIsNew = true;
      } else {
        guardianId = null;
        initialPassword = null;
      }
    } else if (guardianMode === "none") {
      guardianId = null;
    } else {
      return NextResponse.json({ error: "نوع ربط ولي الأمر غير صالح." }, { status: 400 });
    }

    let selectedClass = null;
    if (classId) {
      const { data, error } = await ctx.admin.from("classes")
        .select("id, name, is_active").eq("id", classId).maybeSingle();
      if (error) throw error;
      if (!data || !data.is_active) return NextResponse.json({ error: "الحلقة المحددة غير موجودة أو غير نشطة." }, { status: 400 });
      selectedClass = data;
    }

    const { data: student, error: studentError } = await ctx.admin.from("students").insert({
      first_name: firstName, middle_name: middleName, last_name: lastName,
      birth_date: birthDate, gender, guardian_id: guardianId, notes, is_active: true,
    }).select().single();
    if (studentError) throw studentError;

    if (selectedClass) {
      const { error: enrollmentError } = await ctx.admin.from("student_enrollments").insert({
        student_id: student.id, class_id: selectedClass.id,
        start_date: new Date().toISOString().slice(0, 10),
      });
      if (enrollmentError) {
        await ctx.admin.from("students").delete().eq("id", student.id);
        throw enrollmentError;
      }
    }

    let teacherNames = [];
    if (selectedClass) {
      const { data: assignments, error: assignmentError } = await ctx.admin.from("class_teachers")
        .select("teacher_id").eq("class_id", selectedClass.id);
      if (assignmentError) throw assignmentError;
      const ids = [...new Set((assignments || []).map(a => a.teacher_id))];
      if (ids.length) {
        const { data: teachers, error: teachersError } = await ctx.admin.from("profiles")
          .select("full_name").in("id", ids);
        if (teachersError) throw teachersError;
        teacherNames = (teachers || []).map(t => t.full_name).filter(Boolean);
      }
    }

    return NextResponse.json({
      success: true,
      student,
      guardian: guardian ? { ...guardian, is_new: guardianIsNew } : null,
      class: selectedClass,
      teacher_names: teacherNames,
      registration_date: new Date().toISOString().slice(0, 10),
      initial_password: guardianIsNew ? initialPassword : null,
    }, { status: 201 });
  } catch (error) {
    console.error("POST students error:", error);
    const admin = createSupabaseAdmin();
    if (createdProfileId) await admin.from("profiles").delete().eq("id", createdProfileId);
    if (createdAuthUserId) await admin.auth.admin.deleteUser(createdAuthUserId);
    return NextResponse.json({
      error: error?.code === "23505" ? "اسم المستخدم مستخدم بالفعل." : "تعذر إكمال تسجيل الطالب.",
    }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const ctx = await getManager();
    if (ctx.error) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const denied = denyPlatformSupervisor(ctx.profile);
    if (denied) return denied;

    const body = await request.json();
    const id = String(body.id || "");
    if (!id) return NextResponse.json({ error: "معرّف الطالب مطلوب." }, { status: 400 });

    const { data: current, error: currentError } = await ctx.admin.from("students")
      .select("id, guardian_id").eq("id", id).maybeSingle();
    if (currentError) throw currentError;
    if (!current) return NextResponse.json({ error: "الطالب غير موجود." }, { status: 404 });

    const clean = value => String(value || "").trim();
    const updates = {
      first_name: clean(body.first_name) || null,
      middle_name: clean(body.middle_name) || null,
      last_name: clean(body.last_name) || null,
      birth_date: body.birth_date || null,
      gender: ["male", "female"].includes(body.gender) ? body.gender : null,
      notes: clean(body.notes) || null,
      guardian_id: clean(body.guardian_id) || null,
    };
    if (updates.birth_date && !/^\d{4}-\d{2}-\d{2}$/.test(updates.birth_date)) {
      return NextResponse.json({ error: "تاريخ الميلاد غير صالح." }, { status: 400 });
    }
    if (updates.guardian_id) {
      const { data: guardian, error } = await ctx.admin.from("profiles")
        .select("id, role, is_active").eq("id", updates.guardian_id).maybeSingle();
      if (error) throw error;
      if (!guardian || guardian.role !== "guardian" || !guardian.is_active) {
        return NextResponse.json({ error: "حساب ولي الأمر غير صالح." }, { status: 400 });
      }
    }

    const { error: updateError } = await ctx.admin.from("students").update(updates).eq("id", id);
    if (updateError) throw updateError;

    if (Object.prototype.hasOwnProperty.call(body, "class_id")) {
      const classId = clean(body.class_id) || null;
      const { data: activeEnrollment, error: enrollmentLookupError } = await ctx.admin.from("student_enrollments")
        .select("id").eq("student_id", id).is("end_date", null).order("start_date", { ascending: false }).limit(1);
      if (enrollmentLookupError) throw enrollmentLookupError;
      if (activeEnrollment?.length) {
        const { error } = await ctx.admin.from("student_enrollments")
          .update({ end_date: new Date().toISOString().slice(0, 10) }).eq("id", activeEnrollment[0].id);
        if (error) throw error;
      }
      if (classId) {
        const { data: targetClass, error: classError } = await ctx.admin.from("classes")
          .select("id, is_active").eq("id", classId).maybeSingle();
        if (classError) throw classError;
        if (!targetClass || !targetClass.is_active) return NextResponse.json({ error: "الحلقة المحددة غير موجودة أو غير نشطة." }, { status: 400 });
        const { error } = await ctx.admin.from("student_enrollments").insert({
          student_id: id, class_id: classId, start_date: new Date().toISOString().slice(0, 10),
        });
        if (error) throw error;
      }
    }

    return NextResponse.json({ success: true, message: "تم تحديث بيانات الطالب." });
  } catch (error) {
    console.error("PATCH students error:", error);
    return NextResponse.json({ error: "تعذر تحديث بيانات الطالب." }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const ctx = await getManager();
    if (ctx.error) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const denied = denyPlatformSupervisor(ctx.profile);
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "معرّف الطالب مطلوب." }, { status: 400 });

    const { data: student, error: studentError } = await ctx.admin.from("students")
      .select("id, is_active").eq("id", id).maybeSingle();
    if (studentError) throw studentError;
    if (!student) return NextResponse.json({ error: "الطالب غير موجود." }, { status: 404 });

    const references = ["attendance_records", "memorization_records", "exam_results", "teacher_notes", "activity_responses"];
    let hasHistory = false;
    for (const table of references) {
      const { data, error } = await ctx.admin.from(table).select("id").eq("student_id", id).limit(1);
      if (error) throw error;
      if (data?.length) { hasHistory = true; break; }
    }

    if (hasHistory) {
      const today = new Date().toISOString().slice(0, 10);
      const { error: enrollmentError } = await ctx.admin.from("student_enrollments")
        .update({ end_date: today }).eq("student_id", id).is("end_date", null);
      if (enrollmentError) throw enrollmentError;
      const { error } = await ctx.admin.from("students").update({ is_active: false }).eq("id", id);
      if (error) throw error;
      return NextResponse.json({ success: true, archived: true, message: "للطلاب سجلات تعليمية محفوظة؛ تم إيقاف الطالب وأرشفة حسابه مع الاحتفاظ بسجلاته." });
    }

    const { error: enrollmentError } = await ctx.admin.from("student_enrollments").delete().eq("student_id", id);
    if (enrollmentError) throw enrollmentError;
    const { error } = await ctx.admin.from("students").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true, archived: false, message: "تم حذف حساب الطالب." });
  } catch (error) {
    console.error("DELETE students error:", error);
    return NextResponse.json({ error: "تعذر حذف حساب الطالب." }, { status: 500 });
  }
}
