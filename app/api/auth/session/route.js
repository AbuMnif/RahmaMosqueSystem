import { NextResponse } from "next/server";
import { createSupabaseServer } from "../../../../lib/supabaseServer";
export const dynamic="force-dynamic";
export async function GET(){const sb=await createSupabaseServer();const {data:{user}}=await sb.auth.getUser();if(!user)return NextResponse.json({authenticated:false});const {data:profile}=await sb.from("profiles").select("is_active").eq("id",user.id).maybeSingle();return NextResponse.json({authenticated:Boolean(profile?.is_active)});}
