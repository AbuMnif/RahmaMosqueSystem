import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createSupabaseServer } from "../../../../lib/supabaseServer";
import { createSupabaseAdmin } from "../../../../lib/supabaseAdmin";
export const dynamic="force-dynamic";
async function context(){
 const sb=await createSupabaseServer();const {data:{user},error}=await sb.auth.getUser();
 if(error||!user)return {error:"انتهت جلسة الدخول.",status:401};
 const admin=createSupabaseAdmin();const {data:profile,error:pe}=await admin.from("profiles").select("id,role,is_active").eq("id",user.id).maybeSingle();
 if(pe||!profile?.is_active)return {error:"الحساب غير نشط.",status:403};
 if(!["admin","supervisor"].includes(profile.role))return {error:"هذا القسم متاح للمدير والمشرف فقط.",status:403};
 return {admin,profile};
}
export async function GET(){
 try{
  const c=await context();if(c.error)return NextResponse.json({error:c.error},{status:c.status});
  const [t,r]=await Promise.all([c.admin.from("profiles").select("id,full_name").eq("role","teacher").eq("is_active",true).order("full_name"),c.admin.from("teacher_attendance").select("*").order("attendance_date",{ascending:false}).limit(5000)]);
  if(t.error||r.error)throw t.error||r.error;
  const names=new Map((t.data||[]).map(x=>[x.id,x.full_name]));
  return NextResponse.json({success:true,data:{teachers:t.data||[],records:(r.data||[]).map(x=>({...x,teacher_name:names.get(x.teacher_id)||"—"}))}});
 }catch(e){console.error("Teacher attendance GET",e);return NextResponse.json({error:"تعذر تحميل بيانات تحضير المعلمين."},{status:500});}
}
export async function POST(request){
 try{
  const c=await context();if(c.error)return NextResponse.json({error:c.error},{status:c.status});
  const p=await request.json(),teacherId=String(p.teacher_id||""),date=String(p.attendance_date||"");
  if(!teacherId||!/^\\d{4}-\\d{2}-\\d{2}$/.test(date)||!["present","absent"].includes(p.status))return NextResponse.json({error:"تحقق من بيانات حضور المعلم."},{status:400});
  const t=await c.admin.from("profiles").select("id").eq("id",teacherId).eq("role","teacher").eq("is_active",true).maybeSingle();
  if(t.error||!t.data)return NextResponse.json({error:"حساب المعلم غير موجود أو غير نشط."},{status:404});
  const op=p.client_operation_id||randomUUID();const dup=await c.admin.from("teacher_attendance").select("id").eq("client_operation_id",op).maybeSingle();
  if(dup.error)throw dup.error;if(dup.data)return NextResponse.json({success:true,duplicate:true,id:dup.data.id});
  const old=await c.admin.from("teacher_attendance").select("id").eq("teacher_id",teacherId).eq("attendance_date",date).maybeSingle();
  if(old.error)throw old.error;if(old.data)return NextResponse.json({error:"يوجد تحضير محفوظ لهذا المعلم في التاريخ المحدد. لم يتم استبداله."},{status:409});
  const saved=await c.admin.from("teacher_attendance").insert({client_operation_id:op,teacher_id:teacherId,attendance_date:date,status:p.status,notes:String(p.notes||"").trim()||null,created_by:c.profile.id}).select("id").single();
  if(saved.error){if(saved.error.code==="23505")return NextResponse.json({error:"يوجد تحضير سابق لهذا المعلم في التاريخ المحدد."},{status:409});throw saved.error;}
  return NextResponse.json({success:true,id:saved.data.id});
 }catch(e){console.error("Teacher attendance POST",e);return NextResponse.json({error:"تعذر حفظ تحضير المعلم."},{status:500});}
}