"use client";

import { FormEvent, useState } from "react";

type User = { id: number; name: string; email: string; role: "Administrator" | "User"; mustChangePassword: boolean };

export default function ChangePasswordScreen({ user, onChanged }: { user: User; onChanged: (user: User) => void }) {
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError(""); const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get("currentPassword") ?? ""); const newPassword = String(form.get("newPassword") ?? "");
    if (newPassword !== String(form.get("confirmPassword") ?? "")) { setError("New passwords do not match."); setSaving(false); return; }
    try {
      const response = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not change password."); onChanged(result.user);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not change password."); }
    finally { setSaving(false); }
  };
  return <main className="auth-page"><section className="auth-story"><div className="brand auth-brand"><span className="brand-mark">R</span><span>RentKhata</span></div><div><span className="section-kicker">SECURE YOUR ACCOUNT</span><h1>Choose your private password.</h1><p>This temporary-password step protects your administrator account before you access stored records.</p></div><div className="auth-points"><span>✓ Administrator access</span><span>✓ Existing data preserved</span><span>✓ Other sessions revoked</span></div></section>
    <section className="auth-card-wrap"><div className="auth-card"><span className="section-kicker">PASSWORD CHANGE REQUIRED</span><h2>Welcome, {user.name}</h2><p>Replace your temporary password before continuing.</p>{error && <div className="alert auth-alert">{error}</div>}<form className="auth-form" onSubmit={submit}><label className="field">Temporary password<input name="currentPassword" type="password" required autoComplete="current-password" /></label><label className="field">New password<input name="newPassword" type="password" required minLength={8} maxLength={128} autoComplete="new-password" /></label><label className="field">Confirm new password<input name="confirmPassword" type="password" required minLength={8} maxLength={128} autoComplete="new-password" /></label><button className="primary full" disabled={saving}>{saving ? "Updating…" : "Change password and continue"}</button></form></div></section></main>;
}
