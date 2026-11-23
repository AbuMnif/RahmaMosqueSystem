"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

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

function SignaturePad({ onChange }) {
  const canvasRef = React.useRef(null);
  const strokesRef = React.useRef([]);
  const activeRef = React.useRef(null);
  const [strokes, setStrokes] = useState([]);
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = "#174c35";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    strokesRef.current.forEach(stroke => {
      if (!stroke.length) return;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x * rect.width, stroke[0].y * rect.height);
      stroke.slice(1).forEach(p => ctx.lineTo(p.x * rect.width, p.y * rect.height));
      ctx.stroke();
    });
  }, []);
  useEffect(() => {
    redraw();
    const observer = typeof ResizeObserver !== "undefined" && canvasRef.current
      ? new ResizeObserver(redraw) : null;
    if (observer && canvasRef.current) observer.observe(canvasRef.current);
    return () => observer?.disconnect();
  }, [redraw]);
  const point = e => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (e.clientX-r.left)/r.width)), y: Math.max(0, Math.min(1, (e.clientY-r.top)/r.height)) };
  };
  const start = e => {
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    activeRef.current = [point(e)];
    strokesRef.current = [...strokesRef.current, activeRef.current];
    setStrokes(strokesRef.current);
    redraw();
  };
  const move = e => {
    if (!activeRef.current) return;
    e.preventDefault();
    activeRef.current.push(point(e));
    redraw();
  };
  const end = () => {
    if (!activeRef.current) return;
    activeRef.current = null;
    const copy = strokesRef.current.map(s => s.map(p => ({...p})));
    strokesRef.current = copy;
    setStrokes(copy);
    onChange(copy);
  };
  const clear = () => {
    strokesRef.current = [];
    activeRef.current = null;
    setStrokes([]);
    onChange([]);
    redraw();
  };
  return <div className="guardian-signature-wrap">
    <canvas ref={canvasRef} className="guardian-signature" aria-label="مساحة التوقيع الإلكتروني"
      onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
    <div className="guardian-signature-footer"><span>{strokes.length ? "تم إدخال التوقيع" : "وقّع داخل المساحة أعلاه"}</span><button type="button" onClick={clear}>مسح التوقيع</button></div>
  </div>;
}

function GuardianActivities({ students, onViewed }) {
  const [payload, setPayload] = useState({ activities: [], responses: [] });
  const [selectedByActivity, setSelectedByActivity] = useState({});
  const [signatureByActivity, setSignatureByActivity] = useState({});
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");
  const [confirmReject, setConfirmReject] = useState(null);
  const [loadingActivities, setLoadingActivities] = useState(true);

  const refresh = useCallback(async () => {
    setLoadingActivities(true);
    try {
      const r = await fetch("/api/guardian/activities", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.error || "تعذر تحميل الأنشطة.");
      setPayload({ activities: j.activities || [], responses: j.responses || [], children: j.children || [] });
      const unseenIds = (j.activities || []).filter(a => a.is_new).map(a => a.id);
      if (unseenIds.length) {
        fetch("/api/guardian/activities", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activity_ids: unseenIds })
        }).then(response => { if (response.ok) onViewed?.(); }).catch(() => {});
      }
      setSelectedByActivity(current => {
        const next = {...current};
        (j.activities || []).forEach(a => {
          if (!next[a.id] || !(j.children || []).some(s => s.id === next[a.id])) next[a.id] = j.children?.[0]?.id || "";
        });
        return next;
      });
    } catch (e) { setFailure(e.message || "تعذر تحميل الأنشطة."); }
    finally { setLoadingActivities(false); }
  }, [onViewed]);

  useEffect(() => { refresh(); }, [refresh]);
  const getResponse = (activityId, studentId) => payload.responses.find(x => x.activity_id === activityId && x.student_id === studentId);
  const submit = async (activity, decision, studentId) => {
    const key = activity.id + ":" + studentId;
    setBusy(key); setFailure(""); setNotice("");
    try {
      const strokes = signatureByActivity[activity.id] || [];
      const r = await fetch("/api/guardian/activities", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ activity_id: activity.id, student_id: studentId, decision, signature_strokes: decision === "accepted" ? strokes : null })
      });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.error || "تعذر حفظ الرد.");
      setNotice(decision === "accepted" ? "تم تسجيل موافقتك وتوقيعك بنجاح." : "تم تسجيل رفض النشاط لهذا الابن.");
      setConfirmReject(null);
      await refresh();
    } catch (e) { setFailure(e.message || "تعذر حفظ الرد."); }
    finally { setBusy(""); }
  };

  return <section className="guardian-activities" id="guardian-activities">
    <div className="guardian-activities-heading"><div><span>الأنشطة والفعاليات</span><h2>موافقات الأنشطة</h2><p>اختر الابن لكل نشاط، ثم سجّل الموافقة بالتوقيع أو الرفض بعد التأكيد.</p></div><button type="button" onClick={refresh}>تحديث</button></div>
    {notice && <div className="guardian-activity-alert success" role="status">{notice}</div>}
    {failure && <div className="guardian-activity-alert error" role="alert">{failure}</div>}
    {loadingActivities ? <div className="guardian-activity-empty">جارٍ تحميل الأنشطة...</div> :
      !payload.activities.length ? <div className="guardian-activity-empty">لا توجد أنشطة منشورة تتطلب ردًا حاليًا.</div> :
      payload.activities.map(activity => {
        const studentId = selectedByActivity[activity.id] || payload.children?.[0]?.id || students[0]?.id || "";
        const student = (payload.children || students).find(s => s.id === studentId);
        const response = getResponse(activity.id, studentId);
        const canRespond = activity.can_respond && studentId;
        const key = activity.id + ":" + studentId;
        return <article className="guardian-activity-card" key={activity.id}>
          <div className="guardian-activity-top"><div><span className="guardian-activity-type">{activity.activity_type}</span><h3>{activity.title}</h3></div>
            {activity.is_new && <span className="guardian-activity-new">جديد</span>}
            <span className={"guardian-response-status " + (response?.decision === "accepted" ? "accepted" : response?.decision === "declined" ? "declined" : "pending")}>{response?.decision === "accepted" ? "تمت الموافقة" : response?.decision === "declined" ? "تم الرفض" : activity.can_respond ? "بانتظار الرد" : "انتهت المهلة"}</span>
          </div>
          <div className="guardian-activity-meta"><span>التاريخ: {dateText(activity.activity_date)}</span>{activity.start_time && <span>الوقت: {String(activity.start_time).slice(0,5)}{activity.end_time ? " – "+String(activity.end_time).slice(0,5) : ""}</span>}{activity.location && <span>المكان: {activity.location}</span>}{activity.response_deadline && <span>آخر موعد للرد: {new Date(activity.response_deadline).toLocaleString("ar",{dateStyle:"medium",timeStyle:"short"})}</span>}</div>
          {activity.details && <p className="guardian-activity-details">{activity.details}</p>}
          <div className="guardian-activity-child"><label htmlFor={"activity-child-"+activity.id}>تسجيل الرد باسم الابن</label><select id={"activity-child-"+activity.id} value={studentId} onChange={e=>setSelectedByActivity(v=>({...v,[activity.id]:e.target.value}))}>{students.map(s=><option key={s.id} value={s.id}>{fullName(s)}</option>)}</select></div>
          {response && <p className="guardian-previous-response">رد {fullName(student)}: <strong>{response.decision === "accepted" ? "موافق" : "رافض"}</strong> — {response.responded_at ? new Date(response.responded_at).toLocaleString("ar",{dateStyle:"medium",timeStyle:"short"}) : ""}</p>}
          {canRespond && <div className="guardian-activity-actions">
            <div className="guardian-signature-title"><strong>التوقيع الإلكتروني للموافقة</strong><small>ارسم توقيعك بإصبعك أو باستخدام الفأرة.</small></div>
            <SignaturePad key={activity.id} onChange={v=>setSignatureByActivity(s=>({...s,[activity.id]:v}))} />
            <div className="guardian-decision-buttons">
              <button type="button" className="approve" disabled={busy===key || !(signatureByActivity[activity.id]||[]).length} onClick={()=>submit(activity,"accepted",studentId)}>{busy===key ? "جارٍ الحفظ..." : response?.decision === "accepted" ? "تحديث الموافقة" : "موافقة وتوقيع"}</button>
              <button type="button" className="reject" disabled={Boolean(busy)} onClick={()=>setConfirmReject({activity,studentId,studentName:fullName(student)})}>{response?.decision === "declined" ? "تأكيد الرفض مجددًا" : "رفض النشاط"}</button>
            </div>
          </div>}
        </article>;
      })}
    {confirmReject && <div className="guardian-confirm-backdrop" role="presentation"><section className="guardian-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="reject-title">
      <span className="guardian-confirm-mark">!</span><h3 id="reject-title">تأكيد رفض النشاط</h3>
      <p>هل أنت متأكد من رفض هذا النشاط للابن <strong>{confirmReject.studentName}</strong>؟</p>
      <p className="guardian-confirm-note">سيتم تسجيل الرفض لهذا الابن فقط، ويمكنك تعديل الرد قبل انتهاء مهلة النشاط.</p>
      <div><button type="button" className="reject" disabled={Boolean(busy)} onClick={()=>submit(confirmReject.activity,"declined",confirmReject.studentId)}>نعم، تأكيد الرفض</button><button type="button" className="cancel" onClick={()=>setConfirmReject(null)}>تراجع</button></div>
    </section></div>}
  </section>;
}


export default function GuardianDashboardClient({ profile }) {
  const [data, setData] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [unreadActivities, setUnreadActivities] = useState(0);
  const [activeSection, setActiveSection] = useState("children");

  const refreshUnreadActivities = useCallback(async () => {
    try {
      const response = await fetch("/api/guardian/activities", { cache: "no-store" });
      const result = await response.json();
      if (response.ok && result.success) setUnreadActivities(Number(result.unread_count) || 0);
    } catch {}
  }, []);

  useEffect(() => {
    refreshUnreadActivities();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshUnreadActivities();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [refreshUnreadActivities]);

  const handleActivitiesViewed = useCallback(() => setUnreadActivities(0), []);

  const openSection = (section) => {
    setActiveSection(section);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

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
      <a className="guardian-brand" href="/">
        <img src="/images/mosque-logo.jpg" alt="شعار مسجد التراحم" />
        <span><strong>منظومة عَون</strong><small>مسجد التراحم</small></span>
      </a>
      <div className="guardian-account">
        <span>{(profile.full_name || "م").trim().charAt(0)}</span>
        <div><strong>{profile.full_name}</strong><small>ولي الأمر</small></div>
        <button onClick={async()=>{await fetch("/api/auth/logout",{method:"POST"});window.location.replace("/login");}}>تسجيل الخروج</button>
      </div>
    </header>
    <div className="guardian-dashboard-content">
      <section className="guardian-welcome">
        <div>
          <span className="guardian-kicker">مسجد التراحم</span>
          <h1>مرحبًا، {profile.full_name}</h1>
          <p>نسعد بوجودك في منظومة عَون الإدارية. اختر القسم الذي تريد الاطلاع عليه.</p>
        </div>
      </section>
      {!loading && !error && children.length > 0 && <>
        <section className="guardian-shortcuts" aria-label="الأقسام الرئيسية">
          <button type="button" className="guardian-module-card" onClick={() => openSection("activities")}>
            <span className="guardian-module-status">متاح</span>
            <div className="guardian-module-title-row">
              <h3>الأنشطة والموافقات</h3>
              {unreadActivities > 0 && <span className="activity-unread-badge">{unreadActivities > 99 ? "99+" : unreadActivities} جديد</span>}
            </div>
            <p>مراجعة الأنشطة المنشورة وتسجيل الموافقة أو الاعتذار بالتوقيع.</p>
            <div className="guardian-module-card-bottom">الدخول إلى القسم</div>
          </button>
          <button type="button" className="guardian-module-card" onClick={() => openSection("children")}>
            <span className="guardian-module-status">متاح</span>
            <h3>الأبناء</h3>
            <p>اختيار الابن للاطلاع على ملفه وسجلاته التعليمية.</p>
            <div className="guardian-module-card-bottom">الدخول إلى القسم</div>
          </button>
        </section>
        {activeSection === "activities" && <div className="guardian-activities-area">
          <GuardianActivities students={data.students} onViewed={handleActivitiesViewed} />
        </div>}
      </>}
    </div>
    {loading ? <div className="guardian-state">جارٍ تحميل بيانات الأبناء...</div> : error ? <div className="guardian-state guardian-error">{error}<button onClick={load}>إعادة المحاولة</button></div> : !children.length ? <div className="guardian-state">لا يوجد أبناء مرتبطون بحسابك حاليًا. يرجى مراجعة إدارة المنظومة.</div> : activeSection === "children" ? <>
      <section className="guardian-child-picker" id="guardian-child-picker"><div><small>ملفات الأبناء</small><h2>اختر ملف الابن</h2></div><div className="guardian-child-tabs">{children.map(({student})=><button key={student.id} className={student.id===selectedId?"active":""} onClick={()=>setSelectedId(student.id)}>{fullName(student)}</button>)}</div></section>
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
