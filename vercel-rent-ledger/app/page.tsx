"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Unit = {
  id: number;
  label: string;
  type: "Room" | "Shop" | "Hall";
  monthlyRent: number;
  meterNumber: string;
};

type Tenant = {
  id: number;
  name: string;
  phone: string;
  unitId: number;
  moveInDate: string;
  securityDeposit: number;
  notes: string;
  active: boolean;
};

type Bill = {
  id: number;
  tenantId: number;
  unitId: number;
  billMonth: string;
  previousReading: number;
  currentReading: number;
  ratePerUnit: number;
  unitsUsed: number;
  electricityAmount: number;
  rentAmount: number;
  otherCharges: number;
  totalAmount: number;
  dueDate: string;
  status: "Pending" | "Paid" | "Overdue";
  paidAt: string | null;
};

type LedgerData = { units: Unit[]; tenants: Tenant[]; bills: Bill[] };
type View = "overview" | "occupants" | "properties" | "bills" | "electricity";
type Modal = "unit" | "tenant" | "bill" | null;

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const monthLabel = (value: string) => {
  if (!value) return "—";
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" })
    .format(new Date(year, month - 1, 1));
};

const dateLabel = (value: string) =>
  value ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    .format(new Date(`${value}T00:00:00`)) : "—";

const initials = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

export default function Home() {
  const [data, setData] = useState<LedgerData>({ units: [], tenants: [], bills: [] });
  const [view, setView] = useState<View>("overview");
  const [modal, setModal] = useState<Modal>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [billTenantId, setBillTenantId] = useState<number | "">("");
  const [previousReading, setPreviousReading] = useState(0);
  const [currentReading, setCurrentReading] = useState(0);
  const [ratePerUnit, setRatePerUnit] = useState(8);
  const [otherCharges, setOtherCharges] = useState(0);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/ledger");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load your ledger.");
      setData(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load your ledger.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ledger")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load your ledger.");
        if (!cancelled) setData(result);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load your ledger.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const activeTenants = data.tenants.filter((tenant) => tenant.active);
  const tenantMap = useMemo(() => new Map(data.tenants.map((tenant) => [tenant.id, tenant])), [data.tenants]);
  const unitMap = useMemo(() => new Map(data.units.map((unit) => [unit.id, unit])), [data.units]);
  const paidTotal = data.bills.filter((bill) => bill.status === "Paid").reduce((sum, bill) => sum + bill.totalAmount, 0);
  const pendingTotal = data.bills.filter((bill) => bill.status !== "Paid").reduce((sum, bill) => sum + bill.totalAmount, 0);
  const electricityDue = data.bills.filter((bill) => bill.status !== "Paid").reduce((sum, bill) => sum + bill.electricityAmount, 0);
  const occupiedUnitIds = new Set(activeTenants.map((tenant) => tenant.unitId));

  const selectedTenant = billTenantId ? tenantMap.get(Number(billTenantId)) : undefined;
  const selectedUnit = selectedTenant ? unitMap.get(selectedTenant.unitId) : undefined;
  const unitsUsed = Math.max(0, currentReading - previousReading);
  const electricityAmount = unitsUsed * ratePerUnit;
  const billTotal = (selectedUnit?.monthlyRent ?? 0) + electricityAmount + otherCharges;

  const query = search.trim().toLowerCase();
  const filteredTenants = data.tenants.filter((tenant) => {
    const unit = unitMap.get(tenant.unitId);
    return !query || `${tenant.name} ${tenant.phone} ${unit?.label ?? ""} ${unit?.type ?? ""}`.toLowerCase().includes(query);
  });
  const filteredBills = data.bills.filter((bill) => {
    const tenant = tenantMap.get(bill.tenantId);
    const unit = unitMap.get(bill.unitId);
    return !query || `${tenant?.name ?? ""} ${unit?.label ?? ""} ${bill.billMonth} ${bill.status}`.toLowerCase().includes(query);
  });

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  };

  const post = async (payload: Record<string, unknown>, message: string) => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save the change.");
      await loadData();
      setModal(null);
      notify(message);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save the change.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const submitUnit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await post({
      action: "addUnit",
      label: form.get("label"),
      type: form.get("type"),
      monthlyRent: Number(form.get("monthlyRent")),
      meterNumber: form.get("meterNumber"),
    }, "Property unit added.");
  };

  const submitTenant = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await post({
      action: "addTenant",
      name: form.get("name"),
      phone: form.get("phone"),
      unitId: Number(form.get("unitId")),
      moveInDate: form.get("moveInDate"),
      securityDeposit: Number(form.get("securityDeposit")),
      notes: form.get("notes"),
    }, "Occupant added.");
  };

  const submitBill = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTenant || !selectedUnit) return;
    const form = new FormData(event.currentTarget);
    const saved = await post({
      action: "addBill",
      tenantId: selectedTenant.id,
      unitId: selectedUnit.id,
      billMonth: form.get("billMonth"),
      previousReading,
      currentReading,
      ratePerUnit,
      rentAmount: selectedUnit.monthlyRent,
      otherCharges,
      dueDate: form.get("dueDate"),
    }, "Rent and electricity bill created.");
    if (saved) {
      setBillTenantId("");
      setPreviousReading(0);
      setCurrentReading(0);
      setOtherCharges(0);
    }
  };

  const whatsAppUrl = (bill: Bill) => {
    const tenant = tenantMap.get(bill.tenantId);
    const unit = unitMap.get(bill.unitId);
    if (!tenant || !unit) return "#";
    let phone = tenant.phone.replace(/\D/g, "");
    if (phone.length === 10) phone = `91${phone}`;
    const text = [
      `*RentKhata Bill — ${monthLabel(bill.billMonth)}*`,
      "",
      `Hello ${tenant.name},`,
      `Property: ${unit.type} ${unit.label}`,
      `Rent: ${money.format(bill.rentAmount)}`,
      `Electricity: ${bill.unitsUsed} units × ₹${bill.ratePerUnit} = ${money.format(bill.electricityAmount)}`,
      bill.otherCharges ? `Other charges: ${money.format(bill.otherCharges)}` : "",
      `*Total payable: ${money.format(bill.totalAmount)}*`,
      `Due date: ${dateLabel(bill.dueDate)}`,
      `Status: ${bill.status}`,
      "",
      "Thank you.",
    ].filter(Boolean).join("\n");
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };

  const openBillFor = (tenantId?: number) => {
    const id = tenantId ?? activeTenants[0]?.id ?? "";
    setBillTenantId(id);
    if (id) {
      const previous = data.bills.find((bill) => bill.tenantId === id)?.currentReading ?? 0;
      setPreviousReading(previous);
      setCurrentReading(previous);
    }
    setModal("bill");
  };

  const navItems: { id: View; label: string; icon: string }[] = [
    { id: "overview", label: "Overview", icon: "⌂" },
    { id: "occupants", label: "Occupants", icon: "◎" },
    { id: "properties", label: "Properties", icon: "▦" },
    { id: "bills", label: "Rent & Bills", icon: "₹" },
    { id: "electricity", label: "Electricity", icon: "ϟ" },
  ];

  return (
    <div className="app-shell">
      <aside className={menuOpen ? "sidebar open" : "sidebar"}>
        <div className="brand"><span className="brand-mark">R</span><span>RentKhata</span></div>
        <nav>
          {navItems.map((item) => (
            <button key={item.id} className={view === item.id ? "nav-item active" : "nav-item"}
              onClick={() => { setView(item.id); setMenuOpen(false); }}>
              <span className="nav-icon">{item.icon}</span><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="tiny-label">PROPERTY MANAGER</div>
          <div className="owner-card"><span className="avatar small">RC</span><div><strong>Rahul</strong><small>Administrator</small></div></div>
        </div>
      </aside>

      {menuOpen && <button className="backdrop" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}

      <main className="main">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Open navigation">☰</button>
          <div>
            <p className="eyebrow">{view === "overview" ? "PROPERTY OVERVIEW" : view.toUpperCase()}</p>
            <h1>{view === "overview" ? "Good morning, Rahul" : navItems.find((item) => item.id === view)?.label}</h1>
            <p className="subhead">{view === "overview" ? "Here’s what’s happening with your rentals today." : "Manage every detail from one simple workspace."}</p>
          </div>
          <div className="top-actions">
            <label className="search">
              <span>⌕</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)}
                placeholder="Search people, units or bills…" aria-label="Search ledger" />
            </label>
            <button className="primary" onClick={() => setModal("tenant")} disabled={!data.units.length}>+ Add occupant</button>
          </div>
        </header>

        {error && <div className="alert"><span>{error}</span><button onClick={() => setError("")}>×</button></div>}
        {toast && <div className="toast">✓ {toast}</div>}

        {loading ? (
          <div className="loading-grid"><div /><div /><div /><div /></div>
        ) : view === "overview" ? (
          <>
            {!data.units.length && (
              <section className="welcome-banner">
                <div><span className="welcome-icon">⌂</span><div><h2>Start by adding your first rental unit</h2><p>Add a room, shop or hall, then assign an occupant and create monthly bills.</p></div></div>
                <button className="primary" onClick={() => setModal("unit")}>+ Add property unit</button>
              </section>
            )}
            <section className="metric-grid">
              <Metric icon="◎" tone="teal" label="Active occupants" value={String(activeTenants.length)}
                detail={`${occupiedUnitIds.size} of ${data.units.length} units occupied`} />
              <Metric icon="₹" tone="cyan" label="Collected" value={money.format(paidTotal)}
                detail={`${data.bills.filter((bill) => bill.status === "Paid").length} bills paid`} />
              <Metric icon="!" tone="red" label="Outstanding" value={money.format(pendingTotal)}
                detail={`${data.bills.filter((bill) => bill.status !== "Paid").length} payments pending`} />
              <Metric icon="ϟ" tone="amber" label="Electricity due" value={money.format(electricityDue)}
                detail={`${data.bills.reduce((sum, bill) => sum + bill.unitsUsed, 0)} total units billed`} />
            </section>

            <section className="overview-grid">
              <div className="panel payments-panel">
                <PanelHeader title="Recent rent & bill activity" action="View all" onClick={() => setView("bills")} />
                <BillTable bills={filteredBills.slice(0, 6)} tenantMap={tenantMap} unitMap={unitMap}
                  onPaid={(id) => post({ action: "markPaid", id }, "Payment marked as paid.")}
                  getShareUrl={whatsAppUrl} />
              </div>
              <div className="panel quick-bill">
                <div className="panel-heading"><div><span className="section-kicker">QUICK ACTION</span><h2>Monthly bill</h2></div><span className="bolt">ϟ</span></div>
                <p>Combine rent, electricity and extra charges into one shareable bill.</p>
                <div className="quick-steps">
                  <div><span>1</span><div><strong>Select an occupant</strong><small>Room, shop or hall</small></div></div>
                  <div><span>2</span><div><strong>Add meter readings</strong><small>Usage is calculated automatically</small></div></div>
                  <div><span>3</span><div><strong>Share on WhatsApp</strong><small>Send a clean bill instantly</small></div></div>
                </div>
                <button className="primary full" onClick={() => openBillFor()} disabled={!activeTenants.length}>Create new bill</button>
              </div>
            </section>

            <section className="unit-strip">
              <PanelHeader title="Property occupancy" action="Manage units" onClick={() => setView("properties")} />
              <div className="unit-cards">
                {data.units.slice(0, 6).map((unit) => {
                  const tenant = activeTenants.find((item) => item.unitId === unit.id);
                  return <div className="unit-card" key={unit.id}><div><span className={`type-dot ${unit.type.toLowerCase()}`} />
                    <strong>{unit.label}</strong><small>{unit.type}</small></div><span className={tenant ? "occupied" : "vacant"}>{tenant ? tenant.name : "Vacant"}</span></div>;
                })}
                {!data.units.length && <Empty compact title="No units yet" text="Rooms, shops and halls will appear here." />}
              </div>
            </section>
          </>
        ) : view === "occupants" ? (
          <section className="page-panel">
            <PanelHeader title={`Occupants (${filteredTenants.length})`} action="+ Add occupant" onClick={() => setModal("tenant")} />
            <div className="people-grid">
              {filteredTenants.map((tenant) => {
                const unit = unitMap.get(tenant.unitId);
                return <article className="person-card" key={tenant.id}>
                  <div className="person-top"><span className="avatar">{initials(tenant.name)}</span><span className={tenant.active ? "status paid" : "status neutral"}>{tenant.active ? "Active" : "Vacated"}</span></div>
                  <h3>{tenant.name}</h3><p>{tenant.phone}</p>
                  <div className="person-details"><span><small>PROPERTY</small><strong>{unit?.type} {unit?.label}</strong></span><span><small>MONTHLY RENT</small><strong>{money.format(unit?.monthlyRent ?? 0)}</strong></span></div>
                  <div className="card-actions"><button onClick={() => openBillFor(tenant.id)} disabled={!tenant.active}>Create bill</button>
                    {tenant.active && <button className="muted-button" onClick={() => post({ action: "vacateTenant", id: tenant.id }, "Occupant marked as vacated.")}>Mark vacated</button>}</div>
                </article>;
              })}
              {!filteredTenants.length && <Empty title="No occupants found" text="Add a person and assign them to a rental unit." />}
            </div>
          </section>
        ) : view === "properties" ? (
          <section className="page-panel">
            <PanelHeader title={`Property units (${data.units.length})`} action="+ Add room, shop or hall" onClick={() => setModal("unit")} />
            <div className="property-grid">
              {data.units.map((unit) => {
                const tenant = activeTenants.find((item) => item.unitId === unit.id);
                return <article className="property-card" key={unit.id}>
                  <div className={`property-icon ${unit.type.toLowerCase()}`}>{unit.type === "Room" ? "⌂" : unit.type === "Shop" ? "▤" : "▦"}</div>
                  <div className="property-copy"><div><span className="section-kicker">{unit.type}</span><h3>{unit.label}</h3></div>
                    <span className={tenant ? "status paid" : "status pending"}>{tenant ? "Occupied" : "Vacant"}</span></div>
                  <div className="property-stats"><span><small>MONTHLY RENT</small><strong>{money.format(unit.monthlyRent)}</strong></span>
                    <span><small>METER NUMBER</small><strong>{unit.meterNumber || "Not added"}</strong></span></div>
                  <div className="occupant-row">{tenant ? <><span className="avatar small">{initials(tenant.name)}</span><div><strong>{tenant.name}</strong><small>{tenant.phone}</small></div></> : <span className="vacant-copy">Ready for a new occupant</span>}</div>
                </article>;
              })}
              {!data.units.length && <Empty title="No property units" text="Add your first room, shop or big hall." />}
            </div>
          </section>
        ) : view === "bills" ? (
          <section className="page-panel">
            <PanelHeader title={`Rent & bills (${filteredBills.length})`} action="+ Create bill" onClick={() => openBillFor()} />
            <BillTable bills={filteredBills} tenantMap={tenantMap} unitMap={unitMap}
              onPaid={(id) => post({ action: "markPaid", id }, "Payment marked as paid.")}
              getShareUrl={whatsAppUrl} />
          </section>
        ) : (
          <section className="electricity-layout">
            <div className="page-panel">
              <PanelHeader title="Electricity history" action="+ Add reading & bill" onClick={() => openBillFor()} />
              <div className="reading-list">
                {filteredBills.filter((bill) => bill.electricityAmount > 0).map((bill) => {
                  const tenant = tenantMap.get(bill.tenantId); const unit = unitMap.get(bill.unitId);
                  return <article key={bill.id}><div className="reading-icon">ϟ</div><div><strong>{tenant?.name}</strong><small>{unit?.type} {unit?.label} · {monthLabel(bill.billMonth)}</small></div>
                    <span><small>{bill.previousReading} → {bill.currentReading}</small><strong>{bill.unitsUsed} units</strong></span>
                    <strong>{money.format(bill.electricityAmount)}</strong></article>;
                })}
                {!data.bills.some((bill) => bill.electricityAmount > 0) && <Empty title="No meter readings" text="Create a bill to save electricity usage." />}
              </div>
            </div>
            <aside className="info-card"><span className="info-icon">i</span><h3>How electricity is calculated</h3>
              <p>Current reading − previous reading = units used.</p><div className="formula">Units used × rate per unit = electricity amount</div>
              <p>That amount is automatically added to the monthly rent and any extra charges.</p></aside>
          </section>
        )}
      </main>

      {modal && (
        <div className="modal-layer" role="dialog" aria-modal="true">
          <button className="modal-backdrop" aria-label="Close dialog" onClick={() => setModal(null)} />
          <div className="modal-card">
            <div className="modal-head"><div><span className="section-kicker">RENTKHATA</span><h2>{modal === "unit" ? "Add property unit" : modal === "tenant" ? "Add occupant" : "Create monthly bill"}</h2></div>
              <button className="close" onClick={() => setModal(null)} aria-label="Close">×</button></div>
            {modal === "unit" ? (
              <form onSubmit={submitUnit} className="form-grid">
                <Field label="Unit name / number"><input name="label" required placeholder="e.g. Room 101, Main Shop, Big Hall" /></Field>
                <Field label="Property type"><select name="type" required><option value="Room">Room</option><option value="Shop">Shop</option><option value="Hall">Big hall</option></select></Field>
                <Field label="Monthly rent"><input name="monthlyRent" type="number" min="1" required placeholder="8500" /></Field>
                <Field label="Electricity meter number"><input name="meterNumber" placeholder="Optional" /></Field>
                <FormActions saving={saving} onCancel={() => setModal(null)} label="Add property unit" />
              </form>
            ) : modal === "tenant" ? (
              <form onSubmit={submitTenant} className="form-grid">
                <Field label="Full name"><input name="name" required placeholder="Occupant's name" /></Field>
                <Field label="WhatsApp number"><input name="phone" type="tel" required placeholder="98765 43210" /></Field>
                <Field label="Assign property"><select name="unitId" required defaultValue=""><option value="" disabled>Select a vacant unit</option>
                  {data.units.filter((unit) => !occupiedUnitIds.has(unit.id)).map((unit) => <option key={unit.id} value={unit.id}>{unit.type} — {unit.label} ({money.format(unit.monthlyRent)})</option>)}</select></Field>
                <Field label="Move-in date"><input name="moveInDate" type="date" required /></Field>
                <Field label="Security deposit"><input name="securityDeposit" type="number" min="0" defaultValue="0" /></Field>
                <Field label="Notes"><textarea name="notes" rows={3} placeholder="Optional details" /></Field>
                <FormActions saving={saving} onCancel={() => setModal(null)} label="Add occupant" />
              </form>
            ) : (
              <form onSubmit={submitBill} className="form-grid bill-form">
                <Field label="Occupant"><select required value={billTenantId} onChange={(event) => {
                  const id = Number(event.target.value); setBillTenantId(id);
                  const previous = data.bills.find((bill) => bill.tenantId === id)?.currentReading ?? 0;
                  setPreviousReading(previous); setCurrentReading(previous);
                }}><option value="" disabled>Select occupant</option>{activeTenants.map((tenant) => {
                  const unit = unitMap.get(tenant.unitId); return <option key={tenant.id} value={tenant.id}>{tenant.name} — {unit?.type} {unit?.label}</option>;
                })}</select></Field>
                <Field label="Bill month"><input name="billMonth" type="month" required defaultValue={new Date().toISOString().slice(0, 7)} /></Field>
                <Field label="Previous meter reading"><input type="number" min="0" step="0.01" value={previousReading} onChange={(event) => setPreviousReading(Number(event.target.value))} required /></Field>
                <Field label="Current meter reading"><input type="number" min={previousReading} step="0.01" value={currentReading} onChange={(event) => setCurrentReading(Number(event.target.value))} required /></Field>
                <Field label="Electricity rate / unit"><input type="number" min="0" step="0.01" value={ratePerUnit} onChange={(event) => setRatePerUnit(Number(event.target.value))} required /></Field>
                <Field label="Other charges"><input type="number" min="0" step="0.01" value={otherCharges} onChange={(event) => setOtherCharges(Number(event.target.value))} /></Field>
                <Field label="Payment due date"><input name="dueDate" type="date" required /></Field>
                <div className="bill-summary">
                  <div><span>Monthly rent</span><strong>{money.format(selectedUnit?.monthlyRent ?? 0)}</strong></div>
                  <div><span>Electricity ({unitsUsed} units)</span><strong>{money.format(electricityAmount)}</strong></div>
                  <div><span>Other charges</span><strong>{money.format(otherCharges)}</strong></div>
                  <div className="grand-total"><span>Total payable</span><strong>{money.format(billTotal)}</strong></div>
                </div>
                <FormActions saving={saving} onCancel={() => setModal(null)} label="Save bill" />
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ icon, tone, label, value, detail }: { icon: string; tone: string; label: string; value: string; detail: string }) {
  return <article className="metric-card"><span className={`metric-icon ${tone}`}>{icon}</span><div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div></article>;
}

function PanelHeader({ title, action, onClick }: { title: string; action: string; onClick: () => void }) {
  return <div className="panel-header"><h2>{title}</h2><button onClick={onClick}>{action} <span>›</span></button></div>;
}

function Empty({ title, text, compact = false }: { title: string; text: string; compact?: boolean }) {
  return <div className={compact ? "empty compact" : "empty"}><span>＋</span><strong>{title}</strong><p>{text}</p></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function FormActions({ saving, onCancel, label }: { saving: boolean; onCancel: () => void; label: string }) {
  return <div className="form-actions"><button type="button" className="secondary" onClick={onCancel}>Cancel</button><button type="submit" className="primary" disabled={saving}>{saving ? "Saving…" : label}</button></div>;
}

function BillTable({ bills: rows, tenantMap, unitMap, onPaid, getShareUrl }: {
  bills: Bill[]; tenantMap: Map<number, Tenant>; unitMap: Map<number, Unit>;
  onPaid: (id: number) => void; getShareUrl: (bill: Bill) => string;
}) {
  if (!rows.length) return <Empty title="No bills yet" text="Create your first combined rent and electricity bill." />;
  return <div className="table-wrap"><table><thead><tr><th>Occupant</th><th>Property</th><th>Bill month</th><th>Total</th><th>Due date</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>{rows.map((bill) => {
      const tenant = tenantMap.get(bill.tenantId); const unit = unitMap.get(bill.unitId);
      const overdue = bill.status !== "Paid" && new Date(`${bill.dueDate}T23:59:59`) < new Date();
      const status = overdue ? "Overdue" : bill.status;
      return <tr key={bill.id}><td><div className="tenant-cell"><span className="avatar tiny">{initials(tenant?.name ?? "?")}</span><div><strong>{tenant?.name ?? "Unknown"}</strong><small>{tenant?.phone}</small></div></div></td>
        <td><strong>{unit?.label}</strong><small className="table-sub">{unit?.type}</small></td><td>{monthLabel(bill.billMonth)}</td><td><strong>{money.format(bill.totalAmount)}</strong><small className="table-sub">{money.format(bill.electricityAmount)} electricity</small></td>
        <td>{dateLabel(bill.dueDate)}</td><td><span className={`status ${status.toLowerCase()}`}>{status}</span></td>
        <td><div className="row-actions"><a className="whatsapp" href={getShareUrl(bill)} target="_blank" rel="noopener noreferrer" title="Share bill on WhatsApp">WhatsApp</a>
          {bill.status !== "Paid" && <button onClick={() => onPaid(bill.id)}>Mark paid</button>}</div></td></tr>;
    })}</tbody></table></div>;
}
