"use client";

import Link from "next/link";
import { useState } from "react";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Ошибка входа");
        return;
      }
      window.location.href = "/admin";
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dark-grid min-h-screen grid place-items-center px-6 text-white">
      <form onSubmit={submit} className="dark-card w-full max-w-sm p-8">
        <Link href="/" className="text-lg font-extrabold tracking-[0.12em]">
          PPF <span className="accent">PROFI</span>
        </Link>
        <h1 className="mt-4 text-2xl font-extrabold">Вход администратора</h1>
        <p className="mt-2 text-sm text-white/50">
          Панель управления заявками и мастерами.
        </p>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Пароль"
          autoFocus
          required
          className="mt-6 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-lime-400 focus:outline-none focus:ring-1 focus:ring-lime-400"
        />

        {error && (
          <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-200">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !password}
          className="btn-accent mt-6 w-full justify-center disabled:opacity-50"
        >
          {loading ? "Проверяем..." : "Войти"}
        </button>
      </form>
    </div>
  );
}