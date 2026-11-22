"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export default function ClassesClient({ profile }) {
  const isPlatformSupervisor =
    profile?.role === "platform_supervisor";

  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [assignmentModal, setAssignmentModal] = useState(null);
  const [assignmentForm, setAssignmentForm] = useState({ teacher_id: "", teaching_days: [] });
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
  });

  const loadClasses = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/classes", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "تعذر تحميل الحلقات.");
      }

      setClasses(result.classes || []);
      setTeachers(result.teachers || []);
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء تحميل الحلقات.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  const filteredClasses = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return classes;

    return classes.filter((item) => {
      const teacherNames = (item.teachers || [])
        .map((assignment) => assignment.teacher?.full_name || "")
        .join(" ");

      return `${item.name} ${item.description || ""} ${teacherNames}`
        .toLowerCase()
        .includes(term);
    });
  }, [classes, search]);

  function resetForm() {
    setEditingId(null);
    setForm({
      name: "",
      description: "",
    });
  }

  function startEdit(item) {
    if (isPlatformSupervisor) return;

    setEditingId(item.id);

    setForm({
      name: item.name || "",
      description: item.description || "",
    });

    setNotice("");
    setError("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function submitForm(event) {
    event.preventDefault();

    if (isPlatformSupervisor) {
      setError("حساب مشرف المنصة مخصص للمشاهدة فقط.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/classes", {
        method: editingId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          editingId
            ? { id: editingId, ...form }
            : form
        ),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "تعذر حفظ الحلقة.");
      }

      setNotice(
        editingId
          ? "تم تحديث بيانات الحلقة بنجاح."
          : "تمت إضافة الحلقة بنجاح."
      );

      resetForm();
      await loadClasses();
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء حفظ الحلقة.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleClass(item) {
    if (isPlatformSupervisor) return;

    const nextState = !item.is_active;

    const confirmed = window.confirm(
      nextState
        ? "هل تريد تفعيل هذه الحلقة؟"
        : "هل تريد إيقاف هذه الحلقة؟ سيبقى سجل الطلاب محفوظًا."
    );

    if (!confirmed) return;

    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/classes", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: item.id,
          is_active: nextState,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "تعذر تغيير حالة الحلقة.");
      }

      setNotice(
        nextState
          ? "تم تفعيل الحلقة."
          : "تم إيقاف الحلقة، مع الاحتفاظ ببياناتها وسجلات الطلاب."
      );

      await loadClasses();
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء تغيير حالة الحلقة.");
    }
  }


  const weekDays = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];

  function openAssignment(item, assignment = null) {
    if (isPlatformSupervisor) return;
    setAssignmentModal({ classId: item.id, className: item.name, assignmentId: assignment?.id || null });
    setAssignmentForm({ teacher_id: assignment?.teacher_id || "", teaching_days: assignment?.teaching_days || [] });
    setError("");
    setNotice("");
  }

  function toggleTeachingDay(day) {
    setAssignmentForm(current => ({
      ...current,
      teaching_days: current.teaching_days.includes(day)
        ? current.teaching_days.filter(value => value !== day)
        : [...current.teaching_days, day],
    }));
  }

  async function submitAssignment(event) {
    event.preventDefault();
    if (!assignmentModal) return;
    setAssignmentSaving(true);
    setError("");
    setNotice("");
    try {
      const editing = Boolean(assignmentModal.assignmentId);
      const response = await fetch("/api/classes", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing
          ? { action: "update_assignment", assignment_id: assignmentModal.assignmentId, teaching_days: assignmentForm.teaching_days }
          : { action: "assign_teacher", class_id: assignmentModal.classId, teacher_id: assignmentForm.teacher_id, teaching_days: assignmentForm.teaching_days }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "تعذر حفظ إسناد المعلم.");
      setAssignmentModal(null);
      setNotice(editing ? "تم تحديث إسناد المعلم وأيام التدريس." : "تم إسناد المعلم إلى الحلقة بنجاح.");
      await loadClasses();
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء حفظ الإسناد.");
    } finally {
      setAssignmentSaving(false);
    }
  }

  async function removeAssignment(assignment) {
    if (!window.confirm("هل تريد إلغاء إسناد هذا المعلم من الحلقة؟")) return;
    try {
      const response = await fetch(`/api/classes?assignment_id=${encodeURIComponent(assignment.id)}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "تعذر إلغاء الإسناد.");
      setNotice("تم إلغاء إسناد المعلم.");
      await loadClasses();
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء إلغاء الإسناد.");
    }
  }

  const activeCount = classes.filter(
    (item) => item.is_active
  ).length;

  const inactiveCount = classes.length - activeCount;

  const roleName = {
    admin: "مدير النظام",
    supervisor: "مشرف النظام",
    platform_supervisor: "مشرف المنصة",
  }[profile?.role] || "مستخدم";

  return (
    <main className="classes-page" dir="rtl">
      <header className="classes-header">
        <a href="/dashboard" className="classes-back">
          العودة إلى لوحة التحكم
        </a>

        <div className="classes-header-user">
          <strong>{profile.full_name}</strong>
          <span>{roleName}</span>
        </div>
      </header>

      <div className="classes-content">
        <div className="classes-heading">
          <div>
            <span className="classes-eyebrow">
              إدارة التعليم
            </span>

            <h1>إدارة الحلقات</h1>

            <p>
              عرض الحلقات وإدارة المعلمين وإسنادهم وتحديد أيام التدريس.
            </p>
          </div>
          {profile?.role === "admin" && <a className="classes-add-teacher-link" href="/dashboard/accounts?role=teacher">+ إنشاء حساب معلم</a>}
        </div>

        {isPlatformSupervisor && (
          <div className="classes-notice" role="status">
            حساب مشرف المنصة مخصص للمشاهدة فقط. يمكنك الاطلاع على
            بيانات الحلقات والمعلمين دون إضافة أو تعديل أو إيقاف أي حلقة.
          </div>
        )}

        <section className="classes-summary">
          <article>
            <span>إجمالي الحلقات</span>
            <strong>{classes.length}</strong>
          </article>

          <article>
            <span>الحلقات النشطة</span>
            <strong>{activeCount}</strong>
          </article>

          <article>
            <span>الحلقات غير النشطة</span>
            <strong>{inactiveCount}</strong>
          </article>
        </section>

        {!isPlatformSupervisor && (
          <section className="classes-form-section">
            <div className="classes-section-heading">
              <h2>
                {editingId
                  ? "تعديل بيانات الحلقة"
                  : "إضافة حلقة جديدة"}
              </h2>

              {editingId && (
                <button
                  type="button"
                  className="classes-cancel"
                  onClick={resetForm}
                >
                  إلغاء التعديل
                </button>
              )}
            </div>

            <form className="classes-form" onSubmit={submitForm}>
              <label>
                <span>اسم الحلقة</span>

                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  required
                  maxLength={100}
                  placeholder="مثال: حلقة القرآن الكريم"
                />
              </label>

              <label>
                <span>وصف الحلقة</span>

                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  rows={3}
                  maxLength={500}
                  placeholder="وصف مختصر للحلقة (اختياري)"
                />
              </label>

              <div className="classes-form-actions">
                <button type="submit" disabled={saving}>
                  {saving
                    ? "جارٍ الحفظ..."
                    : editingId
                      ? "حفظ التعديلات"
                      : "إضافة الحلقة"}
                </button>
              </div>
            </form>
          </section>
        )}

        {(notice || error) && (
          <div
            className={error ? "classes-error" : "classes-notice"}
            role={error ? "alert" : "status"}
          >
            {error || notice}
          </div>
        )}

        <section className="classes-list-section">
          <div className="classes-list-heading">
            <div>
              <h2>الحلقات المسجلة</h2>

              <p>
                يمكنك البحث باسم الحلقة أو وصفها أو اسم المعلم.
              </p>
            </div>

            <button
              type="button"
              onClick={loadClasses}
              disabled={loading}
              className="classes-refresh"
            >
              {loading ? "جارٍ التحديث..." : "تحديث القائمة"}
            </button>
          </div>

          <input
            className="classes-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث باسم الحلقة أو وصفها أو المعلم..."
            aria-label="البحث عن حلقة"
          />

          {loading ? (
            <div className="classes-empty">
              جارٍ تحميل الحلقات...
            </div>
          ) : error && classes.length === 0 ? (
            <div className="classes-empty">
              تعذر تحميل بيانات الحلقات.
            </div>
          ) : filteredClasses.length === 0 ? (
            <div className="classes-empty">
              {search
                ? "لا توجد نتائج مطابقة للبحث."
                : "لا توجد حلقات مسجلة حتى الآن."}
            </div>
          ) : (
            <div className="classes-table-wrap">
              <table className="classes-table">
                <thead>
                  <tr>
                    <th>اسم الحلقة</th>
                    <th>عدد الطلاب</th>
                    <th>المعلمون والإسناد وأيام التدريس</th>
                    <th>الحالة</th>

                    {!isPlatformSupervisor && (
                      <th>الإجراءات</th>
                    )}
                  </tr>
                </thead>

                <tbody>
                  {filteredClasses.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name}</strong>

                        {item.description && (
                          <small>{item.description}</small>
                        )}
                      </td>

                      <td>{item.student_count ?? 0}</td>

                      <td>
                        {item.teachers?.length ? (
                          <div className="classes-assignment-list">
                            {item.teachers.map((assignment) => (
                              <div className="classes-assignment-item" key={assignment.id}>
                                <strong>{assignment.teacher?.full_name || "معلم غير معروف"}</strong>
                                <span className="classes-assignment-label">مسند إلى الحلقة</span>
                                <small>
                                  <b>أيام التدريس:</b>{" "}
                                  {Array.isArray(assignment.teaching_days) && assignment.teaching_days.length
                                    ? assignment.teaching_days.join("، ")
                                    : "لم تحدد أيام التدريس"}
                                </small>
                                {!isPlatformSupervisor && <div className="classes-assignment-actions">
                                  <button type="button" onClick={() => openAssignment(item, assignment)}>تعديل الأيام</button>
                                  <button type="button" onClick={() => removeAssignment(assignment)}>إلغاء الإسناد</button>
                                </div>}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="classes-no-assignment">لم يُسند معلم لهذه الحلقة بعد</span>
                        )}
                      </td>

                      <td>
                        <span
                          className={
                            item.is_active
                              ? "classes-status-active"
                              : "classes-status-inactive"
                          }
                        >
                          {item.is_active ? "نشطة" : "غير نشطة"}
                        </span>
                      </td>

                      {!isPlatformSupervisor && (
                        <td>
                          <div className="classes-row-actions">
                            <button type="button" className="classes-assign" onClick={() => openAssignment(item)}>
                              + إسناد معلم
                            </button>
                            <button
                              type="button"
                              className="classes-edit"
                              onClick={() => startEdit(item)}
                            >
                              تعديل
                            </button>

                            <button
                              type="button"
                              className="classes-toggle"
                              onClick={() => toggleClass(item)}
                            >
                              {item.is_active ? "إيقاف" : "تفعيل"}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      {assignmentModal && <div className="classes-modal-backdrop" onClick={() => setAssignmentModal(null)}>
        <form className="classes-assignment-modal" onSubmit={submitAssignment} onClick={event => event.stopPropagation()}>
          <button type="button" className="classes-modal-close" onClick={() => setAssignmentModal(null)}>×</button>
          <span className="classes-eyebrow">إدارة الإسناد</span>
          <h2>{assignmentModal.assignmentId ? "تعديل أيام التدريس" : "إسناد معلم للحلقة"}</h2>
          <p className="classes-modal-class">{assignmentModal.className}</p>
          {!assignmentModal.assignmentId && <label className="classes-modal-label">المعلم
            <select required value={assignmentForm.teacher_id} onChange={event => setAssignmentForm(current => ({ ...current, teacher_id: event.target.value }))}>
              <option value="">اختر المعلم</option>
              {teachers.filter(teacher => teacher.is_active).map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>)}
            </select>
          </label>}
          <fieldset className="classes-days-fieldset"><legend>أيام التدريس</legend><div className="classes-days-grid">
            {weekDays.map(day => <label key={day} className={assignmentForm.teaching_days.includes(day) ? "selected" : ""}><input type="checkbox" checked={assignmentForm.teaching_days.includes(day)} onChange={() => toggleTeachingDay(day)} />{day}</label>)}
          </div></fieldset>
          {teachers.filter(teacher => teacher.is_active).length === 0 && !assignmentModal.assignmentId && <p className="classes-inline-warning">لا توجد حسابات معلمين نشطة. أنشئ حساب معلم أولًا من إدارة الحسابات.</p>}
          <button className="classes-assignment-submit" type="submit" disabled={assignmentSaving || (!assignmentModal.assignmentId && !teachers.some(teacher => teacher.is_active))}>{assignmentSaving ? "جارٍ الحفظ..." : "حفظ الإسناد"}</button>
        </form>
      </div>}
    </main>
  );
}
