"use client";

import { useEffect, useState } from "react";

const initialForm = {
  first_name: "",
  middle_name: "",
  last_name: "",
  birth_date: "",
  notes: "",
  class_id: "",
  guardian_mode: "new",
  guardian_id: "",
  guardian_name: "",
  username: "",
  password: "",
};

export default function NewStudentClient({ profile }) {
  const [form, setForm] = useState(initialForm);
  const [classes, setClasses] = useState([]);
  const [guardians, setGuardians] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    async function loadOptions() {
      try {
        const response = await fetch("/api/students/options", {
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "تعذر تحميل البيانات.");
        }

        setClasses(result.classes || []);
        setGuardians(result.guardians || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingOptions(false);
      }
    }

    loadOptions();
  }, []);

  function updateField(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function submitForm(event) {
    event.preventDefault();
    setError("");

    if (!form.class_id) {
      setError("يرجى اختيار الحلقة.");
      return;
    }

    if (
      form.guardian_mode === "new" &&
      (!form.guardian_name.trim() ||
        !form.username.trim() ||
        !form.password)
    ) {
      setError("يرجى إكمال بيانات حساب ولي الأمر.");
      return;
    }

    if (
      form.guardian_mode === "existing" &&
      !form.guardian_id
    ) {
      setError("يرجى اختيار ولي الأمر.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/students", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "تعذر تسجيل الطالب.");
      }

      setReceipt(result);

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function formatDate(value) {
    if (!value) return "غير محدد";

    const date = new Date(`${value}T00:00:00`);

    return new Intl.DateTimeFormat("ar", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  }

  function printReceipt() {
    window.print();
  }

  function startNewStudent() {
    setReceipt(null);
    setForm(initialForm);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const studentName = receipt
    ? [
        receipt.student.first_name,
        receipt.student.middle_name,
        receipt.student.last_name,
      ]
        .filter(Boolean)
        .join(" ")
    : "";

  if (loadingOptions) {
    return (
      <main className="new-student-page" dir="rtl">
        <div className="new-student-loading">
          جارٍ تحميل بيانات الحلقات...
        </div>
      </main>
    );
  }

  return (
    <main className="new-student-page" dir="rtl">
      <header className="new-student-header no-print">
        <a href="/dashboard/students">العودة إلى إدارة الطلاب</a>

        <div>
          <strong>{profile.full_name}</strong>
          <span>
            {profile.role === "admin" ? "مدير النظام" : "مشرف النظام"}
          </span>
        </div>
      </header>

      <div className="new-student-content">
        {!receipt ? (
          <>
            <div className="new-student-heading no-print">
              <span>منظومة رحَمة الإدارية</span>
              <h1>تسجيل طالب جديد</h1>
              <p>
                أدخل بيانات الطالب وولي الأمر والحلقة لإتمام التسجيل.
              </p>
            </div>

            <form
              className="new-student-form no-print"
              onSubmit={submitForm}
            >
              <section className="new-student-section">
                <h2>بيانات الطالب</h2>

                <div className="new-student-grid">
                  <label>
                    الاسم الأول
                    <input
                      name="first_name"
                      value={form.first_name}
                      onChange={updateField}
                      required
                    />
                  </label>

                  <label>
                    الاسم الأوسط
                    <input
                      name="middle_name"
                      value={form.middle_name}
                      onChange={updateField}
                    />
                  </label>

                  <label>
                    اسم العائلة
                    <input
                      name="last_name"
                      value={form.last_name}
                      onChange={updateField}
                      required
                    />
                  </label>

                  <label>
                    تاريخ الميلاد
                    <input
                      type="date"
                      name="birth_date"
                      value={form.birth_date}
                      onChange={updateField}
                    />
                  </label>

                  <label>
                    الجنس
                    <input value="ذكر" disabled />
                  </label>

                  <label>
                    الحلقة
                    <select
                      name="class_id"
                      value={form.class_id}
                      onChange={updateField}
                      required
                    >
                      <option value="">اختر الحلقة</option>
                      {classes.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="new-student-full-field">
                  ملاحظات إضافية
                  <textarea
                    name="notes"
                    value={form.notes}
                    onChange={updateField}
                    rows="3"
                  />
                </label>
              </section>

              <section className="new-student-section">
                <h2>حساب ولي الأمر</h2>

                <div className="guardian-mode-options">
                  <label>
                    <input
                      type="radio"
                      name="guardian_mode"
                      value="new"
                      checked={form.guardian_mode === "new"}
                      onChange={updateField}
                    />
                    إنشاء حساب جديد
                  </label>

                  <label>
                    <input
                      type="radio"
                      name="guardian_mode"
                      value="existing"
                      checked={form.guardian_mode === "existing"}
                      onChange={updateField}
                    />
                    ربط بولي أمر موجود
                  </label>
                </div>

                {form.guardian_mode === "new" ? (
                  <div className="new-student-grid">
                    <label>
                      اسم ولي الأمر
                      <input
                        name="guardian_name"
                        value={form.guardian_name}
                        onChange={updateField}
                        required
                      />
                    </label>

                    <label>
                      اسم المستخدم
                      <input
                        name="username"
                        value={form.username}
                        onChange={updateField}
                        autoComplete="off"
                        required
                      />
                    </label>

                    <label>
                          كلمة المرور
                      <input
                        type="password"
                        name="password"
                        value={form.password}
                        onChange={updateField}
                        autoComplete="new-password"
                        minLength="8"
                        required
                      />
                    </label>
                  </div>
                ) : (
                  <label className="new-student-full-field">
                    اختيار ولي الأمر
                    <select
                      name="guardian_id"
                      value={form.guardian_id}
                      onChange={updateField}
                      required
                    >
                      <option value="">اختر ولي الأمر</option>

                      {guardians.map((guardian) => (
                        <option key={guardian.id} value={guardian.id}>
                          {guardian.full_name} — {guardian.username}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </section>

              {error && (
                <div className="new-student-error">{error}</div>
              )}

              <div className="new-student-actions">
                <button type="submit" disabled={saving}>
                  {saving ? "جارٍ تسجيل الطالب..." : "إتمام تسجيل الطالب"}
                </button>

                <a href="/dashboard/students">إلغاء</a>
              </div>
            </form>
          </>
        ) : (
          <section className="registration-result">
            <div className="registration-success no-print">
              <h1>تم تسجيل الطالب بنجاح</h1>
              <p>
                تم إنشاء بيانات التسجيل وربط الطالب بولي الأمر والحلقة.
              </p>
            </div>

            <article className="registration-card">
              <div className="registration-card-top">
                <img
                  src="/images/mosque-logo.jpg"
                  alt="شعار مسجد التراحم"
                />

                <div>
                  <h1>مسجد التراحم</h1>
                  <p>منظومة رحَمة الإدارية</p>
                  <strong>بطاقة تسجيل طالب</strong>
                </div>

                <div className="registration-card-number">
                  <span>تاريخ التسجيل</span>
                  <strong>{formatDate(receipt.registration_date)}</strong>
                </div>
              </div>

              <div className="registration-card-divider" />

              <section className="registration-card-section">
                <h2>بيانات الطالب</h2>

                <div className="registration-data-grid">
                  <div>
                    <span>اسم الطالب</span>
                    <strong>{studentName}</strong>
                  </div>

                  <div>
                    <span>تاريخ الميلاد</span>
                    <strong>{formatDate(receipt.student.birth_date)}</strong>
                  </div>

                  <div>
                    <span>الجنس</span>
                    <strong>ذكر</strong>
                  </div>

                  <div>
                    <span>الحلقة المسجل فيها</span>
                    <strong>{receipt.class.name}</strong>
                  </div>

                  <div>
                    <span>المعلم المسؤول</span>
                    <strong>
                      {receipt.teacher_names?.length
                        ? receipt.teacher_names.join("، ")
                        : "يراجع إدارة المسجد"}
                    </strong>
                  </div>
                </div>
              </section>

              <section className="registration-card-section">
                <h2>بيانات ولي الأمر والحساب</h2>

                <div className="registration-data-grid">
                  <div>
                    <span>اسم ولي الأمر</span>
                    <strong>{receipt.guardian.full_name}</strong>
                  </div>

                  <div>
                    <span>اسم المستخدم</span>
                    <strong dir="ltr">{receipt.guardian.username}</strong>
                  </div>

                  <div className="registration-password">
                    <span>كلمة المرور الأولية</span>
                    <strong dir="ltr">
                      {receipt.initial_password ||
                        "الحساب موجود مسبقًا — استخدم كلمة المرور الحالية"}
                    </strong>
                  </div>
                </div>

                <p className="registration-account-note">
                  {receipt.guardian.is_new
                    ? "يرجى تسليم بيانات الدخول لولي الأمر والاحتفاظ بها في مكان آمن."
                    : "تم ربط الطالب بحساب ولي الأمر الموجود، ولم يتم تغيير كلمة المرور."}
                </p>
              </section>

              <section className="registration-platform-description">
                <h2>عن منظومة رحَمة الإدارية</h2>
                <p>
                  تتيح المنظومة لولي الأمر متابعة أبنائه والاطلاع على
                  الحضور والغياب، والحفظ الجديد والمراجعة، ونتائج
                  الاختبارات، وتقييمات المعلمين وملاحظاتهم، بما يساعد
                  على متابعة المسيرة القرآنية والتعليمية للطالب.
                </p>
              </section>

              <div className="registration-card-bottom">
                <div>
                  <strong>إدارة مسجد التراحم</strong>
                  <span>نسأل الله أن يجعل القرآن ربيع قلبه ونور صدره.</span>
                </div>

                <img
                  src="/images/mosque-stamp.JPG"
                  alt="الختم الإلكتروني لمسجد التراحم"
                />
              </div>

              <div className="registration-card-footer">
                منظومة رحَمة الإدارية — مسجد التراحم
              </div>
            </article>

            <div className="registration-actions no-print">
              <button type="button" onClick={printReceipt}>
                طباعة البطاقة أو حفظها PDF
              </button>

              <button
                type="button"
                className="registration-secondary-button"
                onClick={startNewStudent}
              >
                تسجيل طالب آخر
              </button>

              <a href="/dashboard/students">
                العودة إلى قائمة الطلاب
              </a>
            </div>

            <p className="registration-security-note no-print">
              احتفظ بنسخة البطاقة وسلم بيانات الدخول لولي الأمر.
              لن يمكن استرجاع كلمة المرور بعد مغادرة هذه الصفحة.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
