"use client";

import { FormEvent, useState } from "react";

type User = { id: number; name: string; email: string; role: "Administrator" | "User"; mustChangePassword: boolean };

export default function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (mode === "signup" && password !== String(form.get("confirmPassword") ?? "")) {
      setError("Passwords do not match."); setSaving(false); return;
    }
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.get("name"), email: form.get("email"), password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Authentication failed.");
      onAuthenticated(result.user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Authentication failed.");
    } finally { setSaving(false); }
  };

  return <main className="auth-page">
    <section className={`auth-story ${mode === "login" ? "signin-background" : "signup-background"}`} aria-label={mode === "login" ? "Sign in illustration" : "Sign up illustration"} />
    <section className="auth-card-wrap"><div className="auth-card">
      <span className="section-kicker">WELCOME TO RENTKHATA</span>
      <h2>{mode === "login" ? "Sign in to your account" : "Create your account"}</h2>
      <p>{mode === "login" ? "Continue managing your properties and groceries." : "Set up your private management workspace."}</p>
      {error && <div className="alert auth-alert" role="alert">{error}</div>}
      <form onSubmit={submit} className="auth-form">
        {mode === "signup" && <label className="field">Full name<input name="name" required minLength={2} maxLength={80} autoComplete="name" placeholder="Your name" /></label>}
        <label className="field">Email address<input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="you@example.com" /></label>
        <label className="field">Password<input name="password" type="password" required minLength={8} maxLength={128} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="At least 8 characters" /></label>
        {mode === "signup" && <label className="field">Confirm password<input name="confirmPassword" type="password" required minLength={8} maxLength={128} autoComplete="new-password" placeholder="Repeat your password" /></label>}
        <button className="primary full" disabled={saving}>{saving ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
      </form>
      <button className="auth-switch" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}>
        {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
      </button>
    </div></section>
  </main>;
}
