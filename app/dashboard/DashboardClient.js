"use client";

import { useEffect, useState } from "react";
import { clearEducationalOfflineAccess } from "../../lib/educationalOfflineStore";

const roleNames = {
  admin: "مدير النظام",
  supervisor: "المشرف",
  platform_supervisor: "مشرف المنصة",
  teacher: "المعلم",
  guardian: "ولي الأمر",
};

const modules = {
  admin: [
    ["إدارة الطلاب", "إضافة الطلاب وتحديث بياناتهم وربطهم بأولياء أمورهم"],
    ["الحلقات والمعلمون", "تنظيم الحلقات وتوزيع المعلمين"],
    ["السجلات التعليمية", "الحضور والحفظ والمراجعة والاختبارات"],
    ["الأنشطة والموافقات", "إدارة الأنشطة وموافقات أولياء الأمور وتوقيعاتهم"],
    ["طلبات التعديل", "مراجعة طلبات المعلمين واعتمادها أو رفضها"],
    ["إدارة الحسابات", "حسابات المعلمين وأولياء الأمور والصلاحيات"],
  ],

  supervisor: [
    ["متابعة الطلاب", "متابعة بيانات الطلاب وسجلاتهم التعليمية"],
    ["طلبات التعديل", "مراجعة طلبات المعلمين واعتمادها أو رفضها"],
    ["الأنشطة والموافقات", "متابعة الأنشطة وموافقات أولياء الأمور"],
    ["التقارير", "متابعة الأداء والحضور والإنجاز"],
  ],

  platform_supervisor: [
    ["إدارة الطلاب", "مشاهدة جميع الطلاب وملفاتهم وبيانات أولياء أمورهم"],
    ["الحلقات والمعلمون", "مشاهدة الحلقات والمعلمين وتوزيعاتهم"],
    ["السجلات التعليمية", "الاطلاع على الحضور والحفظ والمراجعة والاختبارات"],
    ["الأنشطة والموافقات", "مشاهدة الأنشطة وموافقات أولياء الأمور"],
    ["طلبات التعديل", "مشاهدة طلبات التعديل وحالاتها"],
    ["إدارة الحسابات", "مشاهدة حسابات المعلمين وأولياء الأمور"],
    ["التقارير", "الاطلاع على التقارير ومؤشرات الأداء"],
  ],

  teacher: [
    ["السجل التعليمي", "إدارة الحضور والحفظ والمراجعة والاختبارات وملاحظات طلاب حلقاتك"],
    ["طلبات التعديل", "متابعة طلبات تعديل سجلاتك"],
  ],

  guardian: [
    ["أبنائي", "متابعة الحضور والحفظ والمراجعة والاختبارات وملاحظات المعلمين"],
    ["موافقات الأنشطة", "مراجعة تفاصيل الأنشطة والموافقة أو الرفض بالتوقيع"],
  ],
};

const moduleLinks = {
  "إدارة الطلاب": "/dashboard/students",
  "متابعة الطلاب": "/dashboard/students",
  "الحلقات والمعلمون": "/dashboard/classes",
  "السجلات التعليمية": "/dashboard/educational-records",
  "السجل التعليمي": "/dashboard/educational-records",
  "أبنائي": "/dashboard/guardian",
  "موافقات الأنشطة": "/dashboard/guardian",
  "إدارة الحسابات": "/dashboard/accounts",
  "الأنشطة والموافقات": "/dashboard/activities",
};

export default function DashboardClient({ profile }) {
  const [loggingOut, setLoggingOut] = useState(false);
  const [unreadActivities, setUnreadActivities] = useState(0);

  useEffect(() => {
    if (profile.role !== "guardian") return;
    let active = true;
    fetch("/api/guardian/activities", { cache: "no-store" })
      .then(r => r.json())
      .then(j => { if (active && j.success) setUnreadActivities(Number(j.unread_count) || 0); })
      .catch(() => {});
    return () => { active = false; };
  }, [profile.role]);

  const items = modules[profile.role] || [];
  const isPlatformSupervisor =
    profile.role === "platform_supervisor";

  async function logout() {
    setLoggingOut(true);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("logout_failed");
      }

      try {
        await clearEducationalOfflineAccess(profile.id);
        const cache = await caches.open("awn-educational-shell-v1");
        await cache.delete("/dashboard/educational-records");
      } catch (offlineCleanupError) {
        console.error("Could not revoke local educational access:", offlineCleanupError);
      }
      window.location.replace("/login");
    } catch {
      setLoggingOut(false);
      alert("تعذر تسجيل الخروج. حاول مرة أخرى.");
    }
  }

  return (
    <main className="dashboard-page" dir="rtl">
      <header className="dashboard-header">
        <a className="dashboard-brand" href="/">
          <img
            src="/images/mosque-logo.jpg"
            alt="شعار مسجد التراحم"
          />

          <span>
            <strong>منظومة عَون</strong>
            <small>مسجد التراحم</small>
          </span>
        </a>

        <div className="dashboard-user">
          <div className="user-avatar">
            {(profile.full_name || "م").trim().charAt(0)}
          </div>

          <div className="user-meta">
            <strong>{profile.full_name}</strong>
            <small>
              {roleNames[profile.role] || "مستخدم"}
            </small>
          </div>

          <button
            className="logout-button"
            onClick={logout}
            disabled={loggingOut}
          >
            {loggingOut ? "جارٍ الخروج..." : "تسجيل الخروج"}
          </button>
        </div>
      </header>

      <div className="dashboard-content">
        <section className="dashboard-welcome">
          <div>
            <span className="dashboard-kicker">
              مسجد التراحم
            </span>

            <h1>
              مرحبًا، {profile.full_name}
            </h1>

            <p>
              نسعد بوجودك في منظومة عَون الإدارية.
              اختر القسم الذي تريد الاطلاع عليه.
            </p>

            {isPlatformSupervisor && (
              <div
                style={{
                  marginTop: "18px",
                  padding: "13px 16px",
                  border: "1px solid #d9bd38",
                  borderRadius: "12px",
                  background: "#fffdf2",
                  color: "#66571b",
                  lineHeight: 1.8,
                }}
              >
                حسابك مخصص لمشاهدة بيانات المنظومة.
                يمكنك استعراض الأقسام وتجربة النماذج،
                لكن لن يُسمح بحفظ أي تغييرات دائمة.
              </div>
            )}
          </div>
        </section>

        <div className="section-title-row">
          <div>
            <span>مساحة العمل</span>
            <h2>الأقسام المتاحة</h2>
          </div>

          <span className="role-pill">
            {roleNames[profile.role] || "مستخدم"}
          </span>
        </div>

        <section className="module-grid">
          {items.map(([title, description]) => {
            const href = moduleLinks[title];
            const isAvailable = Boolean(href);

            return (
              <article
                className={`module-card ${
                  isAvailable ? "module-card-active" : ""
                }`}
                key={title}
              >
                <span className="module-status">
                  {isAvailable ? "متاح" : "قريبًا"}
                </span>

                <div className="module-card-title-row">
                  <h3>{title}</h3>
                  {profile.role === "guardian" && title === "موافقات الأنشطة" && unreadActivities > 0 && (
                    <span className="activity-unread-badge" aria-label={`${unreadActivities} أنشطة جديدة`}>
                      {unreadActivities > 99 ? "99+" : unreadActivities} جديد
                    </span>
                  )}
                </div>

                <p>{description}</p>

                <div className="module-card-bottom">
                  {isAvailable ? (
                    <a href={href}>
                      الدخول إلى القسم
                    </a>
                  ) : (
                    "سيتم تفعيل القسم ضمن مراحل البناء"
                  )}
                </div>
              </article>
            );
          })}
        </section>

        <footer className="dashboard-footer">
          منظومة عَون الإدارية - مسجد التراحم
        </footer>
      </div>
    </main>
  );
}
