# FinAlert — Project Understanding Guide

Everything needed to understand FinAlert: what it is, what it does, how it is built,
and how it works. Written as the definitive orientation document for the codebase.

---

## 1. What FinAlert Is

**FinAlert** is a cross-platform mobile app (React Native / Expo) for personal and
family money management. It helps users log income and expenses, set monthly budgets
with per-category limits, track savings goals, run a shared family expense pool, and
receive smart, real-time spending alerts.

It is a **CSE capstone project** (East West University, Dhaka, Bangladesh, 2026),
built by Md. Malek Hossain Jim, Sumaiya Jannat Arpa, Tasmia Rahman, and Muntasir
Hossain, supervised by Dr. Taskeed Jabid. It extends an earlier Human–Computer
Interaction design exercise; the capstone's main new contribution is the **Family
Finance Module**.

The core insight behind the design: budgeting apps fail because *recording an expense
is effort paid now for a benefit later*, so users abandon them. FinAlert attacks that
friction with low-effort entry (voice + receipt scan), and addresses the reality that
many Bangladeshi households manage money **collectively** (parents, working children,
relatives all contribute to shared bills).

### What it is NOT
- Not a financial advisor. No predictive model produces financial advice.
- The "AI Financial Assistant" and "Financial Health Score" are **unbuilt/planned**.
- The "AI" insight text in the UI is deterministic rule logic, not a model.

---

## 2. What It Does (Features)

### 2.1 Multi-modal expense/income entry
- **Form** — amount, category/source, date, optional description.
- **Voice** — say *"Spent 500 taka on groceries."* The app transcribes on-device, parses
  the intent, and opens the right form pre-filled.
- **Receipt scan** — photograph a receipt; the app extracts merchant, date, total,
  category, and individual line items (each selectable for entry).

### 2.2 Budget planner
- Sets one monthly income + a savings percentage → automatically allocates per-category
  limits using an 80/20 spend/save split with fixed category weights. Fully editable.

### 2.3 Live budget-usage tracking
- Per-category spent, limit, remaining, and % used, recomputed live as transactions change.

### 2.4 Smart alert engine (4 rule types)
1. Overall monthly budget 80% / 100% used.
2. Per-category overrun (>= 100% of category limit).
3. Month-over-month spending increase for a category.
4. Daily spending spike (>= 2x the average daily pace for a category).
Alerts are deduplicated per unique key and delivered in an in-app alert centre.

### 2.5 Savings goals
- Goals with target amount, icon, color, target date; atomic contributions; milestone
  notifications at 20/40/60/80/100% progress. Three demo goals seeded for new users.

### 2.6 Reports
- Monthly/weekly toggle; income, expense, savings, savings rate; bar chart (income vs
  expense); donut chart of expense by category; rule-based insight banner.

### 2.7 Family Finance Module (capstone extension)
- Create a family group; invite via unique code **FAMS-XXXX**.
- **Roles:** Admin, Contributor, Dependent (see §5.4).
- Shared expenses with per-member assigned amounts + settlement tracking.
- Family transactions: payments, additional contributions, declared inability to pay.
- Contributions view showing who paid what against a common budget.
- Correctness (atomicity, overpay guard, rollback, admin-only edits) enforced in **SQL**.

### 2.8 Bilingual input accommodation
- Accepts Bangla, English, and mixed "Banglish" speech and Bangla numerals for entry.

---

## 3. How It's Built (Technology Stack)

| Layer | Technology |
|---|---|
| Framework | Expo SDK 54, React Native 0.81.5 (new architecture enabled) |
| Language / routing | TypeScript ~5.9.2, Expo Router v6 (file-based) |
| UI / styling | React 19.1.0, NativeWind v4 (Tailwind CSS ^3.4.17) |
| Icons / charts / animation | @expo/vector-icons, react-native-svg, react-native-reanimated, expo-linear-gradient |
| Speech / camera / storage | expo-speech-recognition, expo-camera, expo-image-picker, expo-secure-store |
| Backend | Supabase — Auth (GoTrue), PostgREST, PostgreSQL with Row Level Security |
| AI language / vision | Google Gemini Flash / Flash-Lite family (via REST) |
| Build | EAS (Android APK target) |

### Design-system source of truth
- **`DESIGN.md`** (repo root) defines the strict UI boundaries: exact text tokens
  (Title 20px/bold, Subtitle 16px/medium, Subtext 14px, Paragraph 13px), a green brand
  palette, and strict light/dark mode separation. Components reference these via
  NativeWind utility classes; raw hex / pixel values are never hardcoded.
- **`AGENTS.md`** defines the backend-portability rules (§4.2).

---

## 4. Architecture

### 4.1 Three-tier model
1. **Client tier** — React Native app in TypeScript; state in React context providers.
   Interface components never talk to the backend directly; they consume context hooks,
   which call a thin typed data-access layer (the only code that touches Supabase).
2. **Backend tier** — Supabase: auth, PostgreSQL over REST, RLS on every table,
   security-definer functions that encapsulate multi-table business rules, and triggers
   for notifications. All guaranteed logic lives in **SQL**.
3. **External services tier** — the OS speech engine (transcribes locally, audio never
   leaves the device) and the Google Gemini models (called over HTTPS to interpret a
   transcript or a receipt image). Each receives one input and returns one structured
   result that the client validates before use.

### 4.2 Backend portability rule (from AGENTS.md — must follow)
1. All Supabase/SDK usage lives ONLY in `lib/supabase.ts` (client) and
   `context/AuthContext.tsx` (auth). Screens/components never import the SDK directly.
2. Components use the app's own types (e.g. `Profile`), never `@supabase/supabase-js` types.
3. Business rules live in the DB (SQL), not replicated in client code.
4. Avoid provider-locked features (realtime channels, storage buckets, edge functions)
   unless isolated behind the context layer.
5. Data access is added as functions in the context/lib layer, never inline in a screen.
6. Prefer standard SQL/Postgres patterns so a migration is a plain dump/import.

### 4.3 Routing / navigation (Expo Router file-based)
```
app/
  _layout.tsx          Root layout: providers + auth redirect gate (splash 2.5s min)
  index.tsx            Landing (redirected away when signed in)
  notifications.tsx    Alert centre
  (auth)/
    _layout.tsx
    login.tsx
    signup.tsx
  (tabs)/
    _layout.tsx        Bottom tab bar (5 tabs, active green #0FB384)
    index.tsx          Home dashboard
    transactions.tsx   Transactions list + Budget Limits
    family.tsx         Family group + shared finance
    reports.tsx        Monthly/Weekly reports & charts
    profile.tsx        Profile / settings
```
Navigation flow: splash → login/signup → dashboard → add income/expense, voice or scanner
entry → transactions → alerts → reports → family finance → profile.

### 4.4 State management (Context providers)
- **AuthContext** — session, user, profile, signIn/signUp/signOut/refresh;
  listens to `onAuthStateChange`.
- **TransactionsContext** — transactions[], add/update/delete/refresh, plus a
  cross-tab "requestTransactionsTab" flag.
- **BudgetsContext** — active budget plan, live per-category usage, monthly spend,
  budget modal visibility, the alert engine, and a **self-healing sync** that keeps
  exactly one "Monthly budget income" transaction per month.
- **NotificationsContext** — notifications[], unreadCount, markAllRead/dismiss/notify.
  `notify()` writes a DB row and prepends it locally for instant UI update.
- **SavingsGoalsContext** — goals[], addContribution (with milestone alerts), createGoal;
  seeds three demo goals for a brand-new user.
- **FamilyContext** — family + members; createFamily / joinFamily via invite code with
  friendly error mapping (ALREADY_IN_FAMILY, INVALID_CODE, ...).

---

## 5. Data Model & Backend

### 5.1 Database schema (PostgreSQL, in `supabase/migrations/`)
| Table | Purpose |
|---|---|
| `profiles` | Profile (id, full_name, email, phone) — auto-created on signup by a server trigger |
| `transactions` | Ledger (user_id, type expense/income, amount, category, description, date) |
| `budgets` | One active plan per user (monthly_income, savings_target_percentage, total_spending_budget) |
| `category_budgets` | Per-category allocated_amount + % of budget; unique (budget_id, category) |
| `savings_goals` | name, icon, target_amount, current_amount, color, target_date |
| `notifications` | category (budget/bills/savings/family), title, message, progress, accent_color, is_read, action_type |
| `families` | name + unique invite_code (FAMS-XXXX) |
| `family_members` | family_id, user_id, role (Admin/Contributor/Dependent), monthly_limit |
| `family_expenses` | Shared expense header (family_id, category, total, created_by) |
| `family_expense_contributors` | Per-member share (expense_id, member_id, assigned, paid_amount) |
| `family_transactions` | History (type payment/extra/unable, amount, note) |

### 5.2 Row Level Security (RLS)
- Personal tables (`transactions`, `budgets`, `category_budgets`, `savings_goals`,
  `notifications`): users only see/alter their own rows (`auth.uid()`).
- Family tables: members-only reads via the `is_family_member()` helper.
- Family finance tables: **read-only RLS**; all writes go through security-definer
  functions so cross-table rules can be enforced.

### 5.3 Security-definer functions (RPCs) — the DB-enforced invariants
| Function | Behaviour |
|---|---|
| `is_family_member(family_id)` | Membership check used by policies |
| `create_family(name)` | Creates group + caller as Admin; unique FAMS-XXXX code; rejects users already in a family |
| `join_family(invite_code)` | Joins caller as Contributor |
| `get_family_roster(family_id)` | Members joined with display names |
| `get_family_finance(family_id)` | One JSON snapshot: members (limits/extra/unable), expenses (contributors + paid status), transactions |
| `add_family_expense(...)` | Inserts expense header + contributor rows atomically |
| `record_family_transaction(...)` | Inserts a payment/extra/unable and increments paid_amount under the **overpay guard** |
| `update_family_expense(...)` | Admin-only edit; preserves paid amounts; new total can't drop below what's paid; removes only unpaid de-assigned contributors |
| `delete_family_expense(id)` | Admin-only cascade delete |
| `delete_family_transaction(id)` | Owner-only delete that rolls back paid_amount |
| `update_family_member_role(...)` | Admin-only role + limit change |
| `update_own_contribution(...)` | Member sets their own monthly limit |
| `remove_family_member(id)` | Admin-only removal |
| `add_savings_contribution(goal_id, amount)` | Atomic `UPDATE ... SET current_amount = current_amount + amount` — prevents lost updates from client races |

### 5.4 Family roles & permissions
| Capability | Admin | Contributor | Dependent |
|---|---|---|---|
| View family financial info | Yes | Yes | Yes |
| Add a shared expense | Yes | Yes | Yes |
| Record a payment / contribution | Yes | Yes | Yes |
| Be assigned a share of an expense | Yes | Yes | **No** |
| Manage the family budget | Yes | No | No |
| Add/remove members; change roles & limits | Yes | No | No |
| Edit/delete any family expense | Yes | No | No |
| Set own monthly limit | Yes | Yes | Yes |

> Note: Admin-only rows are enforced server-side. The "Dependent can't be assigned a
> share" rule is enforced only in the add-expense modal (client-side); `record_family_transaction`
> performs no role check. This is a documented enforcement gap.

### 5.5 Triggers
- `on_auth_user_created` (hosted project): inserts a `profiles` row on signup (client only SELECTs).
- `notify_family_member_joined`: AFTER INSERT on `family_members` → notify every other member.
- `notify_family_expense_added`: AFTER INSERT on `family_expenses` → notify other members (category + amount).

---

## 6. How the Algorithms & AI Actually Work

### 6.1 AI models and fallback under rate limiting
FinAlert trains/hosts no model. Two kinds of AI:
- **On-device speech recognition** via `expo-speech-recognition` (Google on Android,
  `SFSpeechRecognizer` on iOS), languages `bn-BD` and `en-US`. Audio stays on device.
- **Google Gemini** (Flash / Flash-Lite family) over the REST `generateContent` endpoint
  in `services/geminiClient.ts`, key from `EXPO_PUBLIC_GEMINI_API_KEY`.

Five models in **fallback order** (Free-tier quotas are per-model, so chaining keeps the
feature working when one model is rate-limited):
`gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-3.5-flash`, `gemini-3-flash`,
`gemini-3.6-flash`.

Fallback algorithm (`generateGeminiContent`):
```
1. Create AbortController + timer (15s voice, 30s receipt scan).
2. For each model in the ordered list:
     POST {text|image} to /models/{model}:generateContent
     if response.ok -> return result
     read body (release connection)
     if status == 429 -> log warning, continue to next model
     else -> return error immediately (non-quota error won't be fixed by retrying)
3. If every model returned 429, throw GeminiAllRateLimitedError.
4. Finally: clear the timer.
```
The models support **structured JSON output** (`response_mime_type: json` + `responseSchema`)
and **multimodal input** (text + inline base64 image) — both essential.

- **Voice intent parser** (`services/voiceIntentService.ts`, `parseVoiceIntent(text)`):
  transcript → JSON with one of six actions — `ADD_EXPENSE`, `ADD_INCOME`,
  `CREATE_SAVINGS_GOAL`, `ADD_SAVINGS_CONTRIBUTION`, `SET_BUDGET_LIMIT`, `UNKNOWN` — plus
  amount, category, goal_name, description, target_amount. A system instruction teaches the
  exact category labels, Bangla/Banglish handling, digit conversion, and JSON-only output.
- **Receipt scanner** (`services/receiptIntentService.ts`, `parseReceiptFromImage(base64, mime)`):
  returns merchant, date, total, category, line items; handles Bangladeshi receipts, Bangla
  digits, BDT; "not a receipt" fallback.

### 6.2 Sanitisation / validation pipeline (critical)
No model output is written directly. Every field is re-validated client-side:
- **Amount** — parses string/number, strips separators, rejects non-finite / non-positive /
  > 1,000,000,000, rounds to 2 decimals.
- **Category** — case-insensitive match against real app labels, else forced to "Other".
- **Date** — enforced `YYYY-MM-DD` valid range; future/invalid receipt dates clamped to today.
- **Action** — only the six known enum actions accepted.
This layer is as important as the model itself.

### 6.3 Budget smart allocation (`components/BudgetSetupModal.tsx`)
Turn income + savings % into per-category limits (weights sum to 100%):
```
Bills & Utilities 30% | Food & Dining 18% | Grocery 12% | Transport 8%
Health 8% | Shopping 8% | Entertainment 6% | Other 10%
savingsAmount   = income * savingsPct / 100          (slider 5–50%, default 20%)
spendingBudget  = income - savingsAmount
allocation[i]   = spendingBudget * pct[i] / 100
last category   = spendingBudget - sum(others)       (no rounding drift)
percentage_of_budget = allocation / spendingBudget * 100
```
Recomputed only when income/savings % change; manual edits preserved.

### 6.4 Live budget usage (`lib/budgets.ts`, `computeCategoryBudgetsWithSpend`)
Filter current month's expenses (`monthKey = year*100 + month`), accumulate spent per
category; per category: `spent`, `limit`, `remaining = limit - spent`,
`percentage_used = spent/limit*100` (0 when limit 0). Memoized (`useMemo`).

### 6.5 Alert derivation (`context/BudgetsContext.tsx`)
Recomputed as a React effect whenever plan/transactions change. Buckets expenses into
current month, last month, today; fires (each once per unique key via a Set):
1. Monthly budget 80% used (orange) / 100% used (red).
2. Per-category overrun: `percentage_used >= 100`.
3. Month-over-month increase: current month > last month for the same category.
4. Daily spike: today's category spend >= 2x average daily pace (spend / days elapsed).

### 6.6 Savings milestone (`context/SavingsGoalsContext.tsx`)
After a contribution, compare old vs new %, notify on crossing 20/40/60/80/100%.
Monetary addition is atomic server-side via `add_savings_contribution` RPC.

### 6.7 Reports charts (`app/(tabs)/reports.tsx`)
- Buckets by current 6 months (bar) or week-of-month (W1..Wn).
- `niceCeil` rounds max to a "nice" axis number (1/2/5/10 × power of 10).
- Donut: per-category % via SVG `stroke-dasharray/offset`; top 5 shown, rest → "Other".
- Savings rate = `(income - expense)/income * 100`.

### 6.8 Family finance invariants (SQL)
- Paid total = sum of `paid_amount`; expense is "Paid" once `paid >= total - 0.01`, else "Partial".
- **Overpay guard** (`20260809_cap_expense_payments.sql`): before payment/extra insert,
  if `paid + newAmount > total + 0.01` raise `OVERPAY_EXCEEDS_EXPENSE` and reject.
- **Rollback on delete** (`delete_family_transaction`): reduce paid via `greatest(paid - amount, 0)`.
- **Invite codes** (`create_family`): loop generating random `FAMS-XXXX` until unique.

---

## 7. End-to-End Request Flows

**Voice entry:** UI transcript (OS speech) → `parseVoiceIntent` (Gemini, 15s, fallback) →
validated/coerced → route to pre-filled modal → save → `TransactionsContext.addTransaction` →
`lib/transactions.insertTransaction` → Supabase INSERT (RLS `auth.uid() = user_id`) → row
prepended → budgets/alerts recompute live.

**Receipt scan:** camera/gallery image → base64 → `parseReceiptFromImage` (Gemini, 30s,
fallback) → sanitized `ReceiptData` in Review UI → selected line items inserted one-by-one
as expense transactions → Success screen confirms count.

**Family expense:** AddExpenseModal (category, total, per-member amounts) →
`useFamilyFinance.addExpense` → `add_family_expense` RPC (atomic) → server trigger notifies
other members → client reloads `get_family_finance` snapshot → local notification confirms.

---

## 8. Repository Layout

```
finalert/
  app/                 expo-router routes (screens)
  components/          UI components & bottom-sheet modals (entry flows)
    family/            Family finance components + useFamilyFinance hook
  context/             React context providers (state + business flow)
  lib/                 Typed data-access layer (the only code that talks to Supabase) +
                       shared types/constants
  services/            Gemini client + voice/receipt intent services
  supabase/migrations/ SQL: schema, RLS policies, security-definer RPCs, triggers
  assets/              Images / icons / fonts
  .env                 EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY,
                       EXPO_PUBLIC_GEMINI_API_KEY (see .env.example)
  DESIGN.md            UI/design-system tokens (source of truth for styling)
  AGENTS.md            Backend-portability rules
```

### Key files map
| Concern | File |
|---|---|
| Backend client bootstrap | `lib/supabase.ts` |
| Auth | `context/AuthContext.tsx` |
| App wiring / auth gate / splash | `app/_layout.tsx` |
| Home dashboard | `app/(tabs)/index.tsx` |
| Transactions + budget limits | `app/(tabs)/transactions.tsx` |
| Family finance | `app/(tabs)/family.tsx` + `components/family/*` |
| Reports | `app/(tabs)/reports.tsx` |
| Alert centre | `app/notifications.tsx` |
| Gemini + fallback | `services/geminiClient.ts` |
| Voice / receipt parsing | `services/voiceIntentService.ts`, `services/receiptIntentService.ts` |

---

## 9. Build & Run

```bash
# env: copy .env.example → .env, fill SUPABASE_URL, SUPABASE_ANON_KEY, GEMINI_API_KEY
npm install          # runs patch-package postinstall
npm run start        # expo start (dev)
npm run android      # open on Android
```
Android APKs are produced via EAS (`eas.json`, project id in `app.json`).

---

## 10. Known Boundaries & Future Work
- **Planned / unbuilt:** AI Financial Assistant; Financial Health Score.
- **"AI" insight text is rule-based**, not a model. The Home insight banner is a static
  placeholder string.
- **Language row in Profile** is cosmetic/non-functional; app is light-mode only.
- **Onboarding screens / phone login / forgot-password** described in early design docs
  are NOT implemented — signup (name + email + password) goes straight to the dashboard.
- **Family budget** is computed as the sum of member limits; `create_family` takes only a name.
- **Role enforcement gap:** client-side "Dependent can't be assigned a share" rule.

For the full academic context (motivation, related work, user research, detailed methods),
see `report.md` / `report.txt` at the repository root. `flowchart.txt` contains the UX flow
plus an audit of inaccuracies vs. the actual code.