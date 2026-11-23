"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const empty = { students: [], classes: [], attendance: [], memorization: [], exams: [], examResults: [], notes: [], enrollments: [], assignments: [], teachers: [] };
const fullName = (p) => [p?.first_name, p?.middle_name, p?.last_name].filter(Boolean).join(" ") || "بدون اسم";
const surahs = ["الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"];
const surah = (n) => surahs[Number(n) - 1] || "—";
const dateText = (v) => v ? new Date(v + (String(v).length === 10 ? "T00:00:00" : "")).toLocaleDateString("ar", { year:"numeric", month:"long", day:"numeric" }) : "غير مسجل";
const ageText = (birth) => {
  if (!birth) return "غير مسجل";
  const d = new Date(birth + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "غير مسجل";
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return age >= 0 ? age + " سنة" : "غير مسجل";
};
const rating = { excellent:"متقن", very_good:"جيد جدًا", good:"جيد", acceptable:"مقبول", needs_improvement:"يحتاج إلى تحسين" };
const attendanceLabel = { present:"حاضر", absent:"غائب", late:"متأخر", excused:"مستأذن" };

export default function GuardianDashboardClient({ profile }) {
  const [data, setData] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/educational-records", { cache:"no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "تعذر تحميل بيانات الأبناء.");
      setData(result.data || empty);
      setSelectedId((current) => current && result.data?.students?.some(s => s.id === current) ? current : result.data?.students?.[0]?.id || "");
    } catch (e) {
      setError(e.message || "تعذر الاتصال بالخادم.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const children = useMemo(() => data.students.map((student) => {
    const enrollments = data.enrollments.filter(e => e.student_id === student.id);
    const activeEnrollment = enrollments.filter(e => !e.end_date).sort((a,b) => String(b.start_date).localeCompare(String(a.start_date)))[0] || enrollments.sort((a,b) => String(b.start_date).localeCompare(String(a.start_date)))[0];
    const classId = activeEnrollment?.class_id;
    const classInfo = data.classes.find(c => c.id === classId);
    const teacherIds = data.assignments.filter(a => a.class_id === classId).map(a => a.teacher_id);
    const teacherNames = data.teachers.filter(t => teacherIds.includes(t.id)).map(t => t.full_name).filter(Boolean);
    const attendance = data.attendance.filter(r => r.student_id === student.id);
    const memorization = data.memorization.filter(r => r.student_id === student.id);
    const exams = data.exams.filter(ex => data.examResults.some(r => r.exam_id === ex.id && r.student_id === student.id)).map(ex => ({...ex, result:data.examResults.find(r => r.exam_id === ex.id && r.student_id === student.id)}));
    const notes = data.notes.filter(r => r.student_id === student.id);
    const stamps = [...attendance,...memorization,...exams.map(x=>x.result),...notes].flatMap(x=>[x?.updated_at,x?.created_at]).filter(Boolean).sort().reverse();
    return { student, className:classInfo?.name || "غير محددة", teacherNames, attendance, memorization, exams, notes, lastUpdate:stamps[0] || null };
  }), [data]);

  const selected = children.find(x => x.student.id === selectedId);
  const counts = selected ? {
    present:selected.attendance.filter(x=>x.status==="present").length,
    absent:selected.attendance.filter(x=>x.status==="absent").length,
    late:selected.attendance.filter(x=>x.status==="late").length
  } : null;

  return <main className="guardian-page" dir="rtl">
    <header className="guardian-header">
      <a href="/dashboard" className="guardian-brand"><span className="guardian-mark">ع</span><span><strong>منظومة عَون</strong><small>مسجد التراحم · بوابة ولي الأمر</small></span></a>
      <div className="guardian-account"><span>{(profile.full_name || "و").trim().charAt(0)}</span><div><strong>{profile.full_name}</strong><small>ولي الأمر</small></div><button onClick={async()=>{await fetch("/api/auth/logout",{method:"POST"});window.location.replace("/login");}}>تسجيل الخروج</button></div>
    </header>
    <section className="guardian-hero"><div><small>بوابة الأسرة</small><h1>متابعة الأبناء</h1><p>يمكنك الاطلاع على السجلات التعليمية والحضور والحفظ ونتائج الاختبارات لأبنائك.</p></div><div className="guardian-hero-count"><strong>{children.length}</strong><span>الأبناء المرتبطون بحسابك</span></div></section>
    {loading ? <div className="guardian-state">جارٍ تحميل بيانات الأبناء...</div> : error ? <div className="guardian-state guardian-error">{error}<button onClick={load}>إعادة المحاولة</button></div> : !children.length ? <div className="guardian-state">لا يوجد أبناء مرتبطون بحسابك حاليًا. يرجى مراجعة إدارة المنظومة.</div> : <>
      <section className="guardian-child-picker"><div><small>ملفات الأبناء</small><h2>اختر ملف الابن</h2></div><div className="guardian-child-tabs">{children.map(({student})=><button key={student.id} className={student.id===selectedId?"active":""} onClick={()=>setSelectedId(student.id)}>{fullName(student)}</button>)}</div></section>
      {selected && <div className="guardian-content">
        <section className="guardian-profile-card"><div className="guardian-initial">{fullName(selected.student).charAt(0)}</div><div className="guardian-profile-main"><small>ملف الطالب</small><h2>{fullName(selected.student)}</h2><p>الحلقة: <strong>{selected.className}</strong></p><p>المعلم: <strong>{selected.teacherNames.join("، ") || "غير محدد"}</strong></p></div><div className="guardian-birth"><span>تاريخ الميلاد</span><strong>{dateText(selected.student.birth_date)}</strong><span>العمر</span><strong>{ageText(selected.student.birth_date)}</strong></div></section>
        <section className="guardian-stat-grid"><article><span>الحضور</span><strong>{counts.present}</strong><small>يومًا</small></article><article><span>الغياب</span><strong>{counts.absent}</strong><small>يومًا</small></article><article><span>التأخر</span><strong>{counts.late}</strong><small>مرات</small></article><article><span>الحفظ والمراجعة</span><strong>{selected.memorization.length}</strong><small>سجلًا</small></article><article><span>الاختبارات</span><strong>{selected.exams.length}</strong><small>اختبارًا</small></article></section>
        <section className="guardian-panel"><h3>سجل الحضور والغياب</h3><div className="guardian-table-wrap"><table><thead><tr><th>التاريخ</th><th>الحالة</th><th>ملاحظات</th></tr></thead><tbody>{selected.attendance.length?selected.attendance.map(r=><tr key={r.id}><td>{dateText(r.attendance_date)}</td><td><span className={"guardian-badge "+(r.status==="present"?"good":r.status==="absent"?"bad":"")}>{attendanceLabel[r.status]||r.status}</span></td><td>{r.notes||"—"}</td></tr>):<tr><td colSpan="3">لا توجد سجلات حضور مسجلة.</td></tr>}</tbody></table></div></section>
        <section className="guardian-panel"><h3>الحفظ والمراجعة</h3><div className="guardian-table-wrap"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>السورة</th><th>الآيات</th><th>الإتقان</th><th>ملاحظات</th></tr></thead><tbody>{selected.memorization.length?selected.memorization.map(r=><tr key={r.id}><td>{dateText(r.record_date)}</td><td>{r.record_type==="revision"?"مراجعة":"حفظ جديد"}</td><td>{surah(r.surah_number)}</td><td>{r.from_ayah} – {r.to_ayah}</td><td>{rating[r.verbal_rating]||r.verbal_rating||"—"}</td><td>{r.notes||"—"}</td></tr>):<tr><td colSpan="6">لا توجد سجلات حفظ أو مراجعة.</td></tr>}</tbody></table></div></section>
        <section className="guardian-panel"><h3>الاختبارات والنتائج</h3><div className="guardian-table-wrap"><table><thead><tr><th>الاختبار</th><th>التاريخ</th><th>الدرجة</th><th>ملاحظات</th></tr></thead><tbody>{selected.exams.length?selected.exams.map(x=><tr key={x.id}><td>{x.title}</td><td>{dateText(x.exam_date)}</td><td><strong>{x.result.score}</strong> / 100</td><td>{x.result.notes||x.description||"—"}</td></tr>):<tr><td colSpan="4">لا توجد نتائج اختبارات مسجلة.</td></tr>}</tbody></table></div></section>
        <section className="guardian-panel"><h3>ملاحظات المعلم</h3><div className="guardian-notes">{selected.notes.length?selected.notes.map(n=><article key={n.id}><div><strong>{dateText(n.note_date)}</strong><small>{dateText(n.created_at)}</small></div><p>{n.note}</p></article>):<p className="guardian-muted">لا توجد ملاحظات مسجلة.</p>}</div></section>
        <footer className="guardian-last-update">آخر تحديث للسجلات: <strong>{selected.lastUpdate?new Date(selected.lastUpdate).toLocaleString("ar",{dateStyle:"medium",timeStyle:"short"}):"لا توجد تحديثات مسجلة"}</strong></footer>
      </div>}
    </>}
  </main>;
}
