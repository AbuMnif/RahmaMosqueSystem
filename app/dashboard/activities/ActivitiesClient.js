"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import * as XLSX from "xlsx";

const empty={title:"",activity_type:"رحلة",activity_date:"",start_time:"",end_time:"",location:"",details:"",response_deadline:"",status:"published"};
const fmtDate=v=>v?new Date(v+"T00:00:00").toLocaleDateString("ar"): "—";
const fmtTime=v=>v?String(v).slice(0,5):"—";
const fullName=x=>x.student_name||"طالب";

export default function ActivitiesClient({profile}){
 const readOnly=profile.role==="platform_supervisor";
 const canViewTechnical=profile.role==="admin";
 const [activities,setActivities]=useState([]),[responses,setResponses]=useState([]);
 const [form,setForm]=useState(empty),[editing,setEditing]=useState(null);
 const [selected,setSelected]=useState(null),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{const r=await fetch("/api/activities",{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"تعذر التحميل");setActivities(d.activities||[]);setResponses(d.responses||[]);}
  catch(e){setError(e.message||"تعذر تحميل الأنشطة");}finally{setLoading(false);}
 },[]);
 useEffect(()=>{load();},[load]);
 const selectedResponses=useMemo(()=>responses.filter(x=>x.activity_id===selected?.id),[responses,selected]);
 const stats=useMemo(()=>({accepted:selectedResponses.filter(x=>x.decision==="accepted").length,declined:selectedResponses.filter(x=>x.decision==="declined").length}),[selectedResponses]);
 function edit(item){setEditing(item.id);setForm({...item,response_deadline:item.response_deadline?item.response_deadline.slice(0,16):"",start_time:fmtTime(item.start_time)==="—"?"":fmtTime(item.start_time),end_time:fmtTime(item.end_time)==="—"?"":fmtTime(item.end_time)});setNotice("");setError("");window.scrollTo({top:0,behavior:"smooth"});}
 function reset(){setEditing(null);setForm(empty);}
 async function submit(e){e.preventDefault();if(readOnly)return;setSaving(true);setError("");setNotice("");
  try{const r=await fetch("/api/activities",{method:editing?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(editing?{...form,id:editing,action:"update"}:form)});const d=await r.json();if(!r.ok)throw new Error(d.error||"تعذر الحفظ");setNotice(editing?"تم تحديث النشاط.":"تم إنشاء النشاط بنجاح.");reset();await load();}
  catch(e){setError(e.message||"تعذر الحفظ");}finally{setSaving(false);}
 }
 async function changeStatus(item,status){if(readOnly)return;if(!window.confirm("هل تريد تغيير حالة النشاط؟"))return;try{const r=await fetch("/api/activities",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:item.id,status})});const d=await r.json();if(!r.ok)throw new Error(d.error||"تعذر التحديث");setNotice("تم تحديث حالة النشاط.");await load();}catch(e){setError(e.message);}}
 function exportRows(rows,name,includeSignature=false){const data=rows.map(x=>({ "اسم الطالب":fullName(x),"ولي الأمر":x.guardian_name,"القرار":x.decision==="accepted"?"موافق":"معتذر","تاريخ الرد":new Date(x.responded_at).toLocaleString("ar"),...(includeSignature?{"التوقيع الإلكتروني (بيانات المسارات)":x.signature_strokes?JSON.stringify(x.signature_strokes):"لا يوجد"}:{})}));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(data), "الردود");XLSX.writeFile(wb,name);}
 function exportAll(){const yes=selectedResponses.filter(x=>x.decision==="accepted"),no=selectedResponses.filter(x=>x.decision==="declined");const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(yes.map(x=>({"اسم الطالب":fullName(x),"ولي الأمر":x.guardian_name,"القرار":"موافق","تاريخ الرد":new Date(x.responded_at).toLocaleString("ar"),"بيانات التوقيع":x.signature_strokes?JSON.stringify(x.signature_strokes):""}))),"الموافقات");XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(no.map(x=>({"اسم الطالب":fullName(x),"ولي الأمر":x.guardian_name,"القرار":"معتذر","تاريخ الرد":new Date(x.responded_at).toLocaleString("ar")}))),"الاعتذارات");XLSX.writeFile(wb,"تقرير-"+(selected?.title||"النشاط")+".xlsx");}
 const roleName=profile.role==="admin"?"مدير النظام":profile.role==="supervisor"?"المشرف":"مشرف المنصة";
 return <main className="activities-page" dir="rtl">
 <header className="activities-header"><a href="/dashboard">العودة إلى لوحة التحكم</a><div><strong>{profile.full_name}</strong><small>{roleName}</small></div></header>
 <div className="activities-wrap">
 <section className="activities-title"><span>إدارة الفعاليات</span><h1>الأنشطة وموافقات أولياء الأمور</h1><p>إنشاء الأنشطة ومتابعة قرارات أولياء الأمور والتقارير.</p></section>
 {readOnly&&<div className="activities-banner">حساب مشرف المنصة مخصص للمشاهدة فقط.</div>}
 {!readOnly&&<section className="activity-form-card"><div className="activity-section-heading"><h2>{editing?"تعديل النشاط":"إنشاء نشاط جديد"}</h2>{editing&&<button type="button" onClick={reset}>إلغاء التعديل</button>}</div>
 <form className="activity-form" onSubmit={submit}>
 <label>اسم النشاط<input required minLength="2" maxLength="160" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="مثال: الرحلة الترفيهية"/></label>
 <label>نوع النشاط<input required value={form.activity_type} onChange={e=>setForm({...form,activity_type:e.target.value})} placeholder="رحلة، مسابقة، لقاء..."/></label>
 <label>التاريخ<input type="date" required value={form.activity_date} onChange={e=>setForm({...form,activity_date:e.target.value})}/></label>
 <label>وقت البداية<input type="time" value={form.start_time||""} onChange={e=>setForm({...form,start_time:e.target.value})}/></label>
 <label>وقت النهاية<input type="time" value={form.end_time||""} onChange={e=>setForm({...form,end_time:e.target.value})}/></label>
 <label>الموقع<input value={form.location||""} onChange={e=>setForm({...form,location:e.target.value})} placeholder="موقع إقامة النشاط"/></label>
 <label>آخر موعد للرد<input type="datetime-local" value={form.response_deadline||""} onChange={e=>setForm({...form,response_deadline:e.target.value})}/></label>
 <label>حالة النشر<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="published">منشور</option><option value="draft">مسودة</option></select></label>
 <label className="activity-wide">التفاصيل<textarea rows="4" value={form.details||""} onChange={e=>setForm({...form,details:e.target.value})} placeholder="تفاصيل النشاط والتعليمات..."/></label>
 <div className="activity-form-actions"><button disabled={saving}>{saving?"جارٍ الحفظ...":editing?"حفظ التعديلات":"إنشاء النشاط"}</button></div>
 </form></section>}
 {(error||notice)&&<div className={error?"activity-error":"activity-notice"} role={error?"alert":"status"}>{error||notice}</div>}
 <section className="activity-list"><div className="activity-section-heading"><div><h2>الأنشطة المسجلة</h2><p>اختر نشاطًا لمراجعة الردود والتقارير.</p></div><button type="button" onClick={load} disabled={loading}>تحديث</button></div>
 {loading?<div className="activity-empty">جارٍ تحميل الأنشطة...</div>:activities.length===0?<div className="activity-empty">لا توجد أنشطة مسجلة حتى الآن.</div>:<div className="activity-grid">{activities.map(item=>{const rs=responses.filter(x=>x.activity_id===item.id);return <article className={"activity-card "+(selected?.id===item.id?"chosen":"")} key={item.id}>
 <div className="activity-card-top"><span className={"activity-state "+item.status}>{({published:"منشور",draft:"مسودة",cancelled:"ملغي",archived:"مؤرشف"})[item.status]}</span><small>{item.activity_type}</small></div>
 <h3>{item.title}</h3><p>{fmtDate(item.activity_date)} · {fmtTime(item.start_time)} – {fmtTime(item.end_time)}</p><p>{item.location||"لم يحدد الموقع"}</p>
 <div className="activity-mini-stats"><span>موافقات {rs.filter(x=>x.decision==="accepted").length}</span><span>اعتذارات {rs.filter(x=>x.decision==="declined").length}</span></div>
 <div className="activity-card-actions"><button type="button" onClick={()=>setSelected(item)}>عرض الردود</button>{!readOnly&&<><button type="button" onClick={()=>edit(item)}>تعديل</button><button type="button" onClick={()=>changeStatus(item,item.status==="cancelled"?"published":"cancelled")}>{item.status==="cancelled"?"إعادة النشر":"إلغاء النشاط"}</button></>}</div>
 </article>})}</div>}
 </section>
 {selected&&<section className="activity-responses"><div className="activity-section-heading"><div><span>تفاصيل النشاط</span><h2>{selected.title}</h2><p>الردود المسجلة فقط؛ غير الظاهرين في القائمة لم يرسلوا ردًا بعد.</p></div><button type="button" onClick={()=>setSelected(null)}>إغلاق</button></div>
 <div className="activity-response-stats"><article><strong>{stats.accepted}</strong><span>موافقات</span></article><article><strong>{stats.declined}</strong><span>اعتذارات</span></article><article><strong>{selectedResponses.length}</strong><span>إجمالي الردود</span></article></div>
 <div className="activity-export-actions"><button onClick={()=>exportRows(selectedResponses.filter(x=>x.decision==="accepted"),"موافقات-"+selected.title+".xlsx",true)}>تصدير الموافقين</button><button onClick={()=>exportRows(selectedResponses.filter(x=>x.decision==="declined"),"اعتذارات-"+selected.title+".xlsx")}>تصدير المعتذرين</button><button onClick={exportAll}>تصدير التقرير الشامل</button></div>
 {selectedResponses.length===0?<div className="activity-empty">لم تصل أي ردود لهذا النشاط حتى الآن.</div>:<div className="activity-table-wrap"><table><thead><tr><th>الطالب</th><th>ولي الأمر</th><th>القرار</th><th>وقت الرد</th><th>التوقيع</th>{canViewTechnical&&<th>تفاصيل تقنية</th>}</tr></thead><tbody>{selectedResponses.map(x=><tr key={x.id}><td>{fullName(x)}</td><td>{x.guardian_name}</td><td><span className={x.decision==="accepted"?"decision-yes":"decision-no"}>{x.decision==="accepted"?"موافق":"معتذر"}</span></td><td>{new Date(x.responded_at).toLocaleString("ar")}</td><td>{x.decision==="accepted"?(x.signature_strokes?"توقيع محفوظ":"غير متاح"):"—"}</td>{canViewTechnical&&<td><small>الجهاز: {x.device_info||"غير متاح"}<br/>IP: {x.ip_address||"غير متاح"}<br/>وقت التوقيع: {x.signed_at?new Date(x.signed_at).toLocaleString("ar"):"—"}</small></td>}</tr>)}</tbody></table></div>}
 </section>}
 </div></main>;
}