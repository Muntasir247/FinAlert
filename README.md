# FinAlert

> FinAlert is a cross-platform mobile app for personal and family money management.
> Log income and expenses (by form, voice, or receipt scan), set monthly budgets with
> per-category limits, track savings goals, manage a shared family expense pool, and
> receive smart real-time spending alerts.

---

## Features

- **Multi-modal entry** — record a transaction three ways:
  - **Form** — amount, category/source, date, optional description.
  - **Voice** — say *"Spent 500 taka on groceries."* and the app opens the right form pre-filled.
  - **Receipt scan** — photograph a receipt to extract merchant, date, total, category, and line items.
- **Budget planner** — sets monthly income + savings % and auto-allocates per-category limits (fully editable).
- **Live budget tracking** — per-category spent / limit / remaining / % used, updated live.
- **Smart alerts** — monthly budget threshold, category overrun, month-over-month increase, and daily-spike rules, deduplicated in an in-app alert centre.
- **Savings goals** — target amount + date, atomic contributions, milestone notifications.
- **Reports** — monthly/weekly toggle, income vs expense bar chart, category donut chart, savings rate.
- **Family Finance Module** — invite-code groups (Admin / Contributor / Dependent roles), shared expenses with per-member assigned amounts, settlement tracking, and contribution reports, with correctness enforced in the database.
- **Bilingual input** — accepts Bangla, English, and mixed Banglish speech and Bangla numerals.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo SDK 54, React Native 0.81.5 (new architecture) |
| Language / routing | TypeScript, Expo Router v6 (file-based) |
| UI / styling | React 19.1.0, NativeWind v4 (Tailwind CSS ^3.4.17) |
| Icons / charts / animation | @expo/vector-icons, react-native-svg, react-native-reanimated, expo-linear-gradient |
| Speech / camera / storage | expo-speech-recognition, expo-camera, expo-image-picker, expo-secure-store |
| Backend | Supabase — Auth, PostgREST, PostgreSQL with Row Level Security |
| AI language / vision | Google Gemini Flash / Flash-Lite (via REST) |
| Build | EAS (Android APK) |

## Getting Started

### Prerequisites
- Node.js
- An Expo / React Native development setup (Android Studio or a device, or EAS for APK builds)

### Setup

```bash
npm install
```

1. Copy the environment template and fill in your keys:
   ```bash
   cp .env.example .env
   ```
   Set these variables:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_GEMINI_API_KEY`

2. Apply the database schema and functions from `supabase/migrations/` to your Supabase project.

### Run

```bash
npm run start        # start the Metro bundler
npm run android      # open on Android
npm run ios          # open on iOS
npm run web          # open in a browser
```

To build an Android APK via EAS:
```bash
eas build --platform android --profile preview
```

## Project Structure

```
app/                 expo-router routes (screens)
components/          UI components & entry-flow modals
  family/            Family finance components + useFamilyFinance hook
context/             React context providers (state + business flow)
lib/                 Typed data-access layer (the only code that talks to Supabase)
services/            Gemini client + voice/receipt intent services
supabase/migrations/ SQL: schema, RLS policies, security-definer RPCs, triggers
assets/              Images, icons, fonts
```

## Architecture Notes

- **Provider-swappable backend.** The Supabase SDK is imported only in `lib/supabase.ts` and
  `context/AuthContext.tsx`. Screens and components consume context hooks and typed helpers,
  so the backend can be swapped without touching the UI. (See `AGENTS.md`.)
- **Business rules in SQL.** Schema, RLS policies, security-definer functions, and triggers
  live in `supabase/migrations/`. Multi-table guarantees (atomic expense creation, overpay
  guard, rollback on delete, admin-only edits) are enforced in the database.
- **Defensive AI pipeline.** Gemini output (voice intent / receipt extraction) is re-validated
  and sanitized client-side before it reaches the database (amounts, categories, dates, actions).
- **Model fallback.** Five Gemini Flash-tier models are chained so a rate-limited model falls
  back to the next, keeping voice and scan features available.

## Documentation

- [`UNDERSTANDING.md`](./UNDERSTANDING.md) — full orientation: what it is, features, architecture, data model, algorithms, and how it works.
- [`DESIGN.md`](../DESIGN.md) — UI/design-system tokens (text, color, gradient).
- [`AGENTS.md`](./AGENTS.md) — backend portability rules.
- Academic report: `report.md` / `report.txt` at the repository root.

## Known Boundaries

- The "AI Financial Assistant" and "Financial Health Score" are planned, not yet built.
- "AI" insight text is deterministic rule logic, not a predictive model.
- The Profile language row is cosmetic/non-functional; the app is light-mode only.
- The family budget is computed as the sum of per-member limits (`create_family` takes a name only).

## License

Private / academic project — East West University CSE capstone. No license is implied for
external use.