import { redirect } from "next/navigation";
import { createSupabaseServer } from "../../../lib/supabaseServer";
import TeacherAttendanceClient from "./TeacherAttendanceClient";
import "./page.css";
export default async function TeacherAttendancePage(){
 const sb=await createSupabaseServer();const {data:{user}}=await sb.auth.getUser();if(!user)redirect("/login");
 const {data:profile}=await sb.from("profiles").select("id,full_name,role,is_active").eq("id",user.id).single();
 if(!profile?.is_active)redirect("/login");if(!["admin","supervisor"].includes(profile.role))redirect("/dashboard");
 return <TeacherAttendanceClient profile={profile}/>;
}