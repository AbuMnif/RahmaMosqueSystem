"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" }).then(r => r.json()).then(data => {
      if (active && data.authenticated) router.replace("/dashboard");
    }).catch(() => {});
    return () => { active = false; };
  }, [router]);

  function removeWhitespace(value) {
    return value.replace(/\s+/g, "");
  }

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const cleanUsername = removeWhitespace(username);
    const cleanPassword = removeWhitespace(password);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: cleanUsername, password: cleanPassword }),
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "تعذر تسجيل الدخول");
        return;
      }

      router.replace(result.redirect || "/dashboard");
      router.refresh();
    } catch {
      setError("تعذر الاتصال بالخادم، حاول مرة أخرى");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page" dir="rtl">
      <section className="login-card">
        <h1>منظومة عَون الإدارية</h1>
        <p>مسجد التراحم</p>

        <form onSubmit={handleLogin}>
          <label htmlFor="username">اسم المستخدم</label>
          <input
            id="username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(removeWhitespace(event.target.value))}
            placeholder="أدخل اسم المستخدم"
            required
          />

          <label htmlFor="password">كلمة المرور</label>
          <div style={{ position: "relative", width: "100%" }}>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(removeWhitespace(event.target.value))}
              placeholder="أدخل كلمة المرور"
              required
              style={{ width: "100%", paddingRight: "48px", boxSizing: "border-box" }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(value => !value)}
              aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              aria-pressed={showPassword}
              title={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              style={{
                position: "absolute",
                right: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                width: "34px",
                height: "34px",
                padding: 0,
                border: 0,
                borderRadius: "50%",
                background: "transparent",
                color: "currentColor",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                boxShadow: "none",
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="21"
                height="21"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{ overflow: "visible" }}
              >
                <path
                  d="M2.2 12s3.5-6 9.8-6 9.8 6 9.8 6-3.5 6-9.8 6-9.8-6-9.8-6Z"
                  style={{ transformOrigin: "center", transition: "transform 220ms ease, opacity 180ms ease" }}
                />
                <circle
                  cx="12"
                  cy="12"
                  r="2.8"
                  style={{ transformOrigin: "center", transition: "transform 220ms ease" , transform: showPassword ? "scale(1.18)" : "scale(1)" }}
                />
                <path
                  d="M3 3 21 21"
                  style={{
                    opacity: showPassword ? 0 : 1,
                    transform: showPassword ? "scale(0.5)" : "scale(1)",
                    transformOrigin: "center",
                    transition: "opacity 180ms ease, transform 220ms ease",
                  }}
                />
              </svg>
            </button>
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? "جارٍ تسجيل الدخول..." : "تسجيل الدخول"}
          </button>
        </form>
      </section>
    </main>
  );
}
