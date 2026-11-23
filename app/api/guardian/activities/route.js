import { NextResponse } from "next/server";
import { createSupabaseServer } from "../../../../lib/supabaseServer";
import { createSupabaseAdmin } from "../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

async function getGuardian() {
  const sb = await createSupabaseServer();
  const { data: { user }, error } = await sb.auth.getUser();
  if (error || !user) return { error: "يجب تسجيل الدخول أولًا.", status: 401 };
  const db = createSupabaseAdmin();
  const { data: profile, error: pe } = await db.from("profiles")
    .select("id,role,is_active").eq("id", user.id).maybeSingle();
  if (pe || !profile?.is_active || profile.role !== "guardian")
    return { error: "هذه الخدمة متاحة لأولياء الأمور فقط.", status: 403 };
  return { db, profile };
}

const safeIds = ids => ids.length ? ids : ["00000000-0000-0000-0000-000000000000"];

export async function GET() {
  try {
    const ctx = await getGuardian();
    if (ctx.error) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { db, profile } = ctx;
    const childrenResult = await db.from("students")
      .select("id,first_name,middle_name,last_name").eq("guardian_id", profile.id)
      .eq("is_active", true).order("first_name");
    if (childrenResult.error) throw childrenResult.error;
    const children = childrenResult.data || [];
    const studentIds = children.map(x => x.id);
    const activityResult = await db.from("activities").select("*")
      .eq("status", "published").order("activity_date", { ascending: true });
    if (activityResult.error) throw activityResult.error;
    const activities = activityResult.data || [];
    const activityIds = activities.map(x => x.id);
    const responseResult = studentIds.length && activityIds.length
      ? await db.from("activity_responses")
        .select("activity_id,student_id,decision,signature_strokes,signed_at,responded_at")
        .eq("guardian_id", profile.id).in("student_id", safeIds(studentIds))
        .in("activity_id", safeIds(activityIds))
      : { data: [], error: null };
    if (responseResult.error) throw responseResult.error;
    const now = Date.now();
    return NextResponse.json({
      success: true,
      children,
      activities: activities.map(a => ({
        ...a,
        can_respond: !a.response_deadline || new Date(a.response_deadline).getTime() >= now
      })),
      responses: responseResult.data || []
    });
  } catch (e) {
    console.error("Guardian activities GET:", e);
    return NextResponse.json({ error: "تعذر تحميل الأنشطة." }, { status: 500 });
  }
}

function validStrokes(strokes) {
  if (!Array.isArray(strokes) || !strokes.length || strokes.length > 80) return false;
  let total = 0;
  for (const stroke of strokes) {
    if (!Array.isArray(stroke) || !stroke.length || stroke.length > 500) return false;
    total += stroke.length;
    if (total > 4000) return false;
    for (const point of stroke) {
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) ||
          point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) return false;
    }
  }
  return true;
}

export async function POST(request) {
  try {
    const ctx = await getGuardian();
    if (ctx.error) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { db, profile } = ctx;
    const body = await request.json();
    const activityId = String(body.activity_id || "");
    const studentId = String(body.student_id || "");
    const decision = body.decision;
    if (!activityId || !studentId || !["accepted", "declined"].includes(decision))
      return NextResponse.json({ error: "بيانات الموافقة غير مكتملة." }, { status: 400 });

    const [studentResult, activityResult] = await Promise.all([
      db.from("students").select("id").eq("id", studentId)
        .eq("guardian_id", profile.id).eq("is_active", true).maybeSingle(),
      db.from("activities").select("id,status,response_deadline").eq("id", activityId).maybeSingle()
    ]);
    if (studentResult.error) throw studentResult.error;
    if (activityResult.error) throw activityResult.error;
    if (!studentResult.data) return NextResponse.json({ error: "هذا الابن غير مرتبط بحسابك." }, { status: 403 });
    const activity = activityResult.data;
    if (!activity || activity.status !== "published")
      return NextResponse.json({ error: "هذا النشاط غير متاح لاستقبال الردود." }, { status: 400 });
    if (activity.response_deadline && new Date(activity.response_deadline).getTime() < Date.now())
      return NextResponse.json({ error: "انتهت مهلة الرد على هذا النشاط." }, { status: 400 });

    const strokes = decision === "accepted" ? body.signature_strokes : null;
    if (decision === "accepted" && !validStrokes(strokes))
      return NextResponse.json({ error: "يرجى إضافة التوقيع قبل تأكيد الموافقة." }, { status: 400 });

    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const candidateIp = forwarded || request.headers.get("x-real-ip") || null;
    const ip = candidateIp && /^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-fA-F:]+$/.test(candidateIp) ? candidateIp : null;
    const now = new Date().toISOString();
    const row = {
      activity_id: activityId,
      student_id: studentId,
      guardian_id: profile.id,
      decision,
      signature_strokes: strokes,
      signed_at: decision === "accepted" ? now : null,
      responded_at: now,
      device_info: (request.headers.get("user-agent") || "").slice(0, 500) || null,
      ip_address: ip
    };
    const { data, error } = await db.from("activity_responses")
      .upsert(row, { onConflict: "activity_id,student_id" })
      .select("activity_id,student_id,decision,signed_at,responded_at").single();
    if (error) throw error;
    return NextResponse.json({ success: true, response: data });
  } catch (e) {
    console.error("Guardian activities POST:", e);
    return NextResponse.json({ error: "تعذر حفظ الرد. حاول مرة أخرى." }, { status: 500 });
  }
}
