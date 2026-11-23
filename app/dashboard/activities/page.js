import { redirect } from "next/navigation";
import { createSupabaseServer } from "../../../lib/supabaseServer";
import ActivitiesClient from "./ActivitiesClient";
import "./page.css";

export default async function ActivitiesPage(){
 const sb=await createSupabaseServer();
 const {data:{user},error}=await sb.auth.getUser();
 if(error||!user) redirect("/login");
 const {data:profile,error:pe}=await sb.from("profiles").select("id,full_name,role,is_active").eq("id",user.id).maybeSingle();
 if(pe||!profile?.is_active||!["admin","supervisor","platform_supervisor"].includes(profile.role)) redirect("/dashboard");
 return <ActivitiesClient profile={profile}/>;
}