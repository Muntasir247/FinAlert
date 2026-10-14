# FinAlert — Comprehensive Developer & Architecture Guide

Welcome to **FinAlert**. This document is the definitive orientation and architectural reference for developers, engineers, and contributors. It covers everything needed to understand what FinAlert is, how it works under the hood, the mechanisms and algorithms behind its features, requirements, database invariants, and implementation patterns.

---

## Table of Contents
1. [Executive Overview & Vision](#1-executive-overview--vision)
2. [High-Level Architecture](#2-high-level-architecture)
   - [Three-Tier Architecture Model](#three-tier-architecture-model)
   - [Navigation & Route Hierarchy](#navigation--route-hierarchy)
   - [State Management & Provider Tree](#state-management--provider-tree)
3. [Technology Stack & System Requirements](#3-technology-stack--system-requirements)
4. [Design System & UI Boundaries (DESIGN.md)](#4-design-system--ui-boundaries-designmd)
5. [Backend Portability & Invariants (AGENTS.md)](#5-backend-portability--invariants-agentsmd)
6. [Core Features & Technical Mechanisms](#6-core-features--technical-mechanisms)
   - [6.1 Automated bKash SMS Ingestion Pipeline (Android)](#61-automated-bkash-sms-ingestion-pipeline-android)
   - [6.2 Bank Statement PDF Parser & ISO 32000 Decryption](#62-bank-statement-pdf-parser--iso-32000-decryption)
   - [6.3 AI-Driven Smart Budget Recommendations](#63-ai-driven-smart-budget-recommendations)
   - [6.4 Multi-Modal Expense Ingestion (Voice & Receipt Scan)](#64-multi-modal-expense-ingestion-voice--receipt-scan)
   - [6.5 Budget Planner & Live Spending Computation](#65-budget-planner--live-spending-computation)
   - [6.6 Smart Alert Engine](#66-smart-alert-engine)
   - [6.7 Savings Goals & Atomic Milestones](#67-savings-goals--atomic-milestones)
   - [6.8 Family Finance Module (Capstone Innovation)](#68-family-finance-module-capstone-innovation)
   - [6.9 Financial Reports & SVG Visualizations](#69-financial-reports--svg-visualizations)
7. [Database Schema, Functions & Row-Level Security](#7-database-schema-functions--row-level-security)
8. [File Structure & Directory Map](#8-file-structure--directory-map)
9. [Developer Setup, Running & Build Guide](#9-developer-setup-running--build-guide)
10. [Known Constraints & Future Roadmap](#10-known-constraints--future-roadmap)

---

## 1. Executive Overview & Vision

**FinAlert** is a cross-platform personal and family finance application built with **React Native (Expo SDK 54)** and powered by **Supabase (PostgreSQL with RLS)** and **Google Gemini Multimodal AI**.

### The Problem It Solves
Budgeting applications traditionally fail because **recording an expense requires effort now for an uncertain benefit in the future**. Users quickly abandon manual form entries. Furthermore, in many households (particularly across South Asia and Bangladesh), money management is **collective**—parents, working children, and relatives share household bills and groceries, a scenario standard solo-budgeting apps fail to support.

### The FinAlert Solution
1. **Frictionless Multi-Modal Ingestion:** Users log expenses via:
   - **Automated bKash SMS Ingestion** (Zero manual typing: reads official transaction SMS on Android).
   - **Bank Statement PDF Import** (Decrypted client-side and extracted into categorized line items via Gemini).
   - **Voice Entry** (Natural language Bangla, English, or Banglish transcribed locally and parsed into structured intents).
   - **Receipt Scanning** (High-speed optical parsing of merchant, items, and total via Gemini vision).
   - **Manual Quick Forms** (Intuitive manual entry with custom category emojis).
2. **Deterministic & AI Budgeting:** Dynamic 80/20 spending/saving allocations combined with personalized AI recommendations based on 90-day spending burn rates.
3. **Family Finance Module:** Shared household budgets, bill splitting, payment settlements, and SQL-enforced contribution quotas.
4. **Human-in-the-Loop Privacy:** No parsed AI or SMS transaction is ever saved to the database without explicit user confirmation.

---

## 2. High-Level Architecture

### Three-Tier Architecture Model

```
┌─────────────────────────────────────────────────────────────────┐
│                          CLIENT TIER                            │
│  React Native 0.81.5 (New Architecture) · Expo Router v6 (File) │
│  NativeWind v4 · React 19 · React Native Reanimated             │
│  State: Context Providers (Auth, Tx, Budgets, Goals, Family)    │
└──────────────┬──────────────────────────────────┬───────────────┘
               │                                  │
               ▼                                  ▼
┌───────────────────────────────┐  ┌──────────────────────────────┐
│       EXTERNAL SERVICES       │  │        BACKEND TIER          │
│ • Local OS Speech Engine      │  │ • Supabase Auth (GoTrue)     │
│   (bn-BD, en-US on-device)    │  │ • PostgreSQL 15+ (PostgREST) │
│ • Google Gemini REST API      │  │ • Row Level Security (RLS)   │
│   (Flash & Flash-Lite Models) │  │ • Security-Definer RPCs      │
│ • Android SMS ContentResolver │  │ • Automated Triggers         │
└───────────────────────────────┘  └──────────────────────────────┘
```

1. **Client Tier:** React Native components strictly consume React Context hooks. Components *never* import `@supabase/supabase-js` or execute raw database queries directly.
2. **Backend Tier:** PostgreSQL holds all business invariants, access control (RLS), atomic increment logic, and notification triggers.
3. **External Services Tier:** Multimodal models and native device sensors. Audio never leaves the device for speech-to-text; only transcripts or sanitized Base64 payloads are sent to Gemini.

---

### Navigation & Route Hierarchy

FinAlert uses **Expo Router v6** (file-based navigation with typed routes):

```
app/
├── _layout.tsx           # Global Root: Provider cascade, splash lock (2.5s), Auth Gate
├── index.tsx             # Landing Screen (Redirects to /(tabs) if authenticated)
├── notifications.tsx     # In-App Notification & Alert Centre
├── (auth)/
│   ├── _layout.tsx       # Auth stack navigator
│   ├── login.tsx         # Email + password authentication
│   └── signup.tsx        # Registration (Full Name, Email, Password)
└── (tabs)/
    ├── _layout.tsx       # Bottom navigation bar (5 persistent tabs)
    ├── index.tsx         # Home Dashboard (Balance, Ingestion triggers, Budgets, Goals)
    ├── transactions.tsx  # Dual-View: Transaction Ledger & Budget Limits
    ├── family.tsx        # Family Finance (Overview, Members, Shared Bills, Settlements)
    ├── reports.tsx       # Financial Analytics (Income/Expense Bar Chart, Category Donut)
    └── profile.tsx       # User Profile, Monthly Metrics, Preferences & Logout
```

---

### State Management & Provider Tree

State is structured hierarchically in `app/_layout.tsx`:

```tsx
<AuthProvider>
  <TransactionsProvider>
    <NotificationsProvider>
      <BudgetsProvider>
        <SavingsGoalsProvider>
          <FamilyProvider>
            <SafeAreaProvider>
              <StatusBar style="dark" />
              <NavigationLayout />
              <BudgetSetupModal />
            </SafeAreaProvider>
          </FamilyProvider>
        </SavingsGoalsProvider>
      </BudgetsProvider>
    </NotificationsProvider>
  </TransactionsProvider>
</AuthProvider>
```

- **`AuthProvider`**: Manages GoTrue session, profile metadata (`profiles` table), and auth transitions.
- **`TransactionsProvider`**: Manages transaction ledger, optimistic updates, and TrxID deduplication sync.
- **`NotificationsProvider`**: In-app notifications feed, unread badge counter, and DB-backed dismissals.
- **`BudgetsProvider`**: Active budget plan, live spending aggregation, smart alert evaluator, and self-healing monthly income transaction sync.
- **`SavingsGoalsProvider`**: Targets, atomic DB contributions, demo seeds, and 20% milestone notifications.
- **`FamilyProvider`**: Family membership state, active family entity, and invite code operations.

---

## 3. Technology Stack & System Requirements

| Category | Technology | Version / Specification |
|---|---|---|
| **Core Framework** | Expo SDK | `~54.0.35` (New Architecture enabled) |
| **Mobile Runtime** | React Native | `0.81.5` |
| **Language** | TypeScript | `~5.9.2` |
| **UI Library** | React | `19.1.0` |
| **Styling** | NativeWind / TailwindCSS | NativeWind `^4.2.1` / Tailwind `^3.4.17` |
| **Routing** | Expo Router | `~6.0.24` (File-based) |
| **Database & Auth**| Supabase | `@supabase/supabase-js ^2.112.0` (PostgreSQL 15+) |
| **AI / Multimodal** | Google Gemini | REST API (Flash & Flash-Lite fallback series) |
| **Speech** | Expo Speech Recognition | `^3.1.3` (On-device Google / Apple Speech) |
| **Camera & Media** | Expo Camera / Image Picker | `~17.0.10` / `~17.0.11` |
| **PDF Processing** | pdf-lib & @pdfsmaller | `pdf-lib ^1.17.1` + `@pdfsmaller/pdf-decrypt ^1.0.1` |
| **Local Storage** | Expo SecureStore | `~15.0.8` (Hardware-backed encrypted storage) |
| **Custom Module** | Android SMS Reader | Custom Expo Native Module (`modules/sms-reader`) |

### Device Permissions Required
- `android.permission.READ_SMS` & `RECEIVE_SMS` (For automated bKash ingestion).
- `android.permission.CAMERA` (For invoice/receipt camera scanning).
- `android.permission.RECORD_AUDIO` (For voice-to-intent logging).

---

## 4. Design System & UI Boundaries (`DESIGN.md`)

All screens and components strictly adhere to `DESIGN.md`. Hardcoded raw hex codes and raw font sizes are avoided in favor of NativeWind utility tokens.

### Typography System
- **Title**: `text-[20px] leading-[22px] font-bold` (Headers & main balances)
- **Subtitle**: `text-[16px] font-medium` (Section headings, modal sub-headers)
- **Subtext**: `text-[14px] font-normal` (Captions, labels, table meta)
- **Paragraph**: `text-[13px] leading-[15px] font-normal` (Body copy, descriptions)

### Color Palette Tokens
| Token Name | Hex Code | Purpose |
|---|---|---|
| `main-theme` | `#0FB384` | Primary brand accent (Mint Green) |
| `green-black` | `#081E15` | Dark mode background / deep container |
| `dark-bg` | `#0F2C20` | Dark theme card background |
| `light-letters` | `#FFFFFF` | High contrast white text & icons |
| `green-bar` | `#0C2B1F` | Dark mode borders and nav dividers |
| `light-green` | `#E8F7F1` | Secondary brand tint / success highlight |
| `green-white` | `#F4FBF7` | Primary light mode background |
| `light-bg-text` | `#091E15` | Primary high-contrast text on light BG |
| `light-bg-shade`| `#6B7280` | Secondary low-contrast text on light BG |
| `alt-accent` | `#0068FF` | Vibrant blue for links & focus states |
| `ai-purple` | `#7C3AED` | AI insight badges, sparkles & recommendation cards |

### Accessibility Rules
- **Minimum Tap Target:** At least `48x48dp` for all touchable surfaces (`hitSlop` used for compact icons).
- **No HTML Elements:** Strictly React Native primitives (`View`, `Text`, `TouchableOpacity`, `ScrollView`, `TextInput`).

---

## 5. Backend Portability & Invariants (`AGENTS.md`)

To guarantee the project can migrate away from Supabase to any custom PostgreSQL/Node.js backend with minimal friction, the codebase enforces strict boundaries:

1. **Centralized Backend:** `@supabase/supabase-js` is imported **ONLY** in `lib/supabase.ts` and `context/AuthContext.tsx`.
2. **Zero SDK Leakage:** Components import domain types defined in `lib/` (e.g., `Transaction`, `Budget`, `Profile`), never Supabase-generated database types.
3. **Logic in SQL, Not JavaScript:** Multi-table operations, constraints, overpayment guards, and atomicity are governed by PostgreSQL RPC functions and triggers in `supabase/migrations/`.
4. **Abstracted Queries:** Screens never invoke database queries inline. They use exported helper functions in `lib/` via React Context hooks.
5. **Standard SQL Patterns:** Schema uses portable standard PostgreSQL constructs (triggers, foreign keys, numeric scales, JSON aggregates).

---

## 6. Core Features & Technical Mechanisms

### 6.1 Automated bKash SMS Ingestion Pipeline (Android)

Automated Mobile Financial Services (MFS) transaction tracking is built specifically for the Bangladeshi ecosystem.

```
┌─────────────────────────┐
│ Android SMS Inbox       │
│ Sender: bKash / 16247   │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Expo Native Module      │  Query Android ContentResolver
│ (modules/sms-reader)    │  Filter by address/sender & timestamp
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Regex Parsing Engine    │  Match TrxID, Amount, Date, Counterparty
│ (smsReaderService.ts)   │  Auto-categorize via Keyword Dictionary
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Deduplication Engine    │  Compare with SecureStore & DB transactions
│ (SecureStore + Memory)  │  Discard already processed TrxIDs
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ In-App Detected Banner  │  Human-in-the-loop review modal
│ (BKashDetectedBanner)   │  User verifies & commits to Supabase
└─────────────────────────┘
```

#### The Native Android Bridge
Implemented in `modules/sms-reader` using Expo Modules API:
- Accesses `Telephony.Sms.Inbox` via Android `ContentResolver`.
- Retrieves `address`, `body`, and `date` epoch without external dependencies.

#### Regex Patterns Handled
- **Merchant Payments:** `Payment Tk ([\d,.]+) to ([^.]+)` -> Expense (`Food & Dining`, `Grocery`, etc.).
- **Cash Out:** `Cash Out Tk ([\d,.]+) to ([^.]+)` -> Expense (`Other` / ATM).
- **Send Money:** `Send Money Tk ([\d,.]+) to ([^.]+)` -> Expense (`Other` / Transfers).
- **Mobile Recharge:** `Mobile Recharge Tk ([\d,.]+) to ([^.]+)` -> Expense (`Bills & Utilities`).
- **Cash In / Receive Money:** `Cash In Tk ([\d,.]+) from ([^.]+)` or `Received Tk ([\d,.]+) from ([^.]+)` -> Income.
- **TrxID Extraction:** `/(?:Trx\s*ID|Txn\s*ID|Transaction\s*ID)\s*[:.]?\s*([A-Za-z0-9]+)/i`.

#### Anti-Duplicate Engine
1. **Local Persistent Cache:** Last 300 processed `TrxID`s stored in `expo-secure-store`.
2. **Database Cross-Sync:** On application launch or user sync, `syncProcessedTrxIdsFromTransactions()` parses descriptions of all existing database transactions. Any previously imported `TrxID` is permanently cached so reinstalls do not re-prompt past transactions.

---

### 6.2 Bank Statement PDF Parser & ISO 32000 Decryption

Allows users to upload official monthly bank statements (City Bank, BRAC Bank, DBBL, EBL, SCB, etc.) and automatically extract every debit and credit.

#### Handling Password-Protected Statements
Bank statements in Bangladesh are almost always password-protected PDFs (using DOB `DDMMYYYY`, phone number, or TIN).
- **Decryption Engine (`services/pdfDecryptor.ts`):** Implements ISO 32000 standard decryption:
  - **AES-128 (V=4, R=4)** per ISO 32000-1.
  - **AES-256 (V=5, R=6)** per ISO 32000-2.
  - **RC4 40-bit / 128-bit (V=1-2, R=2-3)**.
- If a PDF has an `/Encrypt` dictionary, the app detects it, prompts for the password, decrypts the byte array in memory, and validates with `pdf-lib` without leaking plain bytes to disk.

#### Gemini Multimodal PDF Extraction
- The decrypted PDF is converted to Base64 and sent to Gemini via REST using the `application/pdf` inline MIME type.
- **Strict Schema Enforcement:** Gemini extracts metadata (`bank_name`, `statement_period`) and an array of transactions (`date`, `description`, `type: debit|credit`, `amount`, `category`).
- **Client-Side Normalization:**
  - Debits map to `expense`; Credits map to `income`.
  - Non-standard categories are coerced to standard tokens (`Bills & Utilities`, `Food & Dining`, `Grocery`, `Transport`, `Health`, `Shopping`, `Entertainment`, `Other`).
  - Dates outside range are validated and clamped.
- **Interactive Review UI (`BankStatementReviewModal.tsx`):** Users view total debits vs. credits, toggle individual line items, modify categories, and import batch selections in a single atomic database insert.

---

### 6.3 AI-Driven Smart Budget Recommendations

Rather than using generic static numbers, FinAlert includes an intelligent budget generator powered by **Gemini 1.5 Flash** and user habit analytics.

1. **Analytics Aggregator (`spendingAnalyticsService.ts`):**
   - Fetches the past 90 days of ledger entries.
   - Computes:
     - Average monthly income and expense burn rate.
     - Net historical savings rate.
     - Per-category spending totals and percentages.
     - Active savings goals and capital deficit.
2. **AI Recommendation Engine (`aiBudgetService.ts`):**
   - Evaluates spending against active savings targets.
   - Balances discipline with realism (e.g., trims high dining expenses gently by 15% rather than slashing unrealistically).
   - Guarantees the 8 categories sum to **exactly 100%** of the spending budget.
   - Returns a structured strategic insight headline, contextual reasoning, and 3 actionable tips for living in Bangladesh (e.g., bKash cashbacks, rideshare carpooling).
3. **50/30/20 Fallback Algorithm:** If transaction history is fewer than 3 items or if API rate limits occur, the engine gracefully falls back to the deterministic 50/30/20 rule (50% Needs, 30% Wants, 20% Savings).

---

### 6.4 Multi-Modal Expense Ingestion (Voice & Receipt Scan)

#### Voice Intent Parsing Engine
- **Speech Capture:** Uses `expo-speech-recognition` on-device (zero audio transmitted to external servers). Supports `bn-BD` (Bangla) and `en-US` (English).
- **Bangla Numerals & Banglish Normalization:** Handles colloquial phrasing:
  - *"আজকে রিকশা ভাড়া দিলাম ৫০ টাকা"*
  - *"Spent 700 taka at Shwapno for grocery"*
  - *"৫০০০ টাকা ডিপিএস এ জমা দিয়েছি"*
- **Intent Classifier (`voiceIntentService.ts`):** Maps input into 6 explicit enum actions:
  `ADD_EXPENSE`, `ADD_INCOME`, `CREATE_SAVINGS_GOAL`, `ADD_SAVINGS_CONTRIBUTION`, `SET_BUDGET_LIMIT`, `UNKNOWN`.
- **Pre-filled Modal Routing:** Once parsed, the voice sheet dismisses and seamlessly opens the destination modal (`AddTransactionModal`, `SavingsGoalsManager`, or `BudgetSetupModal`) pre-filled with amount, category, and notes.

#### Receipt & Invoice Camera Scanner (`ScanInvoiceModal.tsx`)
- **Camera Capture:** `expo-camera` captures full-resolution receipt snapshots with live corner guide brackets and flash toggling.
- **Gallery Upload:** Alternative picker via `expo-image-picker`.
- **Gemini Multimodal Vision (`receiptIntentService.ts`):**
  - Extracts merchant name, transaction date, line items (name + unit price), and total sum.
  - Automatically handles handwritten and printed receipts from supermarkets, pharmacies, and restaurants.
- **Itemized Selection Checklist:** Users can uncheck individual items, adjust prices, or select the entire receipt total for single-tap logging.

---

### 6.5 Budget Planner & Live Spending Computation

#### Allocation Formula (`components/BudgetSetupModal.tsx`)
```ts
savingsAmount  = monthlyIncome * (savingsPercentage / 100) // Slider 5% - 50%
spendingBudget = monthlyIncome - savingsAmount

// Split across 8 categories (Fixed weights summing to 100%):
// Bills (30%), Food (18%), Grocery (12%), Transport (8%), Health (8%), Shopping (8%), Ent (6%), Other (10%)
allocatedAmount[i] = spendingBudget * (categoryPct[i] / 100)
```
- **Rounding Guard:** The final category is calculated as `spendingBudget - sum(previous 7)` to prevent 1-taka rounding discrepancies.

#### Live Usage Derivation (`lib/budgets.ts`)
```ts
monthKey = year * 100 + month
spent[category] = sum(transactions.where(date in currentMonth and type == 'expense'))
remaining = limit - spent
percentage_used = limit > 0 ? (spent / limit) * 100 : 0
```
- Fully memoized with `useMemo` in `BudgetsContext`, updating instantaneously whenever a transaction is added, edited, or deleted.

#### Self-Healing Income Sync
To prevent discrepancy between the budget setup income and the transaction ledger, `BudgetsContext` automatically verifies that an income transaction marked *"Monthly budget income"* exists for the current month. If none exists or the amount changed, it automatically updates or inserts the ledger record.

---

### 6.6 Smart Alert Engine

The alert engine runs deterministically inside `BudgetsContext.tsx` on every ledger modification. It checks 4 discrete rule types:

1. **Overall Monthly Budget Usage:**
   - 80% Threshold Reached -> Orange Alert (`review_budget`).
   - 100% Limit Exceeded -> Red High-Priority Alert (`review_spending`).
2. **Per-Category Overrun:**
   - `spent >= limit` for any category -> Direct warning citing exact overrun amount.
3. **Month-over-Month Spike:**
   - Current month category spending > Previous full month spending for that category.
4. **Daily Spending Velocity Spike:**
   - Category spending today >= `2x` the user's average daily pace for that category (`monthSpend / daysElapsed`).

*Deduplication:* Alerts are hashed by unique key `type_category_month` so a user is never bombarded with duplicate notifications.

---

### 6.7 Savings Goals & Atomic Milestones

- Goals track target amount, current amount, target date, icon, and custom color.
- **Concurrency & Atomicity:** Contributions execute via PostgreSQL RPC `add_savings_contribution(p_goal_id, p_amount)`. The database performs an atomic `UPDATE ... SET current_amount = current_amount + p_amount`, eliminating race conditions.
- **Milestone Engine:** Triggered in `SavingsGoalsContext.tsx`. Whenever a contribution crosses **20%, 40%, 60%, 80%, or 100%**, an celebratory notification is dispatched.

---

### 6.8 Family Finance Module (Capstone Innovation)

The Family Finance Module is FinAlert’s primary capstone extension, designed for multi-member collective households.

```
┌────────────────────────────────────────────────────────┐
│                        FAMILIES                        │
│ id, name, invite_code (FAMS-XXXX), created_at          │
└───────────────────────────┬────────────────────────────┘
                            │ 1:N
                            ▼
┌────────────────────────────────────────────────────────┐
│                     FAMILY MEMBERS                     │
│ id, family_id, user_id, role, monthly_limit            │
│ Roles: Admin | Contributor | Dependent                 │
└──────┬────────────────────┬────────────────────┬───────┘
       │                    │                    │
       ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│SHARED EXPENSE│    │ CONTRIBUTORS │    │ TRANSACTIONS │
│category,total│    │share, paid   │    │payment/extra │
└──────────────┘    └──────────────┘    └──────────────┘
```

#### Roles & Permissions Matrix
| Action | Admin | Contributor | Dependent | Enforced By |
|---|:---:|:---:|:---:|---|
| View Family Finances | Yes | Yes | Yes | SQL RLS |
| Add Shared Expense | Yes | Yes | Yes | SQL RPC |
| Make Payment / Settle Bill | Yes | Yes | Yes | SQL RPC |
| Be Assigned Expense Share | Yes | Yes | **No** | UI Validation |
| Change Member Roles / Limits | Yes | No | No | SQL RPC (`update_family_member_role`) |
| Edit / Delete Shared Expenses | Yes | No | No | SQL RPC (`update/delete_family_expense`) |
| Remove Members | Yes | No | No | SQL RPC (`remove_family_member`) |
| Set Own Monthly Limit | Yes | Yes | Yes | SQL RPC (`update_own_contribution`) |

#### Database Invariants & Integrity
1. **Invite Code Generation:** Random `FAMS-XXXX` code looped in PostgreSQL until unique.
2. **Single-Family Constraint:** A user can only belong to one family group at a time.
3. **Overpay Protection Guard (`20260809_cap_expense_payments.sql`):** When recording a payment, the RPC verifies `existing_paid + new_payment <= expense_total + 0.01`. If exceeded, it throws `OVERPAY_EXCEEDS_EXPENSE`.
4. **Cascade Rollback on Delete:** Deleting a transaction safely decrements the corresponding contributor's `paid_amount` using `greatest(paid_amount - amount, 0)`.
5. **Real-time Notifications via SQL Triggers:**
   - `notify_family_member_joined`: Automatically generates notifications for all members when someone joins via invite code.
   - `notify_family_expense_added`: Dispatches in-app alerts to other members when a shared bill is created.

---

### 6.9 Financial Reports & SVG Visualizations

Located in `app/(tabs)/reports.tsx`, completely native using `react-native-svg`:

1. **Monthly vs. Weekly Toggle:**
   - **Monthly:** 6-month historical window.
   - **Weekly:** Current calendar week (Monday to Sunday) segmented into 4 rolling weeks.
2. **Bar Chart (Income vs. Expense):**
   - Implements custom `niceCeil()` algorithm (scales Y-axis ticks to clean round numbers: 1k, 2k, 5k, 10k).
   - Dual-colored side-by-side bars (Mint Green `#0FB384` for income, Coral Red `#EF4444` for expense).
3. **Category Spending Donut Chart:**
   - Implemented with SVG `<Circle>` elements using calculated `strokeDasharray` and `strokeDashoffset`.
   - Displays top 5 expense categories with individual color coding and bundles remaining categories into "Other".
4. **Summary Metrics:** Net savings, savings rate `((income - expense) / income * 100)`, and rule-based diagnostic banners.

---

## 7. Database Schema, Functions & Row-Level Security

All database definitions are stored in `supabase/migrations/`:

### Core Tables Summary
| Table Name | Primary Key | Description | RLS Policy |
|---|---|---|---|
| `profiles` | `id (references auth.users)` | Full name, email, phone | User read/write own |
| `transactions` | `id (uuid)` | Income/Expense ledger records | User read/write own |
| `budgets` | `id (uuid)` | Active monthly plan & income | User read/write own |
| `category_budgets` | `id (uuid)` | Per-category allocation for a budget | User read/write own |
| `savings_goals` | `id (uuid)` | Target goals, dates, amounts | User read/write own |
| `notifications` | `id (uuid)` | In-app alerts, read status, CTAs | User read/write own |
| `families` | `id (uuid)` | Family groups & invite codes | Member access only |
| `family_members` | `id (uuid)` | Member links, roles, monthly limits| Member read, Admin write |
| `family_expenses` | `id (uuid)` | Shared family bills | Member read, RPC write |
| `family_expense_contributors`| `id (uuid)` | Per-member assigned & paid shares | Member read, RPC write |
| `family_transactions` | `id (uuid)` | Settlement & payment audit log | Member read, RPC write |

### Key Stored Procedures (Security-Definer RPCs)
- `create_family(p_name text)`: Creates family, generates unique code, assigns caller as Admin.
- `join_family(p_invite_code text)`: Validates code and enrolls caller as Contributor.
- `get_family_finance(p_family_id uuid)`: Returns full aggregated JSON snapshot (members, expenses, contributors, transactions) in a single round-trip.
- `add_family_expense(...)`: Atomic creation of expense header and member share allocations.
- `record_family_transaction(...)`: Enforces overpay check, updates contributor paid total, logs transaction.
- `add_savings_contribution(p_goal_id uuid, p_amount numeric)`: Atomic balance increment.

---

## 8. File Structure & Directory Map

```
a:/Capstone/finalert/
├── app/                              # Expo Router file-based screens
│   ├── (auth)/                       # Authentication screens (login, signup)
│   ├── (tabs)/                       # 5 Core Bottom-Tab screens
│   │   ├── index.tsx                 # Home Dashboard
│   │   ├── transactions.tsx          # Transactions Ledger & Budgets View
│   │   ├── family.tsx                # Family Finance Module
│   │   ├── reports.tsx               # Analytics, Bar & Donut Charts
│   │   └── profile.tsx               # Profile, Metrics, Preferences
│   ├── _layout.tsx                   # Root Layout, Providers, Splash, Auth Guard
│   ├── index.tsx                     # Landing Gateway
│   └── notifications.tsx             # Notification / Alert Centre
├── components/                       # Shared UI & Modal flows
│   ├── family/                       # Family Finance panels & useFamilyFinance hook
│   ├── AddTransactionModal.tsx       # Manual transaction bottom sheet
│   ├── BankStatementReviewModal.tsx  # PDF bank statement review & batch import
│   ├── BKashBatchReviewModal.tsx     # bKash SMS batch review & import
│   ├── BKashDetectedBanner.tsx       # Home screen SMS detection alert banner
│   ├── BKashSimulatorModal.tsx       # In-app SMS tester (for dev/simulators)
│   ├── BudgetSetupModal.tsx          # 3-Step Wizard + AI Smart Budget Generator
│   ├── CircularProgress.tsx          # SVG circular budget gauge
│   ├── SavingsGoalsManager.tsx       # Savings goals manager & contribution modal
│   ├── ScanInvoiceModal.tsx          # Camera & gallery receipt vision scanner
│   └── VoiceEntryModal.tsx           # Voice recognition audio sheet
├── context/                          # React State Contexts (Data abstraction)
│   ├── AuthContext.tsx               # Supabase Auth & Profile state
│   ├── BudgetsContext.tsx            # Budget limits, live spend, alert engine
│   ├── FamilyContext.tsx             # Family group membership & invite codes
│   ├── NotificationsContext.tsx      # In-app notifications & unread counter
│   ├── SavingsGoalsContext.tsx       # Savings goals, atomic adds, milestones
│   └── TransactionsContext.tsx       # Transaction CRUD & TrxID deduplication
├── lib/                              # Data access layer (ONLY place touching Supabase)
│   ├── budgets.ts                    # Budget DB queries & live calculation
│   ├── families.ts                   # Family membership DB helpers
│   ├── familyFinance.ts              # Family Finance RPC caller
│   ├── notifications.ts              # In-app notification queries
│   ├── savingsGoals.ts               # Savings goals DB queries
│   ├── supabase.ts                   # Supabase client bootstrap & initialization
│   ├── transactionCategories.ts      # Standard 8 categories, icons, colors
│   └── transactions.ts               # Ledger DB queries & historical fetchers
├── modules/
│   └── sms-reader/                   # Custom Expo Native Module for Android SMS inbox
├── services/                         # External AI & Parsing Services
│   ├── aiBudgetService.ts            # Gemini Smart Budget recommendations
│   ├── geminiClient.ts               # Multi-model Gemini REST client with fallbacks
│   ├── pdfDecryptor.ts               # ISO 32000 PDF Decryption (AES/RC4)
│   ├── pdfStatementService.ts        # PDF document extraction & category mapping
│   ├── receiptIntentService.ts       # Gemini Multimodal receipt vision parser
│   ├── smsReaderService.ts           # bKash regex engine, deduplication & permissions
│   ├── spendingAnalyticsService.ts   # 90-day spending burn rate & habit metrics
│   └── voiceIntentService.ts         # Bangla/English speech intent classification
├── supabase/
│   └── migrations/                   # 12 PostgreSQL SQL migration files
├── app.json                          # Expo configuration & plugins
├── DESIGN.md                         # Strict UI & token guidelines
├── AGENTS.md                         # Architectural rules & backend portability
└── tailwind.config.js                # NativeWind color tokens matching DESIGN.md
```

---

## 9. Developer Setup, Running & Build Guide

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **Package Manager**: `npm`
- **Android Studio & SDK**: If running local Android emulator or physical device build

### Environment Configuration
1. Navigate to the app directory:
   ```bash
   cd finalert
   ```
2. Create `.env` from template:
   ```bash
   cp .env.example .env
   ```
3. Populate the variables:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   EXPO_PUBLIC_GEMINI_API_KEY=your-gemini-api-key
   ```

### Running Locally (Development)
```bash
# 1. Install dependencies (runs patch-package automatically)
npm install

# 2. Start Expo dev server
npx expo start

# 3. For clean cache start:
npx expo start --clear
```

### Testing on Android Device via Expo Go
1. Install **Expo Go** from Google Play Store on your Android device.
2. In the terminal, press `s` to switch between LAN/Tunnel if needed.
3. Scan the terminal QR code using Expo Go.

> **Note on Native Features in Expo Go:**
> - Camera, Voice recognition, PDF decryption, and Gemini AI features work in Expo Go.
> - The native SMS reader module (`modules/sms-reader`) requires a native development build (`npx expo run:android`) or standalone APK. In Expo Go, use the built-in **bKash Simulator Modal** on the Home screen to test all SMS ingestion flows seamlessly!

---

### Building Standalone Android APK

#### Option A: Local Build via Gradle (Fastest & Free)
From PowerShell:
```powershell
cd finalert/android

# Set Java & Android paths (Adjust paths if installed elsewhere)
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

# Build Release APK
.\gradlew.bat assembleRelease
```
*Output location:*
`finalert/android/app/build/outputs/apk/release/app-release.apk`

#### Option B: Cloud Build via EAS (Expo Application Services)
```bash
# 1. Install EAS CLI globally & login
npm install -g eas-cli
eas login

# 2. Trigger preview APK build
eas build --platform android --profile preview
```

---

## 10. Known Constraints & Future Roadmap

1. **AI Insight Strings:** The insight banner on the Home dashboard is currently a static template; in a future release, it will hook into `spendingAnalyticsService.ts` for real-time proactive micro-tips.
2. **Dependent Role Assignment:** "Dependents cannot be assigned bill shares" is currently enforced in the client modal; a future migration will add a database check constraint inside `add_family_expense`.
3. **Single Family Membership:** Users can currently belong to only one family at a time. Multi-family workspaces (e.g., parental family + personal household) can be unlocked with schema extensions.
4. **Dark Mode Theme:** The color tokens in `DESIGN.md` include dark mode specifications (`green-black`, `dark-bg`); full app-wide dark mode styling can be activated in `tailwind.config.js` and component styles.

---

*FinAlert — Built for resilience, clarity, and collective financial well-being.*
