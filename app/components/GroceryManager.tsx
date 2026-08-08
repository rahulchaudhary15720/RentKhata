"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Item = { id: number; name: string; category: string; unit: string; quantity: number; minimumStock: number; unitPrice: number; expiryDate: string | null; notes: string; updatedAt: string };
type Transaction = { id: number; itemId: number; type: "Stock in" | "Stock out" | "Correction"; quantityChange: number; note: string; createdAt: string };
type Data = { items: Item[]; transactions: Transaction[] };
type Dialog = "item" | "stock" | null;

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
const date = (value: string) => new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value.includes("T") ? value : `${value}T00:00:00`));

export default function GroceryManager({ search }: { search: string }) {
  const [data, setData] = useState<Data>({ items: [], transactions: [] });
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [error, setError] = useState(""); const [toast, setToast] = useState("");
  const [tab, setTab] = useState<"inventory" | "history">("inventory");
  const [filter, setFilter] = useState("All"); const [dialog, setDialog] = useState<Dialog>(null);
  const [editing, setEditing] = useState<Item | null>(null); const [stockItem, setStockItem] = useState<Item | null>(null);
  const [direction, setDirection] = useState<"in" | "out">("in");

  const load = async () => {
    setLoading(true); setError("");
    try { const response = await fetch("/api/groceries"); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not load groceries."); setData(result); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load groceries."); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    let cancelled = false;
    fetch("/api/groceries")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load groceries.");
        if (!cancelled) setData(result);
      })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load groceries."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2600); };
  const post = async (payload: Record<string, unknown>, message: string) => {
    setSaving(true); setError("");
    try { const response = await fetch("/api/groceries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not save the change."); await load(); close(); notify(message); return true; }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save the change."); return false; }
    finally { setSaving(false); }
  };
  const close = () => { setDialog(null); setEditing(null); setStockItem(null); setDirection("in"); };
  const submitItem = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); void post({ action: editing ? "updateItem" : "addItem", id: editing?.id, name: form.get("name"), category: form.get("category"), unit: form.get("unit"), quantity: Number(form.get("quantity")), minimumStock: Number(form.get("minimumStock")), unitPrice: Number(form.get("unitPrice")), expiryDate: form.get("expiryDate") || null, notes: form.get("notes") }, editing ? "Grocery item updated." : "Grocery item added."); };
  const submitStock = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!stockItem) return; const form = new FormData(event.currentTarget); void post({ action: "adjustStock", id: stockItem.id, direction, quantity: Number(form.get("quantity")), note: form.get("note") }, direction === "in" ? "Stock added." : "Stock usage recorded."); };
  const today = new Date(); today.setHours(0, 0, 0, 0); const soon = new Date(today); soon.setDate(soon.getDate() + 7);
  const low = data.items.filter((item) => item.quantity <= item.minimumStock);
  const expiring = data.items.filter((item) => item.expiryDate && new Date(`${item.expiryDate}T00:00:00`) <= soon);
  const categories = ["All", ...Array.from(new Set(data.items.map((item) => item.category))).sort()];
  const filtered = data.items.filter((item) => (filter === "All" || item.category === filter) && `${item.name} ${item.category} ${item.notes}`.toLowerCase().includes(search.trim().toLowerCase()));
  const itemMap = useMemo(() => new Map(data.items.map((item) => [item.id, item])), [data.items]);
  const totalValue = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  return <>
    {error && <div className="alert"><span>{error}</span><button onClick={() => setError("")}>×</button></div>}
    {toast && <div className="toast">✓ {toast}</div>}
    <section className="metric-grid grocery-metrics">
      <Metric label="Inventory items" value={String(data.items.length)} detail={`${new Set(data.items.map(i => i.category)).size} categories`} tone="teal" icon="▦" />
      <Metric label="Stock value" value={money.format(totalValue)} detail="Based on current quantities" tone="cyan" icon="₹" />
      <Metric label="Low stock" value={String(low.length)} detail="At or below minimum" tone="red" icon="!" />
      <Metric label="Expiring soon" value={String(expiring.length)} detail="Expired or within 7 days" tone="amber" icon="◷" />
    </section>
    <section className="page-panel grocery-panel">
      <div className="grocery-toolbar"><div className="tab-list"><button className={tab === "inventory" ? "active" : ""} onClick={() => setTab("inventory")}>Inventory</button><button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>Stock history</button></div>
        <button className="primary" onClick={() => setDialog("item")}>+ Add grocery item</button></div>
      {loading ? <div className="loading-grid grocery-loading"><div /><div /><div /></div> : tab === "inventory" ? <>
        <div className="category-filters">{categories.map(category => <button key={category} className={filter === category ? "active" : ""} onClick={() => setFilter(category)}>{category}</button>)}</div>
        <div className="table-wrap"><table><thead><tr><th>ITEM</th><th>CATEGORY</th><th>ON HAND</th><th>MINIMUM</th><th>VALUE</th><th>EXPIRY</th><th>ACTIONS</th></tr></thead><tbody>
          {filtered.map(item => { const isLow = item.quantity <= item.minimumStock; const expired = item.expiryDate && new Date(`${item.expiryDate}T00:00:00`) < today; return <tr key={item.id}><td><strong>{item.name}</strong>{item.notes && <small className="table-sub">{item.notes}</small>}</td><td>{item.category}</td><td><strong>{number.format(item.quantity)} {item.unit}</strong> {isLow && <span className="status overdue">Low</span>}</td><td>{number.format(item.minimumStock)} {item.unit}</td><td>{money.format(item.quantity * item.unitPrice)}</td><td>{item.expiryDate ? <span className={expired ? "expiry expired" : "expiry"}>{date(item.expiryDate)}</span> : "—"}</td><td><div className="row-actions"><button onClick={() => { setStockItem(item); setDirection("in"); setDialog("stock"); }}>Stock</button><button onClick={() => { setEditing(item); setDialog("item"); }}>Edit</button><button className="danger-button" onClick={() => { if (window.confirm(`Delete ${item.name} and its stock history?`)) void post({ action: "deleteItem", id: item.id }, "Grocery item deleted."); }}>Delete</button></div></td></tr>; })}
        </tbody></table></div>{!filtered.length && <Empty title={search || filter !== "All" ? "No matching groceries" : "Your grocery inventory is empty"} text={search || filter !== "All" ? "Try another search or category." : "Add your first item to begin tracking household stock."} />}
      </> : <div className="table-wrap"><table><thead><tr><th>DATE</th><th>ITEM</th><th>TYPE</th><th>CHANGE</th><th>NOTE</th></tr></thead><tbody>{data.transactions.filter(t => `${itemMap.get(t.itemId)?.name ?? ""} ${t.type} ${t.note}`.toLowerCase().includes(search.trim().toLowerCase())).map(transaction => <tr key={transaction.id}><td>{date(transaction.createdAt)}</td><td><strong>{itemMap.get(transaction.itemId)?.name ?? "Deleted item"}</strong></td><td><span className={`status ${transaction.quantityChange > 0 ? "paid" : "pending"}`}>{transaction.type}</span></td><td className={transaction.quantityChange > 0 ? "positive" : "negative"}>{transaction.quantityChange > 0 ? "+" : ""}{number.format(transaction.quantityChange)} {itemMap.get(transaction.itemId)?.unit}</td><td>{transaction.note || "—"}</td></tr>)}</tbody></table>{!data.transactions.length && <Empty title="No stock history" text="Stock additions and usage will appear here." />}</div>}
    </section>
    {dialog && <div className="modal-layer" role="dialog" aria-modal="true"><button className="modal-backdrop" aria-label="Close dialog" onClick={close} /><div className="modal-card"><div className="modal-head"><div><span className="section-kicker">GROCERY MANAGEMENT</span><h2>{dialog === "item" ? editing ? "Edit grocery item" : "Add grocery item" : `Update ${stockItem?.name}`}</h2></div><button className="close" onClick={close}>×</button></div>
      {dialog === "item" ? <form className="form-grid" onSubmit={submitItem} key={editing?.id ?? "new"}>
        <Field label="Item name"><input name="name" required maxLength={100} defaultValue={editing?.name} placeholder="e.g. Basmati rice" /></Field><Field label="Category"><input name="category" required maxLength={60} list="grocery-categories" defaultValue={editing?.category} placeholder="Grains" /><datalist id="grocery-categories"><option>Grains</option><option>Vegetables</option><option>Fruit</option><option>Dairy</option><option>Spices</option><option>Snacks</option><option>Cleaning</option></datalist></Field>
        <Field label="Measurement unit"><input name="unit" required maxLength={30} list="grocery-units" defaultValue={editing?.unit ?? "kg"} /><datalist id="grocery-units"><option>kg</option><option>g</option><option>litre</option><option>ml</option><option>pieces</option><option>packs</option></datalist></Field><Field label="Current quantity"><input name="quantity" type="number" min="0" max="999999999" step="0.01" required defaultValue={editing?.quantity ?? 0} /></Field>
        <Field label="Low-stock threshold"><input name="minimumStock" type="number" min="0" max="999999999" step="0.01" required defaultValue={editing?.minimumStock ?? 0} /></Field><Field label="Price per unit"><input name="unitPrice" type="number" min="0" max="999999999" step="0.01" required defaultValue={editing?.unitPrice ?? 0} /></Field>
        <Field label="Expiry date"><input name="expiryDate" type="date" defaultValue={editing?.expiryDate ?? ""} /></Field><Field label="Notes"><textarea name="notes" maxLength={500} rows={3} defaultValue={editing?.notes} placeholder="Brand, storage location…" /></Field><Actions saving={saving} onCancel={close} label={editing ? "Save changes" : "Add item"} />
      </form> : <form className="form-grid" onSubmit={submitStock}><div className="stock-choice"><button type="button" className={direction === "in" ? "active" : ""} onClick={() => setDirection("in")}>+ Stock in</button><button type="button" className={direction === "out" ? "active" : ""} onClick={() => setDirection("out")}>− Stock out</button></div><div className="stock-current">Current stock: <strong>{number.format(stockItem?.quantity ?? 0)} {stockItem?.unit}</strong></div><Field label="Quantity"><input name="quantity" type="number" min="0.01" max={direction === "out" ? stockItem?.quantity : 999999999} step="0.01" required autoFocus /></Field><Field label="Reason / note"><input name="note" maxLength={300} placeholder={direction === "in" ? "Purchase, restock…" : "Used, spoiled…"} /></Field><Actions saving={saving} onCancel={close} label={direction === "in" ? "Add stock" : "Record usage"} /></form>}
    </div></div>}
  </>;
}

function Metric({ label, value, detail, tone, icon }: { label: string; value: string; detail: string; tone: string; icon: string }) { return <article className="metric-card"><span className={`metric-icon ${tone}`}>{icon}</span><div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div></article>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="field">{label}{children}</label>; }
function Actions({ saving, onCancel, label }: { saving: boolean; onCancel: () => void; label: string }) { return <div className="form-actions"><button type="button" className="secondary" onClick={onCancel}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Saving…" : label}</button></div>; }
function Empty({ title, text }: { title: string; text: string }) { return <div className="empty"><span>+</span><strong>{title}</strong><p>{text}</p></div>; }
