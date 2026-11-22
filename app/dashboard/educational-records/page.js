import { redirect } from "next/navigation";
import { createSupabaseServer } from "../../../lib/supabaseServer";
import EducationalRecordsClient from "./EducationalRecordsClient";
import "./page.css";
export default async function EducationalRecordsPage(){
 const sb=await createSupabaseServer(); const {data:{user}}=await sb.auth.getUser(); if(!user)redirect("/login");
 const {data:profile}=await sb.from("profiles").select("id,username,full_name,role,is_active").eq("id",user.id).single(); if(!profile?.is_active)redirect("/login");
 return <EducationalRecordsClient profile={profile}/>;
}
