import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createSupabaseServer } from "../../../lib/supabaseServer";
import { createSupabaseAdmin } from "../../../lib/supabaseAdmin";
export const dynamic = "force-dynamic";

async function getContext() {
  const sb = await createSupabaseServer();
  const { data: { user }, error } = await sb.auth.getUser();
  if (error || !user) return { error: "انتهت جلسة الدخول. اتصل بالإنترنت وسجّل الدخول مجددًا.", status: 401 };
  const admin = createSupabaseAdmin();
  const { data: profile, error: pe } = await admin.from("profiles").select("id,username,full_name,role,is_active").eq("id", user.id).maybeSingle();
  if (pe || !profile?.is_active) return { error: "الحساب غير نشط أو لا يملك صلاحية الوصول.", status: 403 };
  return { admin, profile };
}
async function getScope(admin, profile) {
  if (["admin", "supervisor", "platform_supervisor"].includes(profile.role)) return { classIds: null, studentIds: null };
  if (profile.role === "teacher") {
    const { data, error } = await admin.from("class_teachers").select("class_id").eq("teacher_id", profile.id);
    if (error) throw error;
    const classIds = [...new Set((data || []).map(x => x.class_id))];
    const enrollments = classIds.length ? await admin.from("student_enrollments").select("student_id").in("class_id", classIds).is("end_date", null) : { data: [], error: null };
    if (enrollments.error) throw enrollments.error;
    return { classIds, studentIds: [...new Set((enrollments.data || []).map(x => x.student_id))] };
  }
  if (profile.role === "guardian") {
    const { data, error } = await admin.from("students").select("id").eq("guardian_id", profile.id).eq("is_active", true);
    if (error) throw error;
    const studentIds = (data || []).map(x => x.id);
    const enrolled = studentIds.length ? await admin.from("student_enrollments").select("class_id").in("student_id", studentIds).is("end_date", null) : { data: [], error: null };
    if (enrolled.error) throw enrolled.error;
    return { classIds: [...new Set((enrolled.data || []).map(x => x.class_id))], studentIds };
  }
  return { classIds: [], studentIds: [] };
}
const safeIds = ids => ids?.length ? ids : ["00000000-0000-0000-0000-000000000000"];
export async function GET() {
  try {
    const ctx = await getContext();
    if (ctx.error) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { admin, profile } = ctx;
    const scope = await getScope(admin, profile);
    let cq = admin.from("classes").select("id,name,is_active").eq("is_active", true).order("name");
    let sq = admin.from("students").select("id,first_name,middle_name,last_name,guardian_id,is_active").eq("is_active", true).order("first_name");
    if (scope.classIds) cq = cq.in("id", safeIds(scope.classIds));
    if (scope.studentIds) sq = sq.in("id", safeIds(scope.studentIds));
    const [cr, sr] = await Promise.all([cq, sq]);
    if (cr.error) throw cr.error; if (sr.error) throw sr.error;
    const classIds = (cr.data || []).map(x => x.id), studentIds = (sr.data || []).map(x => x.id);
    const [a,m,e,n,en,as] = await Promise.all([
      admin.from("attendance_records").select("*").in("student_id", safeIds(studentIds)).order("attendance_date", { ascending:false }).limit(5000),
      admin.from("memorization_records").select("*").in("student_id", safeIds(studentIds)).order("record_date", { ascending:false }).limit(5000),
      admin.from("exams").select("*").in("class_id", safeIds(classIds)).order("exam_date", { ascending:false }).limit(2000),
      admin.from("teacher_notes").select("*").in("student_id", safeIds(studentIds)).order("note_date", { ascending:false }).limit(3000),
      admin.from("student_enrollments").select("*").in("student_id", safeIds(studentIds)).limit(5000),
      admin.from("class_teachers").select("class_id,teacher_id,teaching_days").in("class_id", safeIds(classIds)),
    ]);
    for (const r of [a,m,e,n,en,as]) if (r.error) throw r.error;
    const examIds = (e.data || []).map(x => x.id);
    const rr = await admin.from("exam_results").select("*").in("exam_id", safeIds(examIds)).limit(5000);
    if (rr.error) throw rr.error;
    const teacherIds = [...new Set((as.data || []).map(x => x.teacher_id))];
    const tr = teacherIds.length ? await admin.from("profiles").select("id,full_name").in("id", teacherIds) : { data:[], error:null };
    if (tr.error) throw tr.error;
    const recordIds = [...(a.data||[]), ...(m.data||[]), ...(e.data||[]), ...(n.data||[]), ...(rr.data||[])].map(x=>x.id);
    const audit = recordIds.length ? await admin.from("record_audit_logs").select("id,record_table,record_id,action,changed_by,old_data,new_data,created_at").in("record_id", recordIds).order("created_at",{ascending:false}).limit(3000) : {data:[],error:null};
    if (audit.error) throw audit.error;
    const changerIds=[...new Set((audit.data||[]).map(x=>x.changed_by).filter(Boolean))];
    const changers=changerIds.length?await admin.from("profiles").select("id,full_name").in("id",changerIds):{data:[],error:null};
    if(changers.error)throw changers.error;
    return NextResponse.json({ success:true, data:{ profile, readOnly:["platform_supervisor","guardian"].includes(profile.role), classes:cr.data||[], students:sr.data||[], attendance:a.data||[], memorization:m.data||[], exams:e.data||[], notes:n.data||[], enrollments:en.data||[], assignments:as.data||[], examResults:rr.data||[], teachers:tr.data||[], auditLogs:(audit.data||[]).map(x=>({...x,changed_by_name:changers.data?.find(p=>p.id===x.changed_by)?.full_name||"النظام"})), fetchedAt:new Date().toISOString() } });
  } catch (e) { console.error("Educational records GET", e); return NextResponse.json({ error:"تعذر تحميل بيانات السجل التعليمي." }, { status:500 }); }
}
export async function POST(request) {
  try {
    const ctx = await getContext();
    if (ctx.error) return NextResponse.json({ error:ctx.error }, { status:ctx.status });
    const { admin, profile } = ctx;
    if (!["admin","supervisor","teacher"].includes(profile.role)) return NextResponse.json({ error:"ليس لديك صلاحية إضافة السجلات." }, { status:403 });
    const { operation, payload={} } = await request.json();
    const tables = { attendance:"attendance_records", memorization:"memorization_records", note:"teacher_notes", exam:"exams", exam_result:"exam_results" };
    const table = tables[operation]; if (!table) return NextResponse.json({ error:"نوع العملية غير مدعوم." }, { status:400 });
    const clientId = payload.client_operation_id || randomUUID();
    const dup = await admin.from(table).select("id").eq("client_operation_id", clientId).maybeSingle();
    if (dup.data) return NextResponse.json({ success:true, duplicate:true, id:dup.data.id });
    const { class_id:classId, student_id:studentId } = payload;
    if (profile.role === "teacher") {
      if (!classId) return NextResponse.json({ error:"الحلقة مطلوبة." }, { status:400 });
      const assignment = await admin.from("class_teachers").select("id").eq("class_id",classId).eq("teacher_id",profile.id).maybeSingle();
      if (assignment.error || !assignment.data) return NextResponse.json({ error:"هذه الحلقة غير مسندة إلى حسابك." }, { status:403 });
      if (studentId) { const enrolled = await admin.from("student_enrollments").select("id").eq("class_id",classId).eq("student_id",studentId).is("end_date",null).maybeSingle(); if (enrolled.error || !enrolled.data) return NextResponse.json({ error:"الطالب غير مسجل في هذه الحلقة." }, { status:403 }); }
    }
    let row;
    if (operation === "attendance") {
      if (!studentId || !classId || !payload.attendance_date || !["حاضر","غائب","متأخر","مستأذن"].includes(payload.status)) return NextResponse.json({ error:"تحقق من بيانات الحضور." }, { status:400 });
      row={client_operation_id:clientId,student_id:studentId,class_id:classId,created_by:profile.id,attendance_date:payload.attendance_date,status:payload.status,notes:payload.notes||null};
    } else if (operation === "memorization") {
      const sn=Number(payload.surah_number), fa=Number(payload.from_ayah), ta=Number(payload.to_ayah);
      if (!studentId||!classId||!payload.record_date||!payload.record_type||!payload.verbal_rating||!Number.isInteger(sn)||sn<1||sn>114||!Number.isInteger(fa)||fa<1||!Number.isInteger(ta)||ta<fa) return NextResponse.json({error:"تحقق من بيانات الحفظ والمراجعة."},{status:400});
      row={client_operation_id:clientId,student_id:studentId,class_id:classId,created_by:profile.id,record_type:payload.record_type,surah_number:sn,from_ayah:fa,to_ayah:ta,verbal_rating:payload.verbal_rating,notes:payload.notes||null,record_date:payload.record_date};
    } else if (operation === "note") {
      if(!studentId||!classId||!payload.note?.trim()||!payload.note_date) return NextResponse.json({error:"اكتب الملاحظة وحدد تاريخها."},{status:400});
      row={client_operation_id:clientId,student_id:studentId,class_id:classId,created_by:profile.id,note:payload.note.trim(),note_date:payload.note_date};
    } else if (operation === "exam") {
      if(!classId||!payload.title?.trim()||!payload.exam_date) return NextResponse.json({error:"عنوان الاختبار وتاريخه والحلقة مطلوبة."},{status:400});
      row={client_operation_id:clientId,class_id:classId,created_by:profile.id,title:payload.title.trim(),description:payload.description||null,exam_date:payload.exam_date};
    } else {
      if(!payload.exam_id||!studentId||!Number.isFinite(Number(payload.score))||Number(payload.score)<0) return NextResponse.json({error:"تحقق من نتيجة الاختبار."},{status:400});
      const er=await admin.from("exams").select("id,class_id").eq("id",payload.exam_id).maybeSingle();
      if(er.error||!er.data) return NextResponse.json({error:"الاختبار غير موجود."},{status:404});
      if(profile.role==="teacher"){
        const ar=await admin.from("class_teachers").select("id").eq("class_id",er.data.class_id).eq("teacher_id",profile.id).maybeSingle();
        if(ar.error||!ar.data)return NextResponse.json({error:"لا تملك صلاحية هذا الاختبار."},{status:403});
        const enrollment=await admin.from("student_enrollments").select("id").eq("class_id",er.data.class_id).eq("student_id",studentId).is("end_date",null).maybeSingle();
        if(enrollment.error||!enrollment.data)return NextResponse.json({error:"الطالب غير مسجل في حلقة الاختبار."},{status:403});
      }
      row={client_operation_id:clientId,exam_id:payload.exam_id,student_id:studentId,created_by:profile.id,score:Number(payload.score),notes:payload.notes||null};
    }
    const saved=await admin.from(table).insert(row).select("*").single();
    if(saved.error){if(saved.error.code==="23505")return NextResponse.json({success:true,duplicate:true});throw saved.error;}
    return NextResponse.json({success:true,row:saved.data});
  } catch(e){console.error("Educational records POST",e);return NextResponse.json({error:"تعذر حفظ السجل. تحقق من البيانات والاتصال."},{status:500});}
}
