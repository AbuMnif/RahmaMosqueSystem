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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: cleanUsername,
          password: cleanPassword,
        }),
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
          <div className="login-password-field">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(removeWhitespace(event.target.value))}
              placeholder="أدخل كلمة المرور"
              required
            />
            <button
              type="button"
              className="login-password-toggle"
              onClick={() => setShowPassword(value => !value)}
              aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              aria-pressed={showPassword}
            >
              {showPassword ? "إخفاء" : "إظهار"}
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
