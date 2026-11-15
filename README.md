# FinAlert

> **Smart Personal & Family Money Management**  
> A high-performance cross-platform mobile application built with **React Native (Expo SDK 54)**, powered by **Supabase (PostgreSQL with RLS)**, and supercharged with **Google Gemini & Groq Multimodal AI**.

---

## 🌟 Key Features

### 1. Multi-Modal Expense & Income Ingestion
* **Automated bKash SMS Ingestion (Android):** Custom native module (`modules/sms-reader`) reads official transaction SMS, extracts TrxID, counterparty, and amounts, deduplicates against SecureStore and database history, and stages them for human-in-the-loop confirmation. (Includes an in-app SMS simulator for development and Expo Go).
* **Bank Statement PDF Parser & ISO 32000 Decryption:** Upload password-protected monthly bank statements (City Bank, BRAC, DBBL, EBL, SCB, etc.). Decrypts AES-128, AES-256, and RC4 encrypted PDFs on-device and extracts itemized debit/credit records via multimodal AI.
* **Voice-to-Intent Entry:** Local speech recognition (`expo-speech-recognition`) in Bangla (`bn-BD`) and English (`en-US`). Natural phrases (e.g., *"আজকে রিকশা ভাড়া দিলাম ৫০ টাকা"* or *"Spent 700 taka on groceries"*) are classified into structured transactions and pre-fill entry forms.
* **Receipt & Invoice Vision Scanner:** Snap a photo or choose from gallery. Google Gemini Vision extracts merchant names, dates, line items, and totals with per-item checkboxes.
* **Manual Quick Forms:** Intuitive manual entry with custom category icons and notes.

### 2. Family Finance Module (Capstone Innovation)
* **Invite-Code Households:** Create or join a family group via unique code (`FAMS-XXXX`).
* **Role-Based Access Control:** Admin, Contributor, and Dependent roles.
* **Collective Bill Splitting & Settlements:** Split shared expenses across members with individual contribution quotas and settlement tracking.
* **PostgreSQL-Enforced Correctness:** Atomicity, overpayment protection (`OVERPAY_EXCEEDS_EXPENSE`), delete rollbacks, and admin-only privileges enforced directly in database RPC functions and triggers.

### 3. AI-Powered Smart Budgeting & Advisory
* **Interactive FinAlert AI Assistant:** Ask questions about spending, budgets, and savings habits powered by Groq (Llama 3) and Google Gemini with token-optimized context aggregation.
* **AI-Driven Budget Recommendations:** Analyzes 90-day spending history to generate a realistic monthly plan with category allocations summing to exactly 100%, accompanied by actionable financial advice for living in Bangladesh.
* **Deterministic Fallback Engine:** Automatically falls back to the 50/30/20 budgeting rule if API quotas or network interruptions occur.
* **Live Budget Usage:** Real-time tracking of per-category spend, limits, remaining balance, and percentage used.

### 4. Smart Alerts, Savings Goals & Reports
* **Smart Alert Engine:** In-app notification center flagging monthly budget milestones (80%/100%), per-category overruns, month-over-month surges, and daily spending velocity spikes.
* **Savings Goals:** Create custom savings targets with target dates and track atomic progress with celebratory notifications at 20%, 40%, 60%, 80%, and 100% milestones.
* **Visual Reports & Analytics:** Interactive income vs. expense bar charts (with dynamic scaling) and category spending donut charts built natively with `react-native-svg`.

### 5. Personalization & Localization
* **Full Bilingual Support:** Seamless live toggle between English and Bangla across all navigation tabs, dashboards, profile preferences, and modals.
* **Dark / Light Theme:** Custom theme engine with high-contrast dark mode support.
* **Password Recovery:** Self-service password reset with email OTP verification.

---

## 🛠️ Technology Stack

| Layer | Technology | Description |
|---|---|---|
| **Framework** | Expo SDK 54 | React Native 0.81.5 (New Architecture enabled) |
| **Language & Routing** | TypeScript ~5.9.2 | Expo Router v6 (File-based navigation) |
| **Styling & UI** | NativeWind v4 / TailwindCSS 3.4 | Styled strictly according to `DESIGN.md` |
| **Backend & Database** | Supabase | PostgreSQL 15+, GoTrue Auth, Row Level Security (RLS) |
| **AI & Multimodal Vision** | Google Gemini & Groq | Flash/Flash-Lite models (REST) & Groq Llama 3 API |
| **Speech Engine** | Expo Speech Recognition | On-device Google Speech / Apple Speech Recognition |
| **PDF Processing** | pdf-lib & @pdfsmaller/pdf-decrypt | Client-side ISO 32000 AES/RC4 decryption |
| **Native Modules** | Custom Expo Native Module | `modules/sms-reader` (Android ContentResolver) |
| **Icons & Charts** | Vector Icons & react-native-svg | Feather, Ionicons, custom SVG visualization |
| **Secure Storage** | Expo SecureStore | Hardware-backed encrypted key/cache storage |

---

## 🚀 Getting Started

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **npm**: v9+
* **Expo Go** or **Android Studio & SDK** (for local emulator or native builds)

### 1. Installation
```bash
# Clone repository
git clone https://github.com/Muntasir247/FinAlert.git
cd FinAlert/finalert

# Install dependencies (runs patch-package postinstall)
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Populate the following variables:
```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# AI Services
EXPO_PUBLIC_GEMINI_API_KEY=your-gemini-api-key
EXPO_PUBLIC_GROQ_API_KEY=your-groq-api-key # Optional but recommended for ultra-fast chat/budget generation
```

### 3. Database Setup
Apply all 14 SQL migration scripts in `supabase/migrations/` sequentially to your Supabase PostgreSQL instance.

### 4. Running Development Server
```bash
# Start Metro bundler
npx expo start

# Run with cleared cache
npx expo start -c
```
* **Expo Go:** Scan the QR code with the Expo Go app on your physical device. *(Note: For bKash SMS reading in Expo Go, use the built-in **bKash Simulator** on the Home screen).*
* **Android Emulator / Device:** `npm run android`

---

## 📦 Building Standalone Android Release (APK)

### Option A: Local Build via Gradle (Recommended)
```powershell
cd android

# Set environment variables (adjust paths as needed)
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

# Build optimized release APK (~41MB for arm64-v8a)
.\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a
```
*Generated APK:* `android/app/build/outputs/apk/release/FinAlertv1.4.apk`

### Option B: Cloud Build via EAS
```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

---

## 🏛️ Architecture & Portability Invariants

FinAlert strictly enforces clean separation of concerns as mandated by `AGENTS.md`:
1. **Centralized Backend:** `@supabase/supabase-js` is imported **only** in `lib/supabase.ts` and `context/AuthContext.tsx`. UI components consume domain hooks and functions from `context/` and `lib/`.
2. **Zero SDK Leakage:** Screens and components strictly use application domain types (e.g., `Transaction`, `Budget`, `Profile`).
3. **Invariants in SQL:** Atomicity, overpayment protection, and role permissions are enforced in PostgreSQL RPC functions and triggers, ensuring standard SQL migrations.
4. **Defensive AI Pipeline:** All external AI outputs (voice, receipts, budgets) undergo strict client-side type-coercion, boundary clamping, and sanitization before hitting database layers.

---

## 📚 Project Documentation

* [`UNDERSTANDING.md`](../UNDERSTANDING.md) — Comprehensive technical architecture, algorithms, and data dictionary.
* [`DESIGN.md`](../DESIGN.md) — UI/UX design tokens, typography rules, and color palettes.
* [`AGENTS.md`](./AGENTS.md) — Architectural invariants and backend portability directives.
* [`Capstone_final_report.md`](../Capstone_final_report.md) — Academic capstone final report, test catalogue (29 test cases), and defect registers.

---

## 👥 Contributors & Academic Context

**FinAlert** is developed as a Computer Science & Engineering Capstone Project at **East West University, Dhaka, Bangladesh (2026)**:
* **Students:** Md. Malek Hossain Jim, Sumaiya Jannat Arpa, Tasmia Rahman, Muntasir Hossain
* **Supervisor:** Dr. Taskeed Jabid
