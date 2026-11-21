"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export default function ClassesClient({ profile }) {
  const [classes, setClasses] = useState([]);
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

    return classes.filter((item) =>
      `${item.name} ${item.description || ""}`
        .toLowerCase()
        .includes(term)
    );
  }, [classes, search]);

  function resetForm() {
    setEditingId(null);
    setForm({
      name: "",
      description: "",
    });
  }

  function startEdit(item) {
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

  const activeCount = classes.filter(
    (item) => item.is_active
  ).length;

  const inactiveCount = classes.length - activeCount;

  return (
    <main className="classes-page" dir="rtl">
      <header className="classes-header">
        <a href="/dashboard" className="classes-back">
          العودة إلى لوحة التحكم
        </a>

        <div className="classes-header-user">
          <strong>{profile.full_name}</strong>
          <span>
            {profile.role === "admin" ? "مدير النظام" : "المشرف"}
          </span>
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
              إضافة الحلقات وتنظيم بياناتها ومتابعة أعداد
              الطلاب والمعلمين المرتبطين بها.
            </p>
          </div>
        </div>

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

        <section className="classes-form-section">
          <div className="classes-section-heading">
            <h2>
              {editingId ? "تعديل بيانات الحلقة" : "إضافة حلقة جديدة"}
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

          {notice && (
            <p className="classes-notice" role="status">
              {notice}
            </p>
          )}

          {error && (
            <p className="classes-error" role="alert">
              {error}
            </p>
          )}
        </section>

        <section className="classes-list-section">
          <div className="classes-list-heading">
            <div>
              <h2>الحلقات المسجلة</h2>
              <p>
                يمكن تعديل اسم الحلقة ووصفها. إدارة المعلمين
                وتوزيع الأيام ستكون في المرحلة التالية.
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
            placeholder="ابحث باسم الحلقة أو وصفها..."
            aria-label="البحث عن حلقة"
          />

          {loading ? (
            <div className="classes-empty">
              جارٍ تحميل الحلقات...
            </div>
          ) : filteredClasses.length === 0 ? (
            <div className="classes-empty">
              {search
                ? "لا توجد نتائج مطابقة للبحث."
                : "لا توجد حلقات مسجلة حتى الآن. أضف أول حلقة من النموذج أعلاه."}
            </div>
          ) : (
            <div className="classes-table-wrap">
              <table className="classes-table">
                <thead>
                  <tr>
                    <th>اسم الحلقة</th>
                    <th>عدد الطلاب</th>
                    <th>المعلمون</th>
                    <th>الحالة</th>
                    <th>الإجراءات</th>
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

                      <td>{item.student_count}</td>

                      <td>
                        {item.teachers?.length
                          ? item.teachers
                              .map(
                                (assignment) =>
                                  assignment.teacher?.full_name ||
                                  "معلم غير معروف"
                              )
                              .join("، ")
                          : "لم يُسند معلم بعد"}
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

                      <td>
                        <div className="classes-row-actions">
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
