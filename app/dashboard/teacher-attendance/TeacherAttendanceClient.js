"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {enqueueEducationalOperation,listEducationalOperations,acknowledgeEducationalOperations,updateEducationalOperationStatus,readEducationalOfflineMeta,saveEducationalOfflineMeta} from "../../../lib/educationalOfflineStore";
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`},uid=()=>crypto.randomUUID(),key=id=>`awn-teacher-attendance-v1:${id}`;
async function warm(){
 await navigator.serviceWorker.register("/educational-sw.js",{scope:"/"});const reg=await navigator.serviceWorker.ready,w=reg.active||navigator.serviceWorker.controller;if(!w)throw Error("تعذر تشغيل مكوّن العمل دون اتصال.");
 const ch=new MessageChannel();await Promise.race([new Promise((ok,no)=>{ch.port1.onmessage=e=>e.data?.success?ok():no(Error(e.data?.error||"تعذر تجهيز الصفحات"));w.postMessage({type:"CACHE_EDUCATIONAL_SHELL"},[ch.port2])}),new Promise((_,no)=>setTimeout(()=>no(Error("انتهت مهلة تجهيز الصفحات")),20000))]);
}
export default function TeacherAttendanceClient({profile}){
 const [teachers,T]=useState([]),[records,R]=useState([]),[date,D]=useState(today()),[marks,M]=useState({}),[notes,N]=useState({}),[loading,L]=useState(true),[saving,S]=useState(false),[error,E]=useState(""),[notice,Q]=useState(""),[ready,V]=useState(false),[queue,B]=useState({pending:0,needs_review:0,failed:0});
 const existing=useMemo(()=>Object.fromEntries(records.filter(x=>x.attendance_date===date).map(x=>[x.teacher_id,x])),[records,date]);
 const refreshQueue=useCallback(async()=>{const [p,r,f]=await Promise.all(["pending","needs_review","failed"].map(s=>listEducationalOperations(profile.id,s)));B({pending:p.filter(x=>x.operation==="teacher_attendance").length,needs_review:r.filter(x=>x.operation==="teacher_attendance").length,failed:f.filter(x=>x.operation==="teacher_attendance").length})},[profile.id]);
 const load=useCallback(async()=>{
  L(true);E("");
  try{
   if(!navigator.onLine)throw Error("offline");
   const res=await fetch("/api/teacher-attendance",{cache:"no-store"}),j=await res.json().catch(()=>({}));if(!res.ok||!j.success)throw Error(j.error||"تعذر تحميل التحضير.");
   const data=j.data||{teachers:[],records:[]};T(data.teachers);R(data.records);localStorage.setItem(key(profile.id),JSON.stringify({data}));
   const stamp=new Date().toISOString();await saveEducationalOfflineMeta(profile.id,{role:profile.role,lastVerifiedAt:stamp});
   try{await warm();await saveEducationalOfflineMeta(profile.id,{role:profile.role,lastVerifiedAt:stamp,shellReadyAt:new Date().toISOString()});V(true)}catch(e){V(false);Q(e.message)}
  }catch(e){
   try{const meta=await readEducationalOfflineMeta(profile.id),stamp=Date.parse(meta?.lastVerifiedAt||"");if(!stamp||Date.now()<stamp||Date.now()-stamp>48*3600000||meta.role!==profile.role||!meta.shellReadyAt)throw Error("يلزم الاتصال بالإنترنت وإعادة التحقق قبل استخدام التحضير دون اتصال.");
    const cached=JSON.parse(localStorage.getItem(key(profile.id))||"null");if(!cached?.data)throw Error("لا توجد نسخة محلية لتحضير المعلمين.");T(cached.data.teachers||[]);R(cached.data.records||[]);V(true);Q("تعمل دون اتصال باستخدام آخر نسخة تم التحقق منها.");
   }catch(local){E(local.message)}
  }finally{L(false);refreshQueue().catch(()=>{})}
 },[profile.id,profile.role,refreshQueue]);
 useEffect(()=>{load()},[load]);
 useEffect(()=>{M(Object.fromEntries(teachers.map(t=>[t.id,existing[t.id]?.status!=="absent"])));N(Object.fromEntries(teachers.map(t=>[t.id,existing[t.id]?.notes||""])))},[teachers,date,existing]);
 useEffect(()=>{
  let active=true,running=false;const sync=async()=>{if(running||!navigator.onLine)return;running=true;try{
   const interrupted=await listEducationalOperations(profile.id,"syncing");for(const x of interrupted.filter(x=>x.operation==="teacher_attendance"))await updateEducationalOperationStatus(x.operationId,"pending","استُعيدت العملية بعد إغلاق التطبيق.");
   const pending=await listEducationalOperations(profile.id,"pending");
   for(const x of pending.filter(x=>x.operation==="teacher_attendance")){await updateEducationalOperationStatus(x.operationId,"syncing");try{
    const res=await fetch("/api/educational-records",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({operation:"teacher_attendance",payload:x.payload})}),j=await res.json().catch(()=>({}));
    if(res.ok&&j.success)await acknowledgeEducationalOperations(profile.id,[x.operationId]);else if([400,403,404,409].includes(res.status))await updateEducationalOperationStatus(x.operationId,"needs_review",j.error);else{await updateEducationalOperationStatus(x.operationId,"pending",j.error);break}
   }catch(e){await updateEducationalOperationStatus(x.operationId,"pending",e.message);break}}
   if(active){await refreshQueue();if(navigator.onLine)await load()}
  }finally{running=false}};window.addEventListener("online",sync);const timer=setInterval(sync,20000);return()=>{active=false;window.removeEventListener("online",sync);clearInterval(timer)}
 },[profile.id,load,refreshQueue]);
 async function save(){
  if(saving)return;const targets=teachers.filter(t=>!existing[t.id]);if(!targets.length){Q("تم تسجيل جميع المعلمين لهذا التاريخ.");return}S(true);E("");Q("");
  try{for(const t of targets){const p={teacher_id:t.id,attendance_date:date,status:marks[t.id]===false?"absent":"present",notes:notes[t.id]||"",client_operation_id:uid()};
   if(!navigator.onLine){await enqueueEducationalOperation({accountId:profile.id,operationId:p.client_operation_id,operation:"teacher_attendance",payload:p});continue}
   const res=await fetch("/api/teacher-attendance",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(p)}),j=await res.json().catch(()=>({}));if(!res.ok||!j.success)throw Error(j.error||"تعذر حفظ سجل أحد المعلمين.");
  }Q(navigator.onLine?"تم حفظ تحضير المعلمين.":"حُفظ التحضير محليًا وسيُزامن عند عودة الاتصال.");if(navigator.onLine)await load();else await refreshQueue()
  }catch(e){E(e.message)}finally{S(false)}
 }
 const present=teachers.filter(t=>existing[t.id]?.status==="present").length,absent=teachers.filter(t=>existing[t.id]?.status==="absent").length;
 return <main className="teacher-attendance-page" dir="rtl">
  <header className="ta-header"><a href="/dashboard">← لوحة التحكم</a><div><small>منظومة عَون · مسجد التراحم</small><h1>تحضير المعلمين</h1><p>قسم مستقل لتسجيل حضور المعلمين وغيابهم وملاحظاتهم.</p></div><button onClick={load} disabled={loading}>تحديث</button></header>
  <section className="ta-status"><span>{navigator.onLine?"متصل":"دون اتصال"}</span><span>بانتظار المزامنة: {queue.pending}</span>{queue.needs_review>0&&<span>تحتاج مراجعة: {queue.needs_review}</span>}{queue.failed>0&&<span>فشلت: {queue.failed}</span>}<strong>{ready?"مهيأ دون اتصال حتى 48 ساعة من آخر تحقق":"التحقق دون اتصال غير مهيأ"}</strong></section>
  {notice&&<p className="ta-notice">{notice}</p>}{error&&<p className="ta-error">{error}<button onClick={load}>إعادة المحاولة</button></p>}
  <section className="ta-panel"><div className="ta-title"><div><h2>كشف التحضير اليومي</h2><p>حدد التاريخ وسجل حالة كل معلم.</p></div><b>{teachers.length} معلم</b></div>
   <label className="ta-date">تاريخ التحضير<input type="date" value={date} onChange={e=>D(e.target.value)}/></label>
   <div className="ta-summary"><span>حضور <b>{present}</b></span><span>غياب <b>{absent}</b></span><span>غير مسجل <b>{teachers.length-present-absent}</b></span></div>
   {loading?<p className="ta-empty">جارٍ تحميل المعلمين...</p>:!teachers.length?<p className="ta-empty">لا توجد حسابات معلمين نشطة.</p>:<div className="ta-list"><div className="ta-head"><span>م</span><span>اسم المعلم</span><span>حاضر</span><span>ملاحظات</span></div>{teachers.map((t,i)=>{const saved=existing[t.id];return <div className="ta-row" key={t.id}><span>{i+1}</span><strong>{t.full_name}</strong><label className="ta-check"><input type="checkbox" disabled={!!saved} checked={saved?saved.status==="present":marks[t.id]!==false} onChange={e=>M(v=>({...v,[t.id]:e.target.checked}))}/><b>{(saved?saved.status==="present":marks[t.id]!==false)?"✓":""}</b></label><input className="ta-note" disabled={!!saved} placeholder="ملاحظة..." value={saved?saved.notes||"":notes[t.id]||""} onChange={e=>N(v=>({...v,[t.id]:e.target.value}))}/>{saved&&<small className="ta-saved">مسجل مسبقًا</small>}</div>})}</div>}
   <button className="ta-save" disabled={saving||loading||teachers.every(t=>!!existing[t.id])} onClick={save}>{saving?"جارٍ الحفظ...":"حفظ تحضير المعلمين"}</button>
  </section>
  <section className="ta-panel"><h2>السجلات السابقة</h2><div className="ta-table"><table><thead><tr><th>التاريخ</th><th>المعلم</th><th>الحالة</th><th>ملاحظات</th></tr></thead><tbody>{records.length?records.map(r=><tr key={r.id}><td>{r.attendance_date}</td><td>{r.teacher_name}</td><td>{r.status==="present"?"حاضر":"غائب"}</td><td>{r.notes||"—"}</td></tr>):<tr><td colSpan="4">لا توجد سجلات سابقة.</td></tr>}</tbody></table></div></section>
 </main>
}