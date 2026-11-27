"use client";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import * as XLSX from "xlsx";
import {
 saveEducationalSnapshot, readEducationalSnapshot,
 enqueueEducationalOperation, listEducationalOperations,
 acknowledgeEducationalOperations, readEducationalOfflineMeta,
 saveEducationalOfflineMeta
} from "../../../lib/educationalOfflineStore";

const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
const nameOf=s=>[s?.first_name,s?.middle_name,s?.last_name].filter(Boolean).join(" ");
const id=()=>crypto.randomUUID();
const surahNames=["الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"];
const surahName=n=>surahNames[Number(n)-1]||"—";
const attendanceLabels={present:"حاضر",absent:"غائب",late:"متأخر",excused:"مستأذن"};
const memorizationLabels={new_memorization:"حفظ جديد",revision:"مراجعة"};
const ratingLabels={excellent:"متقن",very_good:"جيد جدًا",good:"جيد",acceptable:"مقبول",needs_improvement:"يحتاج إلى تحسين"};
const empty={classes:[],students:[],attendance:[],memorization:[],exams:[],notes:[],enrollments:[],assignments:[],examResults:[],teachers:[],auditLogs:[]};

export default function EducationalRecordsClient({profile}){
 const [data,setData]=useState(empty),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState(""),[notice,setNotice]=useState(""),[tab,setTab]=useState("overview"),[classFilter,setClassFilter]=useState("all"),[studentFilter,setStudentFilter]=useState("all"),[from,setFrom]=useState(""),[to,setTo]=useState(""),[modal,setModal]=useState(""),[form,setForm]=useState({class_id:"",student_id:"",attendance_date:today(),status:"present",record_date:today(),record_type:"new_memorization",surah_number:"1",from_ayah:"1",to_ayah:"1",verbal_rating:"excellent",note_date:today(),note:"",exam_date:today(),title:"",description:"",exam_id:"",score:"",notes:""}),[prepClass,setPrepClass]=useState(""),[prepDate,setPrepDate]=useState(today()),[attendanceMarks,setAttendanceMarks]=useState({}),[savingSheet,setSavingSheet]=useState(false),[savingRecord,setSavingRecord]=useState(false);
 const saveLock=useRef(false);
 useEffect(()=>{const selected=new URLSearchParams(window.location.search).get("student");if(selected)setStudentFilter(selected)},[]);
 const canWrite=["admin","supervisor","teacher"].includes(profile.role);
 const isReadOnly=["platform_supervisor","guardian"].includes(profile.role);
 const studentMap=useMemo(()=>Object.fromEntries(data.students.map(s=>[s.id,nameOf(s)])),[data.students]);
 const classMap=useMemo(()=>Object.fromEntries(data.classes.map(c=>[c.id,c.name])),[data.classes]);
 const filtered=(rows,dateKey)=>rows.filter(r=>(classFilter==="all"||r.class_id===classFilter)&&(studentFilter==="all"||r.student_id===studentFilter)&&(!from||r[dateKey]>=from)&&(!to||r[dateKey]<=to));
 const attendance=filtered(data.attendance,"attendance_date"),memorization=filtered(data.memorization,"record_date"),notes=filtered(data.notes,"note_date");
 const examsFiltered=data.exams.filter(x=>(classFilter==="all"||x.class_id===classFilter)&&(!from||x.exam_date>=from)&&(!to||x.exam_date<=to)&&(studentFilter==="all"||data.examResults.some(r=>r.exam_id===x.id&&r.student_id===studentFilter)));
 const resultsFiltered=data.examResults.filter(x=>(studentFilter==="all"||x.student_id===studentFilter)&&(()=>{const ex=data.exams.find(e=>e.id===x.exam_id);return ex&&(classFilter==="all"||ex.class_id===classFilter)&&(!from||ex.exam_date>=from)&&(!to||ex.exam_date<=to)})());
 const scopedStudents=useMemo(()=>data.students.filter(s=>classFilter==="all"||data.enrollments.some(e=>e.student_id===s.id&&e.class_id===classFilter&&(!e.end_date||e.end_date>=today()))),[data.students,data.enrollments,classFilter]);
 const prepStudents=useMemo(()=>data.students.filter(student=>data.enrollments.some(e=>e.student_id===student.id&&e.class_id===prepClass&&e.start_date<=prepDate&&(!e.end_date||e.end_date>=prepDate))),[data.students,data.enrollments,prepClass,prepDate]);
 const existingPrepAttendance=useMemo(()=>Object.fromEntries(data.attendance.filter(r=>r.class_id===prepClass&&r.attendance_date===prepDate).map(r=>[r.student_id,r.status==="present"])),[data.attendance,prepClass,prepDate]);
 useEffect(()=>{if(!prepClass&&data.classes.length)setPrepClass(data.classes[0].id)},[data.classes,prepClass]);
 useEffect(()=>{setAttendanceMarks(existingPrepAttendance)},[prepClass,prepDate,existingPrepAttendance]);
 const reload=useCallback(async()=>{
  setLoading(true);setLoadError("");
  try{
   if(typeof navigator!=="undefined"&&!navigator.onLine) throw new Error("offline");
   const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),25000);
   let response;try{response=await fetch("/api/educational-records",{cache:"no-store",signal:controller.signal})}finally{clearTimeout(timeout)}
   const result=await response.json().catch(()=>({}));
   if(!response.ok||result.success!==true)throw new Error(result.error||`تعذر تحميل السجلات (HTTP ${response.status}).`);
   const fresh=result.data||empty;
   setData(fresh);setLoadError("");
   const verifiedAt=new Date().toISOString();
   await saveEducationalSnapshot(profile.id,fresh,{role:profile.role,lastVerifiedAt:verifiedAt});
   await saveEducationalOfflineMeta(profile.id,{role:profile.role,lastVerifiedAt:verifiedAt});
  }catch(error){
   try{
    const meta=await readEducationalOfflineMeta(profile.id);
    const verified=meta?.lastVerifiedAt?new Date(meta.lastVerifiedAt).getTime():0;
    const valid=verified>0&&Date.now()>=verified&&Date.now()-verified<=48*60*60*1000&&meta.role===profile.role;
    if(!valid)throw new Error("انتهت صلاحية العمل دون اتصال أو لم يسبق التحقق من هذا الحساب على هذا الجهاز. اتصل بالإنترنت لتسجيل الدخول والتحقق.");
    const cached=await readEducationalSnapshot(profile.id);
    if(!cached?.data)throw new Error("لا توجد نسخة تعليمية محفوظة لهذا الحساب على هذا الجهاز.");
    setData(cached.data);setLoadError("");
    setNotice("أنت تعمل دون اتصال. البيانات المعروضة آخر نسخة تم التحقق منها، وستُزامن السجلات الجديدة عند عودة الإنترنت.");
   }catch(localError){setLoadError(localError.message||"تعذر تحميل البيانات المحلية.");}
  }finally{setLoading(false)}
 },[profile.id,profile.role]);
 useEffect(()=>{reload()},[reload]);
 useEffect(()=>{
  let running=false;
  const syncPending=async()=>{
   if(running||!navigator.onLine)return;
   running=true;
   try{
    const pending=await listEducationalOperations(profile.id,"pending");
    for(const item of pending){
     if(!navigator.onLine)break;
     try{
      const response=await fetch("/api/educational-records",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({operation:item.operation,payload:item.payload}),cache:"no-store"});
      const result=await response.json().catch(()=>({}));
      if(response.ok&&result.success===true){
       await acknowledgeEducationalOperations(profile.id,[item.operationId]);
       setNotice("تمت مزامنة سجل محفوظ محليًا بنجاح.");
      }else{
       await saveEducationalOfflineMeta(profile.id,{lastSyncError:result.error||"تعذر اعتماد السجل",lastSyncErrorAt:new Date().toISOString()});
       break;
      }
     }catch{break}
    }
    const remaining=await listEducationalOperations(profile.id,"pending");
    if(remaining.length===0)await reload();
   }finally{running=false}
  };
  window.addEventListener("online",syncPending);
  if(navigator.onLine)syncPending();
  const timer=setInterval(syncPending,15000);
  return()=>{window.removeEventListener("online",syncPending);clearInterval(timer)};
 },[profile.id,reload]);
 async function save(operation,payload){
  if(saveLock.current)return;
  saveLock.current=true;setSavingRecord(true);setNotice("");
  const item={operation,payload:{...payload,client_operation_id:id()}};
  try{
   if(typeof navigator!=="undefined"&&!navigator.onLine){
    await enqueueEducationalOperation({accountId:profile.id,operationId:item.payload.client_operation_id,operation,payload:item.payload});
    setModal("");setNotice("تم حفظ السجل على هذا الجهاز، وهو بانتظار المزامنة عند عودة الإنترنت.");
    return;
   }
   const response=await fetch("/api/educational-records",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(item),cache:"no-store"});
   const result=await response.json().catch(()=>({}));
   if(!response.ok||result.success!==true)throw new Error(result.error||"لم يؤكد الخادم حفظ السجل.");
   setModal("");setNotice("تم حفظ السجل بنجاح.");await reload();
  }catch(error){setNotice(error.message||"تعذر حفظ السجل.")}
  finally{saveLock.current=false;setSavingRecord(false)}
 }
 async function saveAttendanceSheet(){
  if(savingSheet)return;
  if(!prepClass||!prepStudents.length){setNotice("اختر حلقة تحتوي على طلاب مسجلين.");return}
  setSavingSheet(true);setNotice("");
  const item={operation:"attendance_batch",payload:{class_id:prepClass,attendance_date:prepDate,rows:prepStudents.map(student=>({student_id:student.id,present:Boolean(attendanceMarks[student.id]),client_operation_id:id()}))}};
  try{
   if(typeof navigator!=="undefined"&&!navigator.onLine){
    for(const row of item.payload.rows) await enqueueEducationalOperation({accountId:profile.id,operationId:row.client_operation_id,operation:"attendance",payload:{...row,class_id:prepClass,attendance_date:prepDate,status:row.present?"present":"absent"}});
    setNotice("تم حفظ كشف التحضير محليًا على هذا الجهاز، وهو بانتظار المزامنة.");
    return;
   }
   const response=await fetch("/api/educational-records",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(item),cache:"no-store"});
   const result=await response.json().catch(()=>({}));
   if(!response.ok||result.success!==true)throw new Error(result.error||"تعذر حفظ كشف التحضير.");
   setNotice(`تم حفظ تحضير ${result.count||prepStudents.length} طالبًا بنجاح.`);await reload();
  }catch(error){setNotice(error.message||"تعذر حفظ كشف التحضير.")}
  finally{setSavingSheet(false)}
 }
 function openForm(kind){setForm(f=>({...f,class_id:f.class_id||data.classes[0]?.id||"",student_id:f.student_id||scopedStudents[0]?.id||"",attendance_date:today(),record_date:today(),note_date:today(),exam_date:today()}));setModal(kind)}
 async function submit(e){e.preventDefault();let op=modal,p={...form};if(op==="attendance")delete p.record_date;if(op==="memorization")delete p.attendance_date;if(op==="note")delete p.attendance_date;if(op==="exam")delete p.student_id;if(op==="exam_result")delete p.class_id;await save(op,p)}
 async function exportExcel(){try{const wb=XLSX.utils.book_new();const rows=(arr,cols)=>arr.map(x=>Object.fromEntries(cols.map(([k,label,fn])=>[label,fn?fn(x):x[k]??""])));
 const sheets=[
 ["ملخص",[{"المؤشر":"عدد الطلاب","القيمة":scopedStudents.length},{"المؤشر":"الحضور","القيمة":attendance.filter(x=>x.status==="present").length},{"المؤشر":"الغياب","القيمة":attendance.filter(x=>x.status==="absent").length},{"المؤشر":"سجلات الحفظ والمراجعة","القيمة":memorization.length},{"المؤشر":"الاختبارات","القيمة":examsFiltered.length},{"المؤشر":"متوسط درجات الاختبارات","القيمة":averageScore},{"المؤشر":"الطلاب الذين يحتاجون إلى متابعة","القيمة":followUpStudents.length},{"المؤشر":"الملاحظات","القيمة":notes.length}]],
 ["مؤشرات الطلاب",scopedStudents.map(student=>{const a=attendance.filter(r=>r.student_id===student.id);const m=memorization.filter(r=>r.student_id===student.id);const scores=resultsFiltered.filter(r=>r.student_id===student.id);return {"الطالب":nameOf(student),"عدد سجلات الحضور":a.length,"الحضور":a.filter(r=>r.status==="present").length,"الغياب":a.filter(r=>r.status==="absent").length,"نسبة الحضور":a.length?Math.round(a.filter(r=>r.status==="present").length/a.length*100):0,"الحفظ والمراجعة":m.length,"متوسط الاختبارات":scores.length?Math.round(scores.reduce((sum,r)=>sum+Number(r.score||0),0)/scores.length*10)/10:"—","يحتاج متابعة":m.some(r=>r.verbal_rating==="needs_improvement")||Boolean(a.length&&a.filter(r=>r.status==="absent").length/a.length>=0.3)?"نعم":"لا"}})],
 ["الطلاب",rows(scopedStudents,[["id","معرّف الطالب"],["first_name","الاسم الأول"],["middle_name","اسم الأب"],["last_name","اللقب"],["guardian_id","معرّف ولي الأمر"]])],
 ["الحضور",rows(attendance,[["attendance_date","التاريخ"],["student_id","الطالب",x=>studentMap[x.student_id]],["class_id","الحلقة",x=>classMap[x.class_id]],["status","الحالة",x=>attendanceLabels[x.status]||x.status],["notes","ملاحظات"]])],
 ["الحفظ والمراجعة",rows(memorization,[["record_date","التاريخ"],["student_id","الطالب",x=>studentMap[x.student_id]],["class_id","الحلقة",x=>classMap[x.class_id]],["record_type","النوع",x=>memorizationLabels[x.record_type]||x.record_type],["surah_number","السورة",x=>surahName(x.surah_number)],["from_ayah","من آية"],["to_ayah","إلى آية"],["verbal_rating","الإتقان",x=>ratingLabels[x.verbal_rating]||x.verbal_rating],["notes","ملاحظات"]])],
 ["الاختبارات",rows(examsFiltered,[["exam_date","التاريخ"],["title","الاختبار"],["class_id","الحلقة",x=>classMap[x.class_id]],["description","الوصف"]])],
 ["النتائج",rows(resultsFiltered,[["exam_id","معرّف الاختبار"],["student_id","الطالب",x=>studentMap[x.student_id]],["score","الدرجة"],["notes","ملاحظات"]])],
 ["ملاحظات المعلمين",rows(notes,[["note_date","التاريخ"],["student_id","الطالب",x=>studentMap[x.student_id]],["class_id","الحلقة",x=>classMap[x.class_id]],["note","الملاحظة"]])],
 ["سجل التدقيق",rows(data.auditLogs||[],[["created_at","وقت العملية"],["record_table","نوع السجل"],["record_id","معرّف السجل"],["action","العملية"],["changed_by_name","بواسطة"]])]
 ];for(const [n,rs] of sheets)XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rs),n);XLSX.writeFile(wb,`Awn-Educational-Records-${today()}.xlsx`)}catch{setNotice("تعذر إنشاء ملف Excel. تحقق من اتصالك ثم أعد المحاولة.")}}
 const attendanceRate=attendance.length?Math.round(attendance.filter(x=>x.status==="present").length/attendance.length*100):0;
 const averageScore=resultsFiltered.length?Math.round((resultsFiltered.reduce((sum,row)=>sum+Number(row.score||0),0)/resultsFiltered.length)*10)/10:0;
 const followUpStudents=useMemo(()=>scopedStudents.map(student=>{
   const studentAttendance=attendance.filter(row=>row.student_id===student.id);
   const absent=studentAttendance.filter(row=>row.status==="absent").length;
   const studentMem=memorization.filter(row=>row.student_id===student.id);
   const needsReview=studentMem.some(row=>row.verbal_rating==="needs_improvement");
   const absentRate=studentAttendance.length?absent/studentAttendance.length:0;
   return {student,absent,attendanceCount:studentAttendance.length,needsReview,absentRate,memorizationCount:studentMem.length};
 }).filter(row=>row.needsReview||row.absentRate>=0.3).sort((a,b)=>Number(b.needsReview)-Number(a.needsReview)||b.absentRate-a.absentRate),[scopedStudents,attendance,memorization]);
 const topStudents=useMemo(()=>scopedStudents.map(student=>{
   const studentMem=memorization.filter(row=>row.student_id===student.id).length;
   const studentScores=resultsFiltered.filter(row=>row.student_id===student.id);
   const avg=studentScores.length?studentScores.reduce((sum,row)=>sum+Number(row.score||0),0)/studentScores.length:0;
   return {student,count:studentMem,average:avg};
 }).sort((a,b)=>b.count-a.count||b.average-a.average).slice(0,5),[scopedStudents,memorization,resultsFiltered]);
 const studentOptions=scopedStudents;
 return <main className="records-page" dir="rtl">
  {notice&&<div className="records-toast" role="status">{notice}<button onClick={()=>setNotice("")} aria-label="إغلاق">×</button></div>}
  <header className="records-header"><a href="/dashboard">← لوحة التحكم</a><div><small>منظومة عَون · مسجد التراحم</small><h1>السجل التعليمي</h1><p>إدارة ومتابعة رحلة الطالب التعليمية</p></div><button className="records-export" onClick={exportExcel}>تنزيل Excel</button></header>
  <section className="records-status"><span className="status-dot"></span>{typeof navigator!=="undefined"&&!navigator.onLine?"وضع دون اتصال · السجلات الجديدة تحفظ محليًا":"متصل · يتم التحقق من الحساب ومزامنة السجلات"}<button type="button" onClick={reload}>تحديث السجلات</button></section>
  <section className="records-filters"><label>الحلقة<select value={classFilter} onChange={e=>setClassFilter(e.target.value)}><option value="all">كل الحلقات</option>{data.classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>الطالب<select value={studentFilter} onChange={e=>setStudentFilter(e.target.value)}><option value="all">كل الطلاب</option>{scopedStudents.map(s=><option key={s.id} value={s.id}>{nameOf(s)}</option>)}</select></label><label>من تاريخ<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>إلى تاريخ<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></section>
  <section className="records-kpis"><article><small>الطلاب</small><strong>{scopedStudents.length}</strong><span>ضمن النطاق المحدد</span></article><article><small>نسبة الحضور</small><strong>{attendanceRate}%</strong><span>{attendance.length} سجل حضور</span></article><article><small>الحفظ والمراجعة</small><strong>{memorization.length}</strong><span>سجل تعليمي</span></article><article><small>متوسط الاختبارات</small><strong>{averageScore}%</strong><span>{resultsFiltered.length} نتيجة مسجلة</span></article><article><small>يحتاجون متابعة</small><strong>{followUpStudents.length}</strong><span>حسب الحضور ومستوى الإتقان</span></article></section>
  <nav className="records-tabs">{[["overview","نظرة عامة"],["attendance","الحضور والغياب"],["memorization","الحفظ والمراجعة"],["exams","الاختبارات والنتائج"],["notes","ملاحظات المعلمين"],["audit","سجل التغييرات"]].map(([k,v])=><button className={tab===k?"active":""} key={k} onClick={()=>setTab(k)}>{v}</button>)}</nav>
  {canWrite&&<div className="records-actions">{[["memorization","+ تسجيل حفظ / مراجعة"],["exam","+ إنشاء اختبار"],["exam_result","+ إضافة نتيجة"],["note","+ إضافة ملاحظة"]].map(([k,v])=><button key={k} onClick={()=>openForm(k)}>{v}</button>)}</div>}
  {loading?<div className="records-empty">جارٍ تحميل السجلات...</div>:loadError?<div className="records-empty">{loadError}<br/><button type="button" className="records-retry" onClick={reload}>إعادة المحاولة</button></div>:<>
   {tab==="overview"&&<section className="records-panel"><h2>ملخص الأداء التعليمي</h2><div className="records-overview-grid"><div><strong>{attendance.filter(x=>x.status==="present").length}</strong><span>حضور</span></div><div><strong>{attendance.filter(x=>x.status==="absent").length}</strong><span>غياب</span></div><div><strong>{memorization.filter(x=>x.record_type==="new_memorization").length}</strong><span>حفظ جديد</span></div><div><strong>{memorization.filter(x=>x.record_type==="revision").length}</strong><span>مراجعة</span></div></div><h3>آخر السجلات</h3><div className="records-table-wrap"><table><thead><tr><th>التاريخ</th><th>الطالب</th><th>الحلقة</th><th>النوع</th><th>التفاصيل</th></tr></thead><tbody>{[...attendance.map(x=>({...x,_date:x.attendance_date,_type:"حضور",_detail:attendanceLabels[x.status]||x.status})),...memorization.map(x=>({...x,_date:x.record_date,_type:memorizationLabels[x.record_type]||x.record_type,_detail:`سورة ${surahName(x.surah_number)} · الآيات ${x.from_ayah}-${x.to_ayah} · ${ratingLabels[x.verbal_rating]||x.verbal_rating}`})),...notes.map(x=>({...x,_date:x.note_date,_type:"ملاحظة",_detail:x.note}))].sort((a,b)=>(b._date||"").localeCompare(a._date||"")).slice(0,12).map((x,i)=><tr key={x.id||i}><td>{x._date}</td><td>{studentMap[x.student_id]||"—"}</td><td>{classMap[x.class_id]||"—"}</td><td>{x._type}</td><td>{x._detail}</td></tr>)}</tbody></table></div>
    <div className="records-analytics-grid">
     <section className="records-analytics-card"><h3>طلاب يحتاجون إلى متابعة</h3>{followUpStudents.length?<div className="records-analytics-list">{followUpStudents.slice(0,8).map(row=><div key={row.student.id}><strong>{nameOf(row.student)}</strong><span>{row.needsReview?"يحتاج إلى تحسين في الإتقان":`نسبة الغياب ${Math.round(row.absentRate*100)}%`}</span></div>)}</div>:<p className="records-analytics-empty">لا توجد حالات متابعة وفق المؤشرات الحالية.</p>}</section>
     <section className="records-analytics-card"><h3>مؤشرات تقدم الطلاب</h3>{topStudents.length?<div className="records-analytics-list">{topStudents.map(row=><div key={row.student.id}><strong>{nameOf(row.student)}</strong><span>{row.count} سجل حفظ ومراجعة · متوسط الاختبارات {row.average?`${Math.round(row.average*10)/10}%`:"—"}</span></div>)}</div>:<p className="records-analytics-empty">لا توجد بيانات كافية لعرض التقدم بعد.</p>}</section>
    </div>
   </section>}
   {tab==="attendance"&&<section className="records-panel records-attendance-panel">
    <div className="records-panel-heading"><div><h2>كشف التحضير اليومي</h2><p>ضع علامة ✓ أمام الطالب الحاضر، واترك خانة الغائب فارغة.</p></div><span className="records-roster-count">{prepStudents.length} طالب</span></div>
    <div className="records-roster-controls"><label>الحلقة<select value={prepClass} onChange={e=>setPrepClass(e.target.value)}><option value="">اختر الحلقة</option>{data.classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>تاريخ التحضير<input type="date" value={prepDate} onChange={e=>setPrepDate(e.target.value)}/></label></div>
    {!prepStudents.length?<div className="records-empty">لا يوجد طلاب مسجلون في هذه الحلقة في التاريخ المحدد.</div>:<>
     <div className="records-roster-summary"><span>الحاضرون <strong>{prepStudents.filter(x=>attendanceMarks[x.id]).length}</strong></span><span>الغائبون <strong>{prepStudents.filter(x=>!attendanceMarks[x.id]).length}</strong></span><button type="button" onClick={()=>setAttendanceMarks(Object.fromEntries(prepStudents.map(x=>[x.id,true])))}>تحديد الجميع حاضرًا</button><button type="button" onClick={()=>setAttendanceMarks({})}>إلغاء تحديد الجميع</button></div>
     <div className="records-roster-list"><div className="records-roster-head"><span>م</span><span>اسم الطالب</span><span>حاضر</span></div>{prepStudents.map((student,index)=><label className="records-roster-row" key={student.id}><span>{index+1}</span><strong>{nameOf(student)}</strong><span className="records-present-check"><input type="checkbox" checked={Boolean(attendanceMarks[student.id])} onChange={e=>setAttendanceMarks(current=>({...current,[student.id]:e.target.checked}))}/><b>{attendanceMarks[student.id]?"✓":" "}</b></span></label>)}</div>
     <button className="records-submit records-roster-save" type="button" disabled={savingSheet||!canWrite} onClick={saveAttendanceSheet}>{savingSheet?"جارٍ حفظ الكشف...":"حفظ كشف التحضير"}</button>
    </>}
    <div className="records-table-wrap records-previous-attendance"><h3>السجلات السابقة</h3><table><thead><tr><th>التاريخ</th><th>الطالب</th><th>الحالة</th></tr></thead><tbody>{attendance.length?attendance.slice(0,100).map(row=><tr key={row.id}><td>{row.attendance_date}</td><td>{studentMap[row.student_id]||"—"}</td><td>{attendanceLabels[row.status]||row.status}</td></tr>):<tr><td colSpan="3">لا توجد سجلات ضمن التصفية.</td></tr>}</tbody></table></div>
   </section>}
   {tab==="memorization"&&<RecordsTable title="سجل الحفظ والمراجعة" rows={memorization} cols={[["record_date","التاريخ"],["student_id","الطالب",x=>studentMap[x.student_id]],["class_id","الحلقة",x=>classMap[x.class_id]],["record_type","النوع",x=>memorizationLabels[x.record_type]||x.record_type],["surah_number","السورة",x=>surahName(x.surah_number)],["from_ayah","من آية"],["to_ayah","إلى آية"],["verbal_rating","الإتقان",x=>ratingLabels[x.verbal_rating]||x.verbal_rating],["notes","ملاحظات"]]}/>}
   {tab==="exams"&&<><RecordsTable title="الاختبارات" rows={examsFiltered} cols={[["exam_date","التاريخ"],["title","الاختبار"],["class_id","الحلقة",x=>classMap[x.class_id]],["description","الوصف"]]}/><RecordsTable title="نتائج الاختبارات" rows={resultsFiltered} cols={[["student_id","الطالب",x=>studentMap[x.student_id]],["exam_id","الاختبار",x=>data.exams.find(e=>e.id===x.exam_id)?.title||"—"],["score","الدرجة"],["notes","ملاحظات"]]}/></>}
   {tab==="notes"&&<RecordsTable title="ملاحظات المعلمين" rows={notes} cols={[["note_date","التاريخ"],["student_id","الطالب",x=>studentMap[x.student_id]],["class_id","الحلقة",x=>classMap[x.class_id]],["note","الملاحظة"]]}/>}
   {tab==="audit"&&<RecordsTable title="سجل تدقيق العمليات" rows={data.auditLogs||[]} cols={[["created_at","وقت العملية",x=>new Date(x.created_at).toLocaleString("ar")],["record_table","نوع السجل"],["action","العملية"],["changed_by_name","بواسطة"],["record_id","معرّف السجل"]]}/>}
  </>}
  {modal&&<div className="records-modal-backdrop" onClick={()=>!savingRecord&&setModal("")}><form className="records-modal" onSubmit={submit} onClick={e=>e.stopPropagation()}><button type="button" className="modal-close" disabled={savingRecord} onClick={()=>setModal("")}>×</button><h2>{{attendance:"تسجيل الحضور والغياب",memorization:"تسجيل الحفظ والمراجعة",exam:"إنشاء اختبار",exam_result:"إضافة نتيجة اختبار",note:"إضافة ملاحظة تعليمية"}[modal]}</h2>
   {modal!=="exam"&&<label>الطالب<select required value={form.student_id} onChange={e=>setForm({...form,student_id:e.target.value})}><option value="">اختر الطالب</option>{studentOptions.map(s=><option key={s.id} value={s.id}>{nameOf(s)}</option>)}</select></label>}
   {modal!=="exam_result"&&<label>الحلقة<select required value={form.class_id} onChange={e=>setForm({...form,class_id:e.target.value})}><option value="">اختر الحلقة</option>{data.classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
   {modal==="attendance"&&<><label>التاريخ<input type="date" required value={form.attendance_date} onChange={e=>setForm({...form,attendance_date:e.target.value})}/></label><label>الحالة<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{[["present","حاضر"],["absent","غائب"],["late","متأخر"],["excused","مستأذن"]].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></>}
   {modal==="memorization"&&<><label>التاريخ<input type="date" required value={form.record_date} onChange={e=>setForm({...form,record_date:e.target.value})}/></label><label>نوع السجل<select value={form.record_type} onChange={e=>setForm({...form,record_type:e.target.value})}><option value="new_memorization">حفظ جديد</option><option value="revision">مراجعة</option></select></label><label>اسم السورة<select required value={form.surah_number} onChange={e=>setForm({...form,surah_number:e.target.value})}>{surahNames.map((name,index)=><option key={name} value={String(index+1)}>{name}</option>)}</select></label><div className="records-two-fields"><label>من آية<input type="number" min="1" required value={form.from_ayah} onChange={e=>setForm({...form,from_ayah:e.target.value})}/></label><label>إلى آية<input type="number" min="1" required value={form.to_ayah} onChange={e=>setForm({...form,to_ayah:e.target.value})}/></label></div><label>مستوى الإتقان<select value={form.verbal_rating} onChange={e=>setForm({...form,verbal_rating:e.target.value})}>{[["excellent","متقن"],["very_good","جيد جدًا"],["good","جيد"],["acceptable","مقبول"],["needs_improvement","يحتاج إلى تحسين"]].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></>}
   {modal==="note"&&<><label>التاريخ<input type="date" required value={form.note_date} onChange={e=>setForm({...form,note_date:e.target.value})}/></label><label>الملاحظة<textarea required value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></label></>}
   {modal==="exam"&&<><label>عنوان الاختبار<input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label>تاريخ الاختبار<input type="date" required value={form.exam_date} onChange={e=>setForm({...form,exam_date:e.target.value})}/></label><label>الوصف<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label></>}
   {modal==="exam_result"&&<><label>الاختبار<select required value={form.exam_id} onChange={e=>setForm({...form,exam_id:e.target.value})}><option value="">اختر الاختبار</option>{data.exams.map(x=><option key={x.id} value={x.id}>{x.title} — {classMap[x.class_id]}</option>)}</select></label><label>الدرجة<input type="number" min="0" step="0.01" required value={form.score} onChange={e=>setForm({...form,score:e.target.value})}/></label></>}
   {!["note"].includes(modal)&&modal!=="exam"&&<label>ملاحظات إضافية<textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>}
   <button className="records-submit" type="submit" disabled={savingRecord}>{savingRecord?"جارٍ الحفظ...":"حفظ السجل"}</button></form></div>}
 </main>;
}
function RecordsTable({title,rows,cols}){return <section className="records-panel"><h2>{title}</h2><div className="records-table-wrap"><table><thead><tr>{cols.map(c=><th key={c[0]}>{c[1]}</th>)}</tr></thead><tbody>{rows.length?rows.map((r,i)=><tr key={r.id||i}>{cols.map(c=><td key={c[0]}>{c[2]?c[2](r):r[c[0]]??"—"}</td>)}</tr>):<tr><td colSpan={cols.length}>لا توجد سجلات ضمن التصفية الحالية.</td></tr>}</tbody></table></div></section>}
