<div align="center">

# 🏠 RentKhata

**A clean, fast rent and electricity ledger for rooms, shops, and halls.**

Built with Next.js, Drizzle ORM, and Neon Postgres — deploys to Vercel in minutes.

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-C5F74F)](https://orm.drizzle.team)
[![Neon Postgres](https://img.shields.io/badge/Neon-Postgres-00E599?logo=postgresql&logoColor=white)](https://neon.tech)
[![Deploy on Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)](https://vercel.com/new)

</div>

---

## ✨ What it does

RentKhata keeps every property, occupant, and bill in one ledger — no
spreadsheets, no paper *khata*. Track rooms, shops, and halls side by side,
carry electricity meter readings forward automatically, and send a
ready-to-go bill straight to WhatsApp.

| | |
|---|---|
| 🏢 **Property units** | Rooms, shops, and halls with their own rent and meter number |
| 👤 **Occupants** | Name, phone, move-in date, security deposit, notes — active/vacated tracked automatically |
| ⚡ **Electricity billing** | Enter the current reading; previous reading, units used, and cost are calculated for you |
| 🧾 **Monthly bills** | Rent + electricity + extra charges combined into one total, one bill per occupant per month |
| ✅ **Status tracking** | Pending, Paid, and Overdue at a glance |
| 💬 **WhatsApp sharing** | One tap sends a formatted bill directly to the occupant |
| 📱 **Responsive UI** | Works cleanly on desktop, tablet, and phone |

## 🧱 Tech stack

- **[Next.js 16](https://nextjs.org)** (App Router, Turbopack) + **React 19**
- **[Drizzle ORM](https://orm.drizzle.team)** over **[Neon serverless Postgres](https://neon.tech)**
- Zero external UI libraries — plain CSS, small bundle, fast cold starts
- Ships as a single Vercel-ready Next.js app

## 🗂️ Data model

```
units      (id, label, type: Room|Shop|Hall, monthlyRent, meterNumber)
tenants    (id, name, phone, unitId → units, moveInDate, securityDeposit, notes, active)
bills      (id, tenantId → tenants, unitId → units, billMonth, previousReading,
            currentReading, ratePerUnit, unitsUsed, electricityAmount,
            rentAmount, otherCharges, totalAmount, dueDate, status, paidAt)
```

Tables (and the `bills_tenant_month_idx` unique index that blocks duplicate
monthly bills) are created automatically on the first API request — no
manual migration step for a fresh database.

## 🚀 Getting started

**Requirements:** Node.js ≥ 20.9, a Postgres database (a free [Neon](https://neon.tech) project works well)

```bash
npm install
cp .env.example .env.local   # then fill in DATABASE_URL
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Neon or any Postgres-compatible provider) |

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the local dev server with Turbopack |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | Lint the project |
| `npm run db:generate` | Generate Drizzle migrations from `db/schema.ts` |

## 🌐 API

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/health` | `GET` | Confirms the app can reach the database |
| `/api/ledger` | `GET` | Returns all units, tenants, and bills |
| `/api/ledger` | `POST` | Actions: `addUnit`, `addTenant`, `addBill`, `markPaid`, `vacateTenant`, `deleteBill` |

## ☁️ Deploying

See [`VERCEL_DEPLOYMENT_GUIDE.md`](./VERCEL_DEPLOYMENT_GUIDE.md) for the full
walkthrough — create a Neon database, push to GitHub, import into Vercel, set
`DATABASE_URL`, deploy. Tables are created automatically on first request.

## 🔒 A note on privacy

RentKhata stores real occupant names, phone numbers, and payment data. Don't
share your deployment URL publicly — use Vercel deployment protection or add
authentication before granting broader access.

---

<div align="center">

Made for landlords who'd rather not fight a spreadsheet.

</div>
