import { NextResponse } from "next/server";
import { createSupabaseServer } from "../../../lib/supabaseServer";
import { createSupabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
const managers = ["admin", "supervisor", "platform_supervisor"];
const editors = ["admin", "supervisor"];

async function context() {
  const sb = await createSupabaseServer();
  const { data: { user }, error } = await sb.auth.getUser();
  if (error || !user) return { error: "يجب تسجيل الدخول أولًا.", status: 401 };
  const db = createSupabaseAdmin();
  const { data: profile, error: pe } = await db.from("profiles")
    .select("id,full_name,role,is_active").eq("id", user.id).maybeSingle();
  if (pe || !profile?.is_active || !managers.includes(profile.role))
    return { error: "ليس لديك صلاحية الوصول إلى إدارة الأنشطة.", status: 403 };
  return { db, profile };
}

export async function GET() {
  try {
    const ctx = await context();
    if (ctx.error) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { data: activities, error } = await ctx.db.from("activities").select("*")
      .order("activity_date", { ascending: false }).order("created_at", { ascending: false });
    if (error) throw error;
    const ids = (activities || []).map(x => x.id);
    let responses = [];
    if (ids.length) {
      const r = await ctx.db.from("activity_responses").select("id,activity_id,student_id,guardian_id,decision,signature_strokes,signed_at,responded_at,device_info,ip_address")
        .in("activity_id", ids).order("responded_at", { ascending: false });
      if (r.error) throw r.error;
      responses = r.data || [];
    }
    const studentIds = [...new Set(responses.map(x => x.student_id))];
    const guardianIds = [...new Set(responses.map(x => x.guardian_id))];
    const [sr, gr] = await Promise.all([
      studentIds.length ? ctx.db.from("students").select("id,first_name,middle_name,last_name").in("id", studentIds) : {data:[],error:null},
      guardianIds.length ? ctx.db.from("profiles").select("id,full_name").in("id", guardianIds) : {data:[],error:null}
    ]);
    if (sr.error) throw sr.error;
    if (gr.error) throw gr.error;
    const students = new Map((sr.data || []).map(x => [x.id, [x.first_name,x.middle_name,x.last_name].filter(Boolean).join(" ")]));
    const guardians = new Map((gr.data || []).map(x => [x.id, x.full_name]));
    return NextResponse.json({ success:true, readOnly:ctx.profile.role === "platform_supervisor",
      activities:activities || [],
      responses:responses.map(x => ({...x,student_name:students.get(x.student_id) || "طالب",guardian_name:guardians.get(x.guardian_id) || "ولي الأمر"}))
    });
  } catch (e) {
    console.error("Activities GET:", e);
    return NextResponse.json({ error:"تعذر تحميل الأنشطة والردود." }, { status:500 });
  }
}

export async function POST(request) {
  try {
    const ctx = await context();
    if (ctx.error) return NextResponse.json({error:ctx.error},{status:ctx.status});
    if (!editors.includes(ctx.profile.role)) return NextResponse.json({error:"حساب مشرف المنصة مخصص للمشاهدة فقط."},{status:403});
    const body = await request.json();
    const title = String(body.title || "").trim();
    const activity_type = String(body.activity_type || "").trim();
    const activity_date = String(body.activity_date || "");
    const start_time = body.start_time || null;
    const end_time = body.end_time || null;
    if (title.length < 2 || title.length > 160 || activity_type.length < 2 || activity_type.length > 80 || !/^\d{4}-\d{2}-\d{2}$/.test(activity_date))
      return NextResponse.json({error:"أدخل اسم النشاط ونوعه وتاريخه بصورة صحيحة."},{status:400});
    if (start_time && end_time && end_time <= start_time)
      return NextResponse.json({error:"وقت النهاية يجب أن يكون بعد وقت البداية."},{status:400});
    const row = {title,activity_type,activity_date,start_time,end_time,
      location:String(body.location || "").trim() || null,
      details:String(body.details || "").trim() || null,
      response_deadline:body.response_deadline || null,
      status:["draft","published"].includes(body.status) ? body.status : "published",
      created_by:ctx.profile.id};
    const {data,error}=await ctx.db.from("activities").insert(row).select("*").single();
    if(error) throw error;
    return NextResponse.json({success:true,activity:data},{status:201});
  } catch(e) {
    console.error("Activities POST:",e);
    return NextResponse.json({error:"تعذر إنشاء النشاط. تحقق من البيانات وحاول مجددًا."},{status:500});
  }
}

export async function PATCH(request) {
  try {
    const ctx = await context();
    if (ctx.error) return NextResponse.json({error:ctx.error},{status:ctx.status});
    if (!editors.includes(ctx.profile.role)) return NextResponse.json({error:"حساب مشرف المنصة مخصص للمشاهدة فقط."},{status:403});
    const body=await request.json();
    const id=String(body.id || "");
    if(!id) return NextResponse.json({error:"معرّف النشاط غير موجود."},{status:400});
    const patch={};
    if(typeof body.status==="string" && ["draft","published","cancelled","archived"].includes(body.status)) patch.status=body.status;
    if(body.action==="update"){
      const title=String(body.title||"").trim(), type=String(body.activity_type||"").trim();
      if(title.length<2||title.length>160||type.length<2||type.length>80||!/^\d{4}-\d{2}-\d{2}$/.test(String(body.activity_date||"")))
        return NextResponse.json({error:"تحقق من اسم النشاط ونوعه وتاريخه."},{status:400});
      Object.assign(patch,{title,activity_type:type,activity_date:body.activity_date,start_time:body.start_time||null,end_time:body.end_time||null,location:String(body.location||"").trim()||null,details:String(body.details||"").trim()||null,response_deadline:body.response_deadline||null});
      if(patch.start_time&&patch.end_time&&patch.end_time<=patch.start_time) return NextResponse.json({error:"وقت النهاية يجب أن يكون بعد وقت البداية."},{status:400});
    }
    if(!Object.keys(patch).length) return NextResponse.json({error:"لا توجد تعديلات صالحة."},{status:400});
    patch.updated_at=new Date().toISOString();
    const {data,error}=await ctx.db.from("activities").update(patch).eq("id",id).select("*").maybeSingle();
    if(error) throw error;
    if(!data) return NextResponse.json({error:"النشاط غير موجود."},{status:404});
    return NextResponse.json({success:true,activity:data});
  }catch(e){
    console.error("Activities PATCH:",e);
    return NextResponse.json({error:"تعذر تحديث النشاط."},{status:500});
  }
}
