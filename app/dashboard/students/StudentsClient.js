"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

async function request(url, options = {}) {
  const response = await fetch(url, { ...options, cache: "no-store" });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "تعذر تنفيذ الطلب.");
  return result;
}

const emptyForm = {
  id: "", first_name: "", middle_name: "", last_name: "",
  birth_date: "", gender: "", notes: "", guardian_id: "", class_id: "",
};

export default function StudentsClient({ profile }) {
  const isPlatformSupervisor = profile?.role === "platform_supervisor";
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [guardians, setGuardians] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [studentData, options] = await Promise.all([
        request("/api/students"),
        request("/api/students/options"),
      ]);
      setStudents(Array.isArray(studentData.students) ? studentData.students : []);
      setClasses(Array.isArray(options.classes) ? options.classes : []);
      setGuardians(Array.isArray(options.guardians) ? options.guardians : []);
    } catch (err) {
      setError(err.message || "تعذر تحميل بيانات الطلاب.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return students;
    return students.filter(student => {
      const name = [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ").toLowerCase();
      return name.includes(query) ||
        (student.guardian?.full_name || "").toLowerCase().includes(query) ||
        (student.guardian?.username || "").toLowerCase().includes(query);
    });
  }, [students, search]);

  function studentName(student) {
    return [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ") || "اسم غير مضاف";
  }

  function formatDate(value) {
    if (!value) return "غير محدد";
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? "غير محدد" : new Intl.DateTimeFormat("ar", {
      day: "2-digit", month: "2-digit", year: "numeric",
    }).format(date);
  }

  function openEdit(student) {
    setForm({
      id: student.id,
      first_name: student.first_name || "",
      middle_name: student.middle_name || "",
      last_name: student.last_name || "",
      birth_date: student.birth_date || "",
      gender: student.gender || "",
      notes: student.notes || "",
      guardian_id: student.guardian_id || "",
      class_id: student.current_enrollment?.class_id || "",
    });
    setError("");
    setNotice("");
    setEditing(true);
  }

  async function saveStudent(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await request("/api/students", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setEditing(false);
      setNotice("تم حفظ تعديلات الطالب بنجاح.");
      await loadStudents();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteStudent(student) {
    const confirmed = window.confirm(
      `هل تريد حذف حساب الطالب «${studentName(student)}»؟ إذا كان لديه سجل تعليمي فسيتم أرشفته وإيقافه مع الاحتفاظ بسجلاته.`
    );
    if (!confirmed) return;
    setError("");
    setNotice("");
    try {
      const result = await request(`/api/students?id=${encodeURIComponent(student.id)}`, { method: "DELETE" });
      setNotice(result.message || "تم تنفيذ العملية.");
      await loadStudents();
    } catch (err) {
      setError(err.message);
    }
  }

  const roleName = {
    admin: "مدير النظام",
    supervisor: "مشرف النظام",
    platform_supervisor: "مشرف المنصة",
  }[profile?.role] || "مستخدم";

  return (
    <main className="students-page" dir="rtl">
      <header className="students-header">
        <a href="/dashboard" className="students-back">العودة إلى لوحة التحكم</a>
        <div className="students-header-user"><strong>{profile.full_name}</strong><span>{roleName}</span></div>
      </header>

      <div className="students-content">
        <section className="students-heading">
          <div>
            <span className="students-eyebrow">منظومة عَون الإدارية</span>
            <h1>إدارة الطلاب</h1>
            <p>إدارة بيانات الطلاب وأولياء أمورهم والحلقات المسجلين فيها.</p>
          </div>
          {!isPlatformSupervisor && <a href="/dashboard/students/new" className="students-add-button">إضافة طالب جديد</a>}
        </section>

        {isPlatformSupervisor && <div className="students-message">حساب مشرف المنصة مخصص للمشاهدة والبحث فقط، دون إضافة أو تعديل أو حذف.</div>}
        {notice && <div className="students-message students-success">{notice}</div>}
        {error && <div className="students-message students-error">{error}</div>}

        <section className="students-summary">
          <div className="students-summary-card"><span>إجمالي الطلاب</span><strong>{students.length}</strong></div>
          <div className="students-summary-card"><span>الطلاب النشطون</span><strong>{students.filter(s => s.is_active).length}</strong></div>
          <div className="students-summary-card"><span>الطلاب غير النشطين</span><strong>{students.filter(s => !s.is_active).length}</strong></div>
        </section>

        <section className="students-list-section">
          <div className="students-list-heading">
            <div><h2>قائمة الطلاب</h2><p>ابحث بالاسم أو اسم ولي الأمر أو اسم المستخدم.</p></div>
            <button type="button" className="students-refresh-button" onClick={loadStudents} disabled={loading}>{loading ? "جارٍ التحديث..." : "تحديث البيانات"}</button>
          </div>
          <div className="students-search">
            <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث عن طالب أو ولي أمر..." aria-label="البحث عن طالب" />
          </div>

          {loading && <div className="students-message">جارٍ تحميل بيانات الطلاب...</div>}
          {!loading && !filteredStudents.length && <div className="students-empty"><h3>{students.length ? "لم يتم العثور على نتائج" : "لا يوجد طلاب مسجلون حتى الآن"}</h3><p>{students.length ? "جرّب عبارة بحث أخرى." : "يمكنك إضافة طالب حتى لو لم تتوفر جميع بياناته بعد."}</p></div>}

          {!loading && filteredStudents.length > 0 && (
            <div className="students-table-wrapper">
              <table className="students-table">
                <thead><tr><th>اسم الطالب</th><th>تاريخ الميلاد</th><th>ولي الأمر</th><th>الحلقة الحالية</th><th>الحالة</th><th>السجل</th>{!isPlatformSupervisor && <th>الإجراءات</th>}</tr></thead>
                <tbody>
                  {filteredStudents.map(student => (
                    <tr key={student.id}>
                      <td className="students-name-cell">{studentName(student)}</td>
                      <td>{formatDate(student.birth_date)}</td>
                      <td><div className="guardian-table-info"><strong>{student.guardian?.full_name || "غير مرتبط"}</strong><span>{student.guardian?.username ? `اسم المستخدم: ${student.guardian.username}` : "لا يوجد حساب ولي أمر"}</span></div></td>
                      <td>{student.current_enrollment?.class?.name || "غير مسجل في حلقة"}</td>
                      <td><span className={student.is_active ? "student-status active" : "student-status inactive"}>{student.is_active ? "نشط" : "غير نشط"}</span></td>
                      <td><a href={`/dashboard/educational-records?student=${encodeURIComponent(student.id)}`} className="students-details-link">السجل التعليمي</a></td>
                      {!isPlatformSupervisor && <td><div className="student-row-actions"><button type="button" onClick={() => openEdit(student)}>تعديل</button><button type="button" className="student-delete-button" onClick={() => deleteStudent(student)}>حذف</button></div></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <footer className="students-footer">منظومة عَون الإدارية - مسجد التراحم</footer>
      </div>

      {editing && (
        <div className="student-edit-overlay" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setEditing(false); }}>
          <form className="student-edit-modal" onSubmit={saveStudent}>
            <div className="student-edit-heading"><div><span>إدارة الطلاب</span><h2>تعديل بيانات الطالب</h2><p>جميع الحقول اختيارية، ويمكن استكمالها لاحقًا.</p></div><button type="button" onClick={() => setEditing(false)} aria-label="إغلاق">×</button></div>
            <div className="student-edit-grid">
              <label>الاسم الأول<input value={form.first_name} onChange={e => setForm(f => ({...f, first_name:e.target.value}))} /></label>
              <label>الاسم الأوسط<input value={form.middle_name} onChange={e => setForm(f => ({...f, middle_name:e.target.value}))} /></label>
              <label>اسم العائلة<input value={form.last_name} onChange={e => setForm(f => ({...f, last_name:e.target.value}))} /></label>
              <label>تاريخ الميلاد<input type="date" value={form.birth_date} onChange={e => setForm(f => ({...f, birth_date:e.target.value}))} /></label>
              <label>الجنس<select value={form.gender} onChange={e => setForm(f => ({...f, gender:e.target.value}))}><option value="">غير محدد</option><option value="male">ذكر</option><option value="female">أنثى</option></select></label>
              <label>الحلقة<select value={form.class_id} onChange={e => setForm(f => ({...f, class_id:e.target.value}))}><option value="">غير مسجل في حلقة</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <label>ولي الأمر<select value={form.guardian_id} onChange={e => setForm(f => ({...f, guardian_id:e.target.value}))}><option value="">بدون ولي أمر حاليًا</option>{guardians.map(g => <option key={g.id} value={g.id}>{g.full_name} — {g.username}</option>)}</select></label>
              <label className="student-edit-notes">ملاحظات إضافية<textarea rows="3" value={form.notes} onChange={e => setForm(f => ({...f, notes:e.target.value}))} /></label>
            </div>
            {error && <div className="students-message students-error">{error}</div>}
            <div className="student-edit-actions"><button type="submit" disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ التعديلات"}</button><button type="button" className="student-edit-cancel" onClick={() => setEditing(false)}>إلغاء</button></div>
          </form>
        </div>
      )}
    </main>
  );
}
