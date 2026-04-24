# Phoenix Accounting Solutions PNG — Web App

A simple web application prototype that helps small and medium-sized business
(SME) owners in Papua New Guinea keep financial records and connect with the
team at **Phoenix Accounting Solutions PNG**.

Built as a static web app using **HTML, CSS, and JavaScript**, with a **JSON
file** seeding the initial dataset and the browser's `localStorage` acting as a
lightweight JSON-backed "database" that persists between sessions.

## Features

### SME User
- Register and log in
- Record income and expense transactions
- Upload receipt photos (stored as base64 data URLs alongside the transaction)
- Dashboard with income, expenses, profit/loss and category breakdown
- Monthly reports with a simple bar chart and printable P&L summary
- Payroll recording (employee, gross, tax, net)
- Request accounting help from the Phoenix team

### Admin (Phoenix team)
- View all SME clients with at-a-glance totals
- Open a client's file: see transactions, receipts, payroll and help requests
- Record and track payments (due / paid / overdue)
- Read and reply to client help requests; update their status

## Getting started

This is a static site — no build step is required.

```bash
# From the project root:
python3 -m http.server 8000
# open http://localhost:8000
```

### Demo accounts

| Role  | Email              | Password  |
| ----- | ------------------ | --------- |
| Admin | `admin@phoenix.pg` | `admin123` |
| SME   | `sme@demo.pg`      | `demo123`  |

Seed data (including transactions, a payroll entry, a help request and two
payment records) lives in [`data/seed.json`](data/seed.json) and is loaded the
first time the app runs. Changes made in the UI are persisted to
`localStorage` under the key `phoenix_accounting_db_v1`.

To reset the data, clear site data in your browser or run this in the dev
console: `localStorage.clear(); location.reload();`.

## Project layout

```
├── index.html          # single-page app shell + view templates
├── css/
│   └── styles.css      # all styling
├── js/
│   ├── utils.js        # formatting, DOM helpers, SHA-256 hashing
│   ├── storage.js      # JSON + localStorage-backed data store
│   ├── auth.js         # login / register / logout
│   ├── sme.js          # SME views (dashboard, transactions, reports, payroll, help)
│   ├── admin.js        # admin views (clients, payments, messages)
│   └── app.js          # routing, view rendering, modal helper
└── data/
    └── seed.json       # initial data loaded on first run
```

## Notes

- Passwords are hashed with SHA-256 + salt via `SubtleCrypto` — suitable for a
  prototype demonstration, not for production.
- All data is local to the browser. Opening the app in a different browser or
  private window starts from the seed data again.
- Designed for low-bandwidth environments: no external CDNs, no network
  requests after the initial page load.
