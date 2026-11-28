"use client";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import ExcelJS from "exceljs";
import {
 saveEducationalSnapshot, readEducationalSnapshot,
 enqueueEducationalOperation, listEducationalOperations,
 acknowledgeEducationalOperations, readEducationalOfflineMeta,
 saveEducationalOfflineMeta, updateEducationalOperationStatus
} from "../../../lib/educationalOfflineStore";

const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
const nameOf=s=>[s?.first_name,s?.middle_name,s?.last_name].filter(Boolean).join(" ");
const id=()=>crypto.randomUUID();
const surahNames=["الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"];
const surahName=n=>surahNames[Number(n)-1]||"—";
const attendanceLabels={present:"حاضر",absent:"غائب",late:"متأخر",excused:"مستأذن"};
const memorizationLabels={new_memorization:"حفظ جديد",revision:"مراجعة"};
const ratingLabels={excellent:"متقن",very_good:"جيد جدًا",good:"جيد",acceptable:"مقبول",needs_improvement:"يحتاج إلى تحسين"};
const empty={classes:[],students:[],attendance:[],memorization:[],exams:[],notes:[],enrollments:[],assignments:[],examResults:[],teachers:[],teacherAttendance:[],auditLogs:[]};

async function warmEducationalShell(){
 if(!("serviceWorker" in navigator))throw new Error("هذا المتصفح لا يدعم تجهيز الصفحة للعمل دون إنترنت.");
 await navigator.serviceWorker.register("/educational-sw.js",{scope:"/"});
 const registration=await Promise.race([
  navigator.serviceWorker.ready,
  new Promise((_,reject)=>setTimeout(()=>reject(new Error("انتهت مهلة تجهيز التطبيق دون إنترنت.")),12000))
 ]);
 const worker=registration.active||navigator.serviceWorker.controller;
 if(!worker)throw new Error("لم يبدأ مكوّن العمل دون إنترنت بعد.");
 const channel=new MessageChannel();
 const result=await Promise.race([
  new Promise((resolve,reject)=>{
   channel.port1.onmessage=event=>event.data?.success?resolve(true):reject(new Error(event.data?.error||"تعذر تخزين صفحة السجل التعليمي."));
   worker.postMessage({type:"CACHE_EDUCATIONAL_SHELL"},[channel.port2]);
  }),
  new Promise((_,reject)=>setTimeout(()=>reject(new Error("لم يكتمل تجهيز صفحة السجل التعليمي.")),15000))
 ]);
 return result===true;
}


export default function EducationalRecordsClient({profile}){
 const [data,setData]=useState(empty),[offlineQueue,setOfflineQueue]=useState({pending:0,needs_review:0,failed:0}),[offlinePreparation,setOfflinePreparation]=useState("preparing"),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState(""),[notice,setNotice]=useState(""),[tab,setTab]=useState("overview"),[classFilter,setClassFilter]=useState("all"),[studentFilter,setStudentFilter]=useState("all"),[from,setFrom]=useState(""),[to,setTo]=useState(""),[modal,setModal]=useState(""),[form,setForm]=useState({class_id:"",student_id:"",attendance_date:today(),status:"present",record_date:today(),record_type:"new_memorization",surah_number:"1",from_ayah:"1",to_ayah:"1",verbal_rating:"excellent",note_date:today(),note:"",exam_date:today(),title:"",description:"",exam_id:"",score:"",notes:""}),[prepClass,setPrepClass]=useState(""),[prepDate,setPrepDate]=useState(today()),[attendanceMarks,setAttendanceMarks]=useState({}),[savingSheet,setSavingSheet]=useState(false),[savingRecord,setSavingRecord]=useState(false),[teacherDate,setTeacherDate]=useState(today()),[teacherMarks,setTeacherMarks]=useState({}),[teacherNotes,setTeacherNotes]=useState({}),[savingTeacherSheet,setSavingTeacherSheet]=useState(false),[prepExportMode,setPrepExportMode]=useState("one"),[prepExportClasses,setPrepExportClasses]=useState([]);
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
 const existingPrepAttendance=useMemo(()=>Object.fromEntries(data.attendance.filter(r=>r.class_id===prepClass&&r.attendance_date===prepDate).map(r=>[r.student_id,r.status==="present"])),[data.attendance,prepClass,prepDate]);\n const teacherAttendanceForDate=useMemo(()=>Object.fromEntries((data.teacherAttendance||[]).filter(r=>r.attendance_date===teacherDate).map(r=>[r.teacher_id,r])),[data.teacherAttendance,teacherDate]);
 useEffect(()=>{if(!prepClass&&data.classes.length)setPrepClass(data.classes[0].id)},[data.classes,prepClass]);
 useEffect(()=>{setAttendanceMarks(existingPrepAttendance)},[prepClass,prepDate,existingPrepAttendance]);\n useEffect(()=>{setTeacherMarks(Object.fromEntries(data.teachers.map(t=>[t.id,teacherAttendanceForDate[t.id]?.status!==\"absent\"])));setTeacherNotes(Object.fromEntries(data.teachers.map(t=>[t.id,teacherAttendanceForDate[t.id]?.notes||\"\"])))},[teacherDate,data.teachers,teacherAttendanceForDate]);\n useEffect(()=>{if(prepClass&&!prepExportClasses.length)setPrepExportClasses([prepClass])},[prepClass,prepExportClasses.length]);
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
   setOfflinePreparation("preparing");
   try{
    await warmEducationalShell();
    await saveEducationalOfflineMeta(profile.id,{role:profile.role,lastVerifiedAt:verifiedAt,shellReadyAt:new Date().toISOString()});
    setOfflinePreparation("ready");
   }catch(preparationError){
    await saveEducationalOfflineMeta(profile.id,{role:profile.role,lastVerifiedAt:verifiedAt,shellReadyAt:null});
    setOfflinePreparation("failed");
    setNotice(preparationError.message||"حُفظت البيانات، لكن تجهيز الصفحة دون إنترنت لم يكتمل.");
   }
  }catch(error){
   try{
    const meta=await readEducationalOfflineMeta(profile.id);
    const verified=meta?.lastVerifiedAt?new Date(meta.lastVerifiedAt).getTime():0;
    const shellReady=Boolean(meta?.shellReadyAt);
    const valid=verified>0&&Date.now()>=verified&&Date.now()-verified<=48*60*60*1000&&meta.role===profile.role&&shellReady;
    if(!valid)throw new Error("انتهت صلاحية العمل دون اتصال أو لم يسبق التحقق من هذا الحساب على هذا الجهاز. اتصل بالإنترنت لتسجيل الدخول والتحقق.");
    const cached=await readEducationalSnapshot(profile.id);
    if(!cached?.data)throw new Error("لا توجد نسخة تعليمية محفوظة لهذا الحساب على هذا الجهاز.");
    setData(cached.data);setLoadError("");setOfflinePreparation("ready");
    setNotice("أنت تعمل دون اتصال. البيانات المعروضة آخر نسخة تم التحقق منها، وستُزامن السجلات الجديدة عند عودة الإنترنت.");
   }catch(localError){setLoadError(localError.message||"تعذر تحميل البيانات المحلية.");}
  }finally{setLoading(false)}
 },[profile.id,profile.role]);
 useEffect(()=>{reload()},[reload]);
 useEffect(()=>{
  let active=true;
  const refreshQueue=async()=>{
   try{
    const [pending,review,failed]=await Promise.all([
     listEducationalOperations(profile.id,"pending"),
     listEducationalOperations(profile.id,"needs_review"),
     listEducationalOperations(profile.id,"failed")
    ]);
    if(active)setOfflineQueue({pending:pending.length,needs_review:review.length,failed:failed.length});
   }catch(error){console.error("Queue status read failed:",error)}
  };
  refreshQueue();
  const timer=setInterval(refreshQueue,5000);
  window.addEventListener("online",refreshQueue);
  return()=>{active=false;clearInterval(timer);window.removeEventListener("online",refreshQueue)};
 },[profile.id]);
 useEffect(()=>{
  let running=false;
  const syncPending=async()=>{
   if(running||!navigator.onLine)return;
   running=true;
   try{
    // Recover operations left in "syncing" if the browser was closed mid-request.
    const interrupted=await listEducationalOperations(profile.id,"syncing");
    for(const item of interrupted) await updateEducationalOperationStatus(item.operationId,"pending","استُعيدت العملية بعد إغلاق التطبيق أثناء المزامنة.");
    const pending=await listEducationalOperations(profile.id,"pending");
    for(const item of pending){
     if(!navigator.onLine)break;
     try{
      await updateEducationalOperationStatus(item.operationId,"syncing");
      const response=await fetch("/api/educational-records",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({operation:item.operation,payload:item.payload}),cache:"no-store"});
      const result=await response.json().catch(()=>({}));
      if(response.ok&&result.success===true){
       await acknowledgeEducationalOperations(profile.id,[item.operationId]);
       setNotice("تمت مزامنة سجل محفوظ محليًا بنجاح.");
      }else if(response.status===409||response.status===400||response.status===403){
       await updateEducationalOperationStatus(item.operationId,"needs_review",result.error||"تحتاج العملية إلى مراجعة.");
       setNotice("توجد عملية محفوظة محليًا تحتاج إلى مراجعة قبل اعتمادها.");
       break;
      }else{
       await updateEducationalOperationStatus(item.operationId,"pending",result.error||"تعذر الاتصال بالخادم.");
       await saveEducationalOfflineMeta(profile.id,{lastSyncError:result.error||"تعذر اعتماد السجل",lastSyncErrorAt:new Date().toISOString()});
       break;
      }
     }catch(error){
      await updateEducationalOperationStatus(item.operationId,"pending",error?.message||"انقطع الاتصال أثناء المزامنة.");
      break;
     }
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
  }catch(error){
   if(error instanceof TypeError||(typeof navigator!=="undefined"&&!navigator.onLine)){
    try{
     await enqueueEducationalOperation({accountId:profile.id,operationId:item.payload.client_operation_id,operation,payload:item.payload});
     setModal("");setNotice("انقطع الاتصال أثناء الحفظ؛ تم الاحتفاظ بالسجل على هذا الجهاز وسيُزامن عند عودة الإنترنت.");
    }catch(queueError){setNotice(queueError.message||"تعذر حفظ السجل محليًا.");}
   }else setNotice(error.message||"تعذر حفظ السجل.");
  }
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
  }catch(error){
   if(error instanceof TypeError||(typeof navigator!=="undefined"&&!navigator.onLine)){
    try{
     for(const row of item.payload.rows) await enqueueEducationalOperation({accountId:profile.id,operationId:row.client_operation_id,operation:"attendance",payload:{...row,class_id:prepClass,attendance_date:prepDate,status:row.present?"present":"absent"}});
     setNotice("انقطع الاتصال أثناء الحفظ؛ تم الاحتفاظ بكشف التحضير على هذا الجهاز وسيُزامن عند عودة الإنترنت.");
    }catch(queueError){setNotice(queueError.message||"تعذر حفظ كشف التحضير محليًا.");}
   }else setNotice(error.message||"تعذر حفظ كشف التحضير.");
  }
  finally{setSavingSheet(false)}
 }
 function openForm(kind){setForm(f=>({...f,class_id:"",student_id:"",exam_id:"",attendance_date:today(),record_date:today(),note_date:today(),exam_date:today()}));setModal(kind)}
 async function submit(e){e.preventDefault();let op=modal,p={...form};if(op==="attendance")delete p.record_date;if(op==="memorization")delete p.attendance_date;if(op==="note")delete p.attendance_date;if(op==="exam")delete p.student_id;if(op==="exam_result"){const selectedExam=data.exams.find(x=>x.id===p.exam_id);if(!selectedExam){setNotice("اختر اختبارًا صحيحًا أولًا.");return}p.class_id=selectedExam.class_id;}await save(op,p)}
 function exportRows(){
  const rows=(arr,cols)=>arr.map(x=>Object.fromEntries(cols.map(([k,label,fn])=>[label,fn?fn(x):x[k]??""])));
  const stats=scopedStudents.map(s=>{const a=attendance.filter(r=>r.student_id===s.id),m=memorization.filter(r=>r.student_id===s.id),scores=resultsFiltered.filter(r=>r.student_id===s.id);return {"الطالب":nameOf(s)||"اسم غير مضاف","الحضور":a.filter(r=>r.status==="present").length,"الغياب":a.filter(r=>r.status==="absent").length,"نسبة الحضور":a.length?Math.round(a.filter(r=>r.status==="present").length/a.length*100)+"%":"—","الحفظ والمراجعة":m.length,"متوسط الاختبارات":scores.length?Math.round(scores.reduce((n,r)=>n+Number(r.score||0),0)/scores.length*10)/10:"—","يحتاج متابعة":m.some(r=>r.verbal_rating==="needs_improvement")||Boolean(a.length&&a.filter(r=>r.status==="absent").length/a.length>=.3)?"نعم":"لا"}});
  return [
   {name:"الملخص",rows:[{"المؤشر":"عدد الطلاب","القيمة":scopedStudents.length},{"المؤشر":"سجلات الحضور","القيمة":attendance.length},{"المؤشر":"الحضور","القيمة":attendance.filter(x=>x.status==="present").length},{"المؤشر":"الغياب","القيمة":attendance.filter(x=>x.status==="absent").length},{"المؤشر":"نسبة الحضور","القيمة":attendanceRate+"%"},{"المؤشر":"الحفظ والمراجعة","القيمة":memorization.length},{"المؤشر":"الاختبارات","القيمة":examsFiltered.length},{"المؤشر":"نتائج الاختبارات","القيمة":resultsFiltered.length},{"المؤشر":"متوسط الدرجات","القيمة":averageScore+"%"},{"المؤشر":"حالات تحتاج متابعة","القيمة":followUpStudents.length},{"المؤشر":"ملاحظات المعلمين","القيمة":notes.length}]},
   {name:"مؤشرات الطلاب",rows:stats},
   {name:"الطلاب",rows:rows(scopedStudents,[["id","معرّف الطالب"],["first_name","الاسم الأول"],["middle_name","الاسم الأوسط"],["last_name","اسم العائلة"],["birth_date","تاريخ الميلاد"],["gender","الجنس",x=>x.gender==="male"?"ذكر":x.gender==="female"?"أنثى":"غير محدد"]])},
   {name:"الحضور",rows:rows(attendance,[["attendance_date","التاريخ"],["student_id","الطالب",x=>studentMap[x.student_id]||"—"],["class_id","الحلقة",x=>classMap[x.class_id]||"—"],["status","الحالة",x=>attendanceLabels[x.status]||x.status],["notes","ملاحظات"]])},
   {name:"الحفظ والمراجعة",rows:rows(memorization,[["record_date","التاريخ"],["student_id","الطالب",x=>studentMap[x.student_id]||"—"],["class_id","الحلقة",x=>classMap[x.class_id]||"—"],["record_type","النوع",x=>memorizationLabels[x.record_type]||x.record_type],["surah_number","السورة",x=>surahName(x.surah_number)],["from_ayah","من آية"],["to_ayah","إلى آية"],["verbal_rating","الإتقان",x=>ratingLabels[x.verbal_rating]||x.verbal_rating],["notes","ملاحظات"]])},
   {name:"الاختبارات",rows:rows(examsFiltered,[["exam_date","التاريخ"],["title","الاختبار"],["class_id","الحلقة",x=>classMap[x.class_id]||"—"],["description","الوصف"]])},
   {name:"النتائج",rows:resultsFiltered.map(r=>({"الاختبار":data.exams.find(e=>e.id===r.exam_id)?.title||"—","الطالب":studentMap[r.student_id]||"—","الدرجة":Number(r.score||0),"ملاحظات":r.notes||""}))},
   {name:"ملاحظات المعلمين",rows:rows(notes,[["note_date","التاريخ"],["student_id","الطالب",x=>studentMap[x.student_id]||"—"],["class_id","الحلقة",x=>classMap[x.class_id]||"—"],["note","الملاحظة"]])},
   {name:"سجل التدقيق",rows:rows(data.auditLogs||[],[["created_at","وقت العملية"],["record_table","نوع السجل"],["record_id","معرّف السجل"],["action","العملية"],["changed_by_name","بواسطة"]])}
  ];
 }
 async function exportExcel(){
  try{
   const wb=new ExcelJS.Workbook();wb.creator="منظومة عَون الإدارية";wb.title="تقرير السجل التعليمي";wb.subject="مسجد التراحم";wb.created=new Date();
   for(const item of exportRows()){
    const ws=wb.addWorksheet(item.name,{views:[{rightToLeft:true,state:"frozen",ySplit:1}]});
    const keys=item.rows.length?Object.keys(item.rows[0]):["لا توجد بيانات"];
    ws.columns=keys.map(k=>({header:k,key:k,width:Math.min(42,Math.max(15,k.length+4,...item.rows.slice(0,100).map(r=>String(r[k]??"").length+2)))}));
    if(item.rows.length)ws.addRows(item.rows);else ws.addRow({"لا توجد بيانات":"لا توجد سجلات ضمن الفلاتر المحددة"});
    ws.autoFilter={from:{row:1,column:1},to:{row:1,column:keys.length}};
    ws.getRow(1).height=30;ws.getRow(1).eachCell(cell=>{cell.font={name:"Arial",size:11,bold:true,color:{argb:"FFFFFFFF"}};cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"174C35"}};cell.alignment={horizontal:"center",vertical:"middle",wrapText:true};cell.border={bottom:{style:"medium",color:{argb:"42C82D"}}};});
    for(let n=2;n<=ws.rowCount;n++){const row=ws.getRow(n);row.height=24;row.eachCell(cell=>{cell.font={name:"Arial",size:10,color:{argb:"202820"}};cell.alignment={horizontal:"right",vertical:"middle",wrapText:true};cell.border={bottom:{style:"hair",color:{argb:"DCE6D8"}}};if(n%2===0)cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"F5F8F3"}};});}
    ws.pageSetup={orientation:"landscape",fitToPage:true,fitToWidth:1,fitToHeight:0,paperSize:9};ws.headerFooter.oddHeader="&Bمنظومة عَون الإدارية - مسجد التراحم";ws.headerFooter.oddFooter="صفحة &P من &N";
   }
   const blob=new Blob([await wb.xlsx.writeBuffer()],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`تقرير-السجل-التعليمي-${today()}.xlsx`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice("تم إنشاء ملف Excel منسق بأوراق مستقلة وفلاتر وعناوين واضحة.");
  }catch(e){console.error("Excel export",e);setNotice("تعذر إنشاء ملف Excel.");}
 }
 function exportPdf(){
  try{
   const esc=v=>String(v??"—").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
   const sheets=exportRows(),summary=sheets[0].rows;
   const table=(title,rows)=>`<section><h2>${esc(title)}</h2>${rows.length?`<table><thead><tr>${Object.keys(rows[0]).map(k=>`<th>${esc(k)}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${Object.values(r).map(v=>`<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table>`:'<p>لا توجد بيانات ضمن الفلاتر المحددة.</p>'}</section>`;
   const popup=window.open("","_blank");if(!popup){setNotice("اسمح بالنوافذ المنبثقة لهذا الموقع لإعداد PDF.");return;}
   const context=[`الحلقة: ${classFilter==="all"?"جميع الحلقات":classMap[classFilter]||"—"}`,`الطالب: ${studentFilter==="all"?"جميع الطلاب":studentMap[studentFilter]||"—"}`,`الفترة: ${from||"من البداية"} — ${to||"حتى اليوم"}`,`تاريخ التصدير: ${today()}`];
   popup.document.open();popup.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير السجل التعليمي</title><style>
   @page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,Tahoma,sans-serif;color:#202820;font-size:9px;line-height:1.6;direction:rtl}.cover{border-bottom:3px solid #42c82d;padding-bottom:12px;margin-bottom:14px}.brand{color:#42c82d;font-weight:bold}.cover h1{color:#174c35;font-size:23px;margin:5px 0}.meta{display:grid;grid-template-columns:repeat(2,1fr);gap:5px;margin-top:10px}.meta span,.summary div{background:#f1f6ef;border:1px solid #dce6d8;padding:6px}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:12px 0 18px}.summary b{display:block;color:#174c35;font-size:14px}section{margin-bottom:16px;break-inside:auto}h2{background:#174c35;color:white;padding:7px 9px;font-size:12px;break-after:avoid}table{width:100%;border-collapse:collapse;font-size:8px}thead{display:table-header-group}tr{break-inside:avoid}th,td{border:1px solid #dce6d8;padding:5px;text-align:right;vertical-align:top;overflow-wrap:anywhere}th{background:#eaf3e7;color:#174c35}tbody tr:nth-child(even){background:#f7faf5}.footer{text-align:center;border-top:1px solid #dce6d8;margin-top:16px;padding-top:7px;color:#68756c}@media screen{body{max-width:1100px;margin:20px auto;padding:20px}}</style></head><body>
   <header class="cover"><div class="brand">مَنْظُومَة عَوْن الإدارية · مسجد التراحم</div><h1>تقرير السجل التعليمي</h1><p>الحضور والحفظ والمراجعة والاختبارات وملاحظات المعلمين</p><div class="meta">${context.map(x=>`<span>${esc(x)}</span>`).join("")}</div></header>
   <div class="summary">${summary.map(r=>`<div>${esc(r["المؤشر"])}<b>${esc(r["القيمة"])}</b></div>`).join("")}</div>${sheets.slice(1).map(s=>table(s.name,s.rows)).join("")}<div class="footer">منظومة عَون الإدارية - مسجد التراحم</div><script>window.addEventListener("load",()=>setTimeout(()=>window.print(),500));</script></body></html>`);popup.document.close();setNotice("تم تجهيز التقرير. من نافذة الطباعة اختر «حفظ كـ PDF».");
  }catch(e){console.error("PDF export",e);setNotice("تعذر تجهيز ملف PDF.");}
 }
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
 const formActivityDate=modal==="attendance"?form.attendance_date:modal==="memorization"?form.record_date:modal==="note"?form.note_date:modal==="exam_result"?(data.exams.find(x=>x.id===form.exam_id)?.exam_date||today()):today();
 const formClassId=modal==="exam_result"?(data.exams.find(x=>x.id===form.exam_id)?.class_id||""):form.class_id;
 const studentOptions=useMemo(()=>data.students.filter(student=>data.enrollments.some(enrollment=>enrollment.student_id===student.id&&enrollment.class_id===formClassId&&enrollment.start_date<=formActivityDate&&(!enrollment.end_date||enrollment.end_date>=formActivityDate))),[data.students,data.enrollments,formClassId,formActivityDate]);
 return <main className="records-page" dir="rtl">
  {notice&&<div className="records-toast" role="status">{notice}<button onClick={()=>setNotice("")} aria-label="إغلاق">×</button></div>}
  <header className="records-header"><a href="/dashboard">← لوحة التحكم</a><div><small>منظومة عَون · مسجد التراحم</small><h1>السجل التعليمي</h1><p>إدارة ومتابعة رحلة الطالب التعليمية</p></div><div className="records-export-group"><button className="records-export" onClick={exportExcel}>تصدير Excel</button><button className="records-export records-export-pdf" onClick={exportPdf}>تصدير PDF</button></div></header>
  <section className="records-status"><span className="status-dot"></span>{typeof navigator!=="undefined"&&!navigator.onLine?"وضع دون اتصال · السجلات الجديدة تحفظ محليًا":"متصل · يتم التحقق من الحساب ومزامنة السجلات"}<strong>{offlinePreparation==="ready"?"✓ التطبيق جاهز للعمل دون إنترنت لمدة 48 ساعة من آخر تحقق ناجح":offlinePreparation==="preparing"?"جارٍ تجهيز التطبيق للعمل دون إنترنت…":"⚠ لم يكتمل تجهيز التطبيق للعمل دون إنترنت"}</strong><span>بانتظار المزامنة: {offlineQueue.pending}</span>{offlineQueue.needs_review>0&&<strong>تحتاج مراجعة: {offlineQueue.needs_review}</strong>}{offlineQueue.failed>0&&<strong>فشلت: {offlineQueue.failed}</strong>}<button type="button" onClick={reload}>تحديث السجلات</button></section>
  <section className="records-filters"><label>الحلقة<select value={classFilter} onChange={e=>setClassFilter(e.target.value)}><option value="all">كل الحلقات</option>{data.classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>الطالب<select value={studentFilter} onChange={e=>setStudentFilter(e.target.value)}><option value="all">كل الطلاب</option>{scopedStudents.map(s=><option key={s.id} value={s.id}>{nameOf(s)}</option>)}</select></label><label>من تاريخ<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>إلى تاريخ<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></section>
  <section className="records-kpis"><article><small>الطلاب</small><strong>{scopedStudents.length}</strong><span>ضمن النطاق المحدد</span></article><article><small>نسبة الحضور</small><strong>{attendanceRate}%</strong><span>{attendance.length} سجل حضور</span></article><article><small>الحفظ والمراجعة</small><strong>{memorization.length}</strong><span>سجل تعليمي</span></article><article><small>متوسط الاختبارات</small><strong>{averageScore}%</strong><span>{resultsFiltered.length} نتيجة مسجلة</span></article><article><small>يحتاجون متابعة</small><strong>{followUpStudents.length}</strong><span>حسب الحضور ومستوى الإتقان</span></article></section>
  <nav className="records-tabs">{[["overview","نظرة عامة"],["attendance","تحضير الطلاب"],["teacher_attendance","حضور المعلمين"],["memorization","الحفظ والمراجعة"],["exams","الاختبارات والنتائج"],["notes","ملاحظات المعلمين"],["audit","سجل التغييرات"]].map(([k,v])=><button className={tab===k?"active":""} key={k} onClick={()=>setTab(k)}>{v}</button>)}</nav>
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
    <div className="records-roster-controls"><label>نطاق تصدير التحضير<select value={prepExportMode} onChange={e=>setPrepExportMode(e.target.value)}><option value="one">حلقة واحدة</option><option value="two">حلقتان</option><option value="all">جميع الحلقات</option></select></label><label>الحلقات<select multiple value={prepExportClasses} onChange={e=>setPrepExportClasses([...e.target.selectedOptions].map(o=>o.value))}>{data.classes.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><div className="records-export-group"><button className="records-export" type="button" onClick={()=>exportPreparation("excel")}>تصدير التحضير Excel</button><button className="records-export records-export-pdf" type="button" onClick={()=>exportPreparation("pdf")}>تصدير التحضير PDF</button></div></div>\n    <div className="records-table-wrap records-previous-attendance"><h3>السجلات السابقة</h3><table><thead><tr><th>التاريخ</th><th>الطالب</th><th>الحالة</th></tr></thead><tbody>{attendance.length?attendance.slice(0,100).map(row=><tr key={row.id}><td>{row.attendance_date}</td><td>{studentMap[row.student_id]||"—"}</td><td>{attendanceLabels[row.status]||row.status}</td></tr>):<tr><td colSpan="3">لا توجد سجلات ضمن التصفية.</td></tr>}</tbody></table></div>
   </section>}
   {tab==="teacher_attendance"&&<section className="records-panel"><div className="records-panel-heading"><div><h2>تحضير المعلمين</h2><p>سجل حضور المعلمين وغيابهم وأضف ملاحظة عند الحاجة.</p></div><span className="records-roster-count">{data.teachers.length} معلم</span></div><div className="records-roster-controls"><label>تاريخ التحضير<input type="date" value={teacherDate} onChange={e=>setTeacherDate(e.target.value)}/></label></div>{!data.teachers.length?<div className="records-empty">لا توجد حسابات معلمين نشطة.</div>:<div className="records-roster-list"><div className="records-roster-head"><span>م</span><span>اسم المعلم</span><span>حاضر</span></div>{data.teachers.map((t,i)=><div className="records-roster-row" key={t.id}><span>{i+1}</span><strong>{t.full_name}</strong><span className="records-present-check"><input type="checkbox" checked={teacherMarks[t.id]!==false} onChange={e=>setTeacherMarks(v=>({...v,[t.id]:e.target.checked}))}/><b>{teacherMarks[t.id]!==false?"✓":""}</b></span><input aria-label="ملاحظات المعلم" placeholder="ملاحظة..." value={teacherNotes[t.id]||""} onChange={e=>setTeacherNotes(v=>({...v,[t.id]:e.target.value}))}/></div>)}</div>}<button className="records-submit records-roster-save" disabled={!canWrite||savingTeacherSheet} onClick={saveTeacherAttendance}>{savingTeacherSheet?"جارٍ الحفظ...":"حفظ حضور المعلمين"}</button><RecordsTable title="سجلات حضور المعلمين" rows={data.teacherAttendance||[]} cols={[[ "attendance_date","التاريخ"],["teacher_name","المعلم"],["status","الحالة",x=>attendanceLabels[x.status]||x.status],["notes","ملاحظات"]]}/></section>}\n   {tab==="memorization"&&<RecordsTable title="سجل الحفظ والمراجعة" rows={memorization} cols={[["record_date","التاريخ"],["student_id","الطالب",x=>studentMap[x.student_id]],["class_id","الحلقة",x=>classMap[x.class_id]],["record_type","النوع",x=>memorizationLabels[x.record_type]||x.record_type],["surah_number","السورة",x=>surahName(x.surah_number)],["from_ayah","من آية"],["to_ayah","إلى آية"],["verbal_rating","الإتقان",x=>ratingLabels[x.verbal_rating]||x.verbal_rating],["notes","ملاحظات"]]}/>}
   {tab==="exams"&&<><RecordsTable title="الاختبارات" rows={examsFiltered} cols={[["exam_date","التاريخ"],["title","الاختبار"],["class_id","الحلقة",x=>classMap[x.class_id]],["description","الوصف"]]}/><RecordsTable title="نتائج الاختبارات" rows={resultsFiltered} cols={[["student_id","الطالب",x=>studentMap[x.student_id]],["exam_id","الاختبار",x=>data.exams.find(e=>e.id===x.exam_id)?.title||"—"],["score","الدرجة"],["notes","ملاحظات"]]}/></>}
   {tab==="notes"&&<RecordsTable title="ملاحظات المعلمين" rows={notes} cols={[["note_date","التاريخ"],["student_id","الطالب",x=>studentMap[x.student_id]],["class_id","الحلقة",x=>classMap[x.class_id]],["note","الملاحظة"]]}/>}
   {tab==="audit"&&<RecordsTable title="سجل تدقيق العمليات" rows={data.auditLogs||[]} cols={[["created_at","وقت العملية",x=>new Date(x.created_at).toLocaleString("ar")],["record_table","نوع السجل"],["action","العملية"],["changed_by_name","بواسطة"],["record_id","معرّف السجل"]]}/>}
  </>}
  {modal&&<div className="records-modal-backdrop" onClick={()=>!savingRecord&&setModal("")}><form className="records-modal" onSubmit={submit} onClick={e=>e.stopPropagation()}><button type="button" className="modal-close" disabled={savingRecord} onClick={()=>setModal("")}>×</button><h2>{{attendance:"تسجيل الحضور والغياب",memorization:"تسجيل الحفظ والمراجعة",exam:"إنشاء اختبار",exam_result:"إضافة نتيجة اختبار",note:"إضافة ملاحظة تعليمية"}[modal]}</h2>
   {modal!=="exam"&&modal!=="exam_result"&&<label>الحلقة<select required value={form.class_id} onChange={e=>setForm({...form,class_id:e.target.value,student_id:""})}><option value="">اختر الحلقة أولًا</option>{data.classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
   {modal!=="exam"&&<label>الطالب<select required value={form.student_id} disabled={!formClassId||studentOptions.length===0} onChange={e=>setForm({...form,student_id:e.target.value})}><option value="">{!formClassId?"اختر الحلقة أولًا":studentOptions.length?"اختر الطالب":"لا يوجد طلاب مسجلون في هذه الحلقة بهذا التاريخ"}</option>{studentOptions.map(student=><option key={student.id} value={student.id}>{nameOf(student)}</option>)}</select></label>}
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
