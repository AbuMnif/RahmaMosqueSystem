"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const MAX_ATTEMPTS = 3;

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchWithRetry(url, options = {}) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        cache: "no-store",
      });

      let result;

      try {
        result = await response.json();
      } catch {
        throw new Error("استجابة الخادم غير صالحة.");
      }

      if (response.ok) {
        return result;
      }

      const error = new Error(
        result?.error || `حدث خطأ في الطلب (${response.status}).`
      );

      error.status = response.status;

      // أخطاء الصلاحيات والبيانات والطلبات غير الصحيحة
      // لا تستفيد عادةً من إعادة المحاولة.
      if (
        response.status >= 400 &&
        response.status < 500 &&
        response.status !== 408 &&
        response.status !== 429
      ) {
        throw error;
      }

      lastError = error;
    } catch (error) {
      lastError = error;

      // لا نكرر أخطاء HTTP الدائمة مثل 401 و403 و404.
      if (
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 408 &&
        error.status !== 429
      ) {
        throw error;
      }
    }

    if (attempt < MAX_ATTEMPTS) {
      await wait(attempt * 1000);
    }
  }

  throw lastError || new Error("تعذر الاتصال بالخادم بعد عدة محاولات.");
}

export default function StudentsClient({ profile }) {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await fetchWithRetry("/api/students", {
        method: "GET",
      });

      setStudents(Array.isArray(result.students) ? result.students : []);
    } catch (err) {
      setError(
        err.message || "تعذر تحميل بيانات الطلاب بعد ثلاث محاولات."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return students;

    return students.filter((student) => {
      const fullName = [
        student.first_name,
        student.middle_name,
        student.last_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const guardianName =
        student.guardian?.full_name?.toLowerCase() || "";

      return fullName.includes(query) || guardianName.includes(query);
    });
  }, [students, search]);

  function getStudentName(student) {
    return [
      student.first_name,
      student.middle_name,
      student.last_name,
    ]
      .filter(Boolean)
      .join(" ");
  }

  function getCurrentClass(student) {
    return student.current_enrollment?.class?.name || "غير مسجل في حلقة";
  }

  function formatDate(date) {
    if (!date) return "غير محدد";

    const parsedDate = new Date(`${date}T00:00:00`);

    if (Number.isNaN(parsedDate.getTime())) {
      return "غير محدد";
    }

    return new Intl.DateTimeFormat("ar", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(parsedDate);
  }

  return (
    <main className="students-page" dir="rtl">
      <header className="students-header">
        <a href="/dashboard" className="students-back">
          العودة إلى لوحة التحكم
        </a>

        <div className="students-header-user">
          <strong>{profile.full_name}</strong>
          <span>
            {profile.role === "admin" ? "مدير النظام" : "مشرف النظام"}
          </span>
        </div>
      </header>

      <div className="students-content">
        <section className="students-heading">
          <div>
            <span className="students-eyebrow">
              منظومة رحَمة الإدارية
            </span>

            <h1>إدارة الطلاب</h1>

            <p>
              إدارة بيانات الطلاب وأولياء أمورهم والحلقات المسجلين فيها.
            </p>
          </div>

          <a
            href="/dashboard/students/new"
            className="students-add-button"
          >
            إضافة طالب جديد
          </a>
        </section>

        <section className="students-summary">
          <div className="students-summary-card">
            <span>إجمالي الطلاب</span>
            <strong>{students.length}</strong>
          </div>

          <div className="students-summary-card">
            <span>الطلاب النشطون</span>
            <strong>
              {students.filter((student) => student.is_active).length}
            </strong>
          </div>

          <div className="students-summary-card">
            <span>الطلاب غير النشطين</span>
            <strong>
              {students.filter((student) => !student.is_active).length}
            </strong>
          </div>
        </section>

        <section className="students-list-section">
          <div className="students-list-heading">
            <div>
              <h2>قائمة الطلاب</h2>
              <p>ابحث عن الطالب بالاسم أو باسم ولي الأمر.</p>
            </div>

            <button
              type="button"
              className="students-refresh-button"
              onClick={loadStudents}
              disabled={loading}
            >
              {loading ? "جارٍ التحديث..." : "تحديث البيانات"}
            </button>
          </div>

          <div className="students-search">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ابحث عن اسم الطالب أو ولي الأمر..."
              aria-label="البحث عن طالب"
            />
          </div>

          {error && (
            <div className="students-message students-error">
              <p>{error}</p>

              <button type="button" onClick={loadStudents}>
                إعادة المحاولة
              </button>
            </div>
          )}

          {loading && (
            <div className="students-message">
              جارٍ تحميل بيانات الطلاب...
            </div>
          )}

          {!loading && !error && filteredStudents.length === 0 && (
            <div className="students-empty">
              <h3>
                {students.length === 0
                  ? "لا يوجد طلاب مسجلون حتى الآن"
                  : "لم يتم العثور على نتائج"}
              </h3>

              <p>
                {students.length === 0
                  ? "يمكنك البدء بإضافة الطلاب إلى المنظومة."
                  : "تأكد من كتابة الاسم بشكل صحيح وحاول مرة أخرى."}
              </p>
            </div>
          )}

          {!loading && !error && filteredStudents.length > 0 && (
            <div className="students-table-wrapper">
              <table className="students-table">
                <thead>
                  <tr>
                    <th>اسم الطالب</th>
                    <th>تاريخ الميلاد</th>
                    <th>ولي الأمر</th>
                    <th>الحلقة الحالية</th>
                    <th>الحالة</th>
                    <th>التفاصيل</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredStudents.map((student) => (
                    <tr key={student.id}>
                      <td className="students-name-cell">
                        {getStudentName(student)}
                      </td>

                      <td>{formatDate(student.birth_date)}</td>

                      <td>
                        {student.guardian?.full_name || "غير محدد"}
                      </td>

                      <td>{getCurrentClass(student)}</td>

                      <td>
                        <span
                          className={
                            student.is_active
                              ? "student-status active"
                              : "student-status inactive"
                          }
                        >
                          {student.is_active ? "نشط" : "غير نشط"}
                        </span>
                      </td>

                      <td>
                        <a
                          href={`/dashboard/students/${student.id}`}
                          className="students-details-link"
                        >
                          عرض الملف
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="students-footer">
          منظومة رحَمة الإدارية - مسجد التراحم
        </footer>
      </div>
    </main>
  );
}
