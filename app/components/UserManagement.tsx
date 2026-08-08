"use client";

import { useEffect, useState } from "react";
import AppLoader from "./AppLoader";

type Account = {
  id: number; name: string; email: string; role: "Administrator" | "User";
  active: boolean; mustChangePassword: boolean; createdAt: string;
};

const date = (value: string) => new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));

export default function UserManagement({ currentUserId, search }: { currentUserId: number; search: string }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true); const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState(""); const [temporaryPassword, setTemporaryPassword] = useState<{ name: string; value: string } | null>(null);

  const load = async () => {
    setLoading(true); setError("");
    try { const response = await fetch("/api/admin/users"); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not load accounts."); setAccounts(result.users); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load accounts."); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/users").then(async (response) => {
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not load accounts.");
      if (!cancelled) setAccounts(result.users);
    }).catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load accounts."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const act = async (account: Account, payload: Record<string, unknown>) => {
    setSavingId(account.id); setError("");
    try {
      const response = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: account.id, ...payload }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not update account.");
      if (result.temporaryPassword) setTemporaryPassword({ name: account.name, value: result.temporaryPassword });
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update account."); }
    finally { setSavingId(null); }
  };

  const query = search.trim().toLowerCase();
  const filtered = accounts.filter((account) => `${account.name} ${account.email} ${account.role} ${account.active ? "active" : "inactive"}`.toLowerCase().includes(query));
  return <>
    {error && <div className="alert"><span>{error}</span><button onClick={() => setError("")}>×</button></div>}
    <section className="metric-grid admin-metrics">
      <Metric label="Total accounts" value={String(accounts.length)} detail="Across the workspace" icon="◎" tone="teal" />
      <Metric label="Active users" value={String(accounts.filter(a => a.active).length)} detail="Can currently sign in" icon="✓" tone="cyan" />
      <Metric label="Administrators" value={String(accounts.filter(a => a.role === "Administrator").length)} detail="Full system control" icon="★" tone="amber" />
      <Metric label="Password resets" value={String(accounts.filter(a => a.mustChangePassword).length)} detail="Change required on login" icon="!" tone="red" />
    </section>
    <section className="page-panel admin-users-panel">
      <div className="panel-header"><h2>User accounts ({filtered.length})</h2><span className="admin-note">Administrators can manage all account-owned records</span></div>
      {loading ? <AppLoader label="Loading user accounts" /> : <div className="table-wrap"><table><thead><tr><th>ACCOUNT</th><th>ROLE</th><th>STATUS</th><th>CREATED</th><th>ACTIONS</th></tr></thead><tbody>
        {filtered.map(account => <tr key={account.id}><td><div className="tenant-cell"><span className="avatar tiny">{account.name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase()}</span><div><strong>{account.name}{account.id === currentUserId ? " (You)" : ""}</strong><small>{account.email}</small></div></div></td>
          <td><select className="role-select" value={account.role} disabled={savingId === account.id || account.id === currentUserId} onChange={(event) => void act(account, { action: "setRole", role: event.target.value })}><option>Administrator</option><option>User</option></select></td>
          <td><span className={`status ${account.active ? "paid" : "neutral"}`}>{account.active ? "Active" : "Inactive"}</span>{account.mustChangePassword && <small className="table-sub">Password change required</small>}</td><td>{date(account.createdAt)}</td>
          <td><div className="row-actions admin-actions"><button disabled={savingId === account.id || account.id === currentUserId} onClick={() => void act(account, { action: "setActive", active: !account.active })}>{account.active ? "Deactivate" : "Activate"}</button>{account.id !== currentUserId && <button disabled={savingId === account.id} onClick={() => { if (window.confirm(`Issue a temporary password for ${account.name}? Their current sessions will be revoked.`)) void act(account, { action: "resetPassword" }); }}>Reset password</button>}{account.id !== currentUserId && <button className="danger-button" disabled={savingId === account.id} onClick={() => { if (window.confirm(`Permanently delete ${account.name} and all of their properties, bills and groceries? This cannot be undone.`)) void act(account, { action: "deleteUser" }); }}>Delete</button>}</div></td></tr>)}
      </tbody></table>{!filtered.length && <div className="empty"><strong>No accounts found</strong><p>Try a different search.</p></div>}</div>}
    </section>
    {temporaryPassword && <div className="modal-layer" role="dialog" aria-modal="true"><button className="modal-backdrop" onClick={() => setTemporaryPassword(null)} aria-label="Close" /><div className="modal-card password-result"><div className="modal-head"><div><span className="section-kicker">ONE-TIME CREDENTIAL</span><h2>Temporary password for {temporaryPassword.name}</h2></div><button className="close" onClick={() => setTemporaryPassword(null)}>×</button></div><div className="password-result-body"><p>Share this securely. It will not be shown again, and the user must replace it after signing in.</p><code>{temporaryPassword.value}</code><button className="primary full" onClick={() => void navigator.clipboard.writeText(temporaryPassword.value)}>Copy password</button></div></div></div>}
  </>;
}

function Metric({ label, value, detail, icon, tone }: { label: string; value: string; detail: string; icon: string; tone: string }) { return <article className="metric-card"><span className={`metric-icon ${tone}`}>{icon}</span><div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div></article>; }
