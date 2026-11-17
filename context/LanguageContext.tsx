import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import * as SecureStore from 'expo-secure-store';

export type Language = 'en' | 'bn';

export interface Translations {
  tabs: {
    home: string;
    transactions: string;
    family: string;
    reports: string;
    profile: string;
  };
  profile: {
    title: string;
    preferences: string;
    language: string;
    current_language: string;
    notifications: string;
    dark_mode: string;
    account: string;
    security: string;
    help_support: string;
    logout: string;
    version: string;
    transactions_stat: string;
    this_month_stat: string;
    saved_stat: string;
    select_language: string;
    english: string;
    bangla: string;
    security_title: string;
    security_sub: string;
    support_title: string;
    support_sub: string;
    got_it: string;
    e2e_title: string;
    e2e_desc: string;
    rls_title: string;
    rls_desc: string;
    otp_title: string;
    otp_desc: string;
    device_hygiene_title: string;
    device_hygiene_desc: string;
    expense_logging_title: string;
    expense_logging_desc: string;
    family_sharing_title: string;
    family_sharing_desc: string;
    budget_tracking_title: string;
    budget_tracking_desc: string;
    support_contact_title: string;
    support_contact_desc: string;
    permission_required: string;
    notif_permission_msg: string;
    notif_enabled_title: string;
    notif_enabled_body: string;
    tracked_providers: string;
    select_providers_title: string;
    select_providers_prompt: string;
    save_selection: string;
    all_providers: string;
    none_selected: string;
    provider_bkash: string;
    provider_nagad: string;
    provider_rocket: string;
    provider_upay: string;
  };
  home: {
    sms_detection: string;
    sms_detection_sub: string;
    greeting: string;
    total_balance: string;
    monthly_income: string;
    monthly_expense: string;
    monthly_budget: string;
    budget_left: string;
    spent: string;
    quick_actions: string;
    action_add: string;
    action_scan: string;
    action_voice: string;
    action_insight: string;
    savings_goals: string;
    add_goal: string;
    no_goals: string;
    recent_transactions: string;
    view_all: string;
    no_transactions: string;
    tap_plus_to_start: string;
    saved: string;
  };
  transactions: {
    title: string;
    tab_transactions: string;
    tab_budget: string;
    filter_all: string;
    filter_income: string;
    filter_expense: string;
    search_placeholder: string;
    add_transaction: string;
    empty_search: string;
    no_transactions_filter: string;
    delete_confirm: string;
    delete_msg: string;
    delete: string;
    cancel: string;
    total_budget: string;
    spent_of: string;
    category_budgets: string;
    edit_budget: string;
    setup_budget: string;
    no_budget_title: string;
    no_budget_desc: string;
  };
  family: {
    title: string;
    subtab_overview: string;
    subtab_members: string;
    subtab_expenses: string;
    subtab_transactions: string;
    invite_member: string;
    family_budget: string;
    settle_up: string;
    no_family: string;
    create_or_join: string;
  };
  reports: {
    title: string;
    monthly: string;
    weekly: string;
    total_spent: string;
    net_savings: string;
    category_breakdown: string;
    income_vs_expense: string;
    no_data: string;
  };
  notifications: {
    title: string;
    mark_all_read: string;
    clear_all: string;
    filter_all: string;
    filter_budget: string;
    filter_bills: string;
    filter_savings: string;
    filter_family: string;
    empty_title: string;
    empty_desc: string;
  };
  common: {
    save: string;
    close: string;
    done: string;
    confirm: string;
    loading: string;
    error: string;
    success: string;
  };
  categories: Record<string, string>;
}

const EN: Translations = {
  tabs: {
    home: 'Home',
    transactions: 'Transactions',
    family: 'Family',
    reports: 'Reports',
    profile: 'Profile',
  },
  profile: {
    title: 'Profile',
    preferences: 'PREFERENCES',
    language: 'Language',
    current_language: 'English',
    notifications: 'Notifications',
    dark_mode: 'Dark Mode',
    account: 'ACCOUNT',
    security: 'Security',
    help_support: 'Help & Support',
    logout: 'Logout',
    version: 'Version',
    transactions_stat: 'Transactions',
    this_month_stat: 'This Month',
    saved_stat: 'Saved',
    select_language: 'Select Language',
    english: 'English',
    bangla: 'বাংলা (Bangla)',
    security_title: 'Security & Privacy',
    security_sub: 'How we protect your financial data',
    support_title: 'Help & Support',
    support_sub: 'Helpful tips & app guidance',
    got_it: 'Got It',
    e2e_title: 'End-to-End Encryption',
    e2e_desc: 'Transactions and user credentials are encrypted with TLS protocols and cryptographic hashing.',
    rls_title: 'Row-Level Isolation (RLS)',
    rls_desc: 'Financial data and budgets are strictly isolated in Postgres — accessible only to you and confirmed family members.',
    otp_title: 'OTP Recovery Protection',
    otp_desc: 'Password resets are secured with temporary 6-digit verification codes sent directly to your email.',
    device_hygiene_title: 'Device Hygiene',
    device_hygiene_desc: 'We recommend using biometric lock (Fingerprint or Face ID) or a PIN on your device for enhanced local protection.',
    expense_logging_title: 'Quick Expense Logging',
    expense_logging_desc: 'Tap the central (+) action button or use Voice Input to log expenses instantly with automatic AI classification.',
    family_sharing_title: 'Family Sharing',
    family_sharing_desc: 'Create or join a family circle to monitor joint budgets, split expenses, and view household analytics.',
    budget_tracking_title: 'Budget Tracking & Alerts',
    budget_tracking_desc: 'Set category spending thresholds to receive real-time notifications before exceeding monthly caps.',
    support_contact_title: 'Direct Support',
    support_contact_desc: 'Need assistance or have feedback? Reach out to our dedicated support team at adormuntasir@gmail.com.',
    permission_required: 'Permission Required',
    notif_permission_msg: 'FinAlert needs notification permission to show alerts on your phone dashboard. Please enable notifications in your device Settings.',
    notif_enabled_title: 'Notifications Enabled',
    notif_enabled_body: 'You will now receive timely alerts for budgets and transactions.',
    tracked_providers: 'Tracked Providers',
    select_providers_title: 'Transaction Providers',
    select_providers_prompt: 'Choose providers to track expenses:',
    save_selection: 'Save Selection',
    all_providers: 'All Providers',
    none_selected: 'None Selected',
    provider_bkash: 'bKash',
    provider_nagad: 'Nagad',
    provider_rocket: 'Rocket',
    provider_upay: 'Upay',
  },
  home: {
    sms_detection: 'SMS Detection',
    sms_detection_sub: 'bKash, Nagad, Rocket, Upay',
    greeting: 'Hello,',
    total_balance: 'Total Balance',
    monthly_income: 'Income',
    monthly_expense: 'Expenses',
    monthly_budget: 'Monthly Budget',
    budget_left: 'Left',
    spent: 'spent',
    quick_actions: 'QUICK ACTIONS',
    action_add: 'Add',
    action_scan: 'Scan',
    action_voice: 'Voice',
    action_insight: 'Insight',
    savings_goals: 'SAVINGS GOALS',
    add_goal: 'Add Goal',
    no_goals: 'No savings goals set yet',
    recent_transactions: 'RECENT TRANSACTIONS',
    view_all: 'View All',
    no_transactions: 'No transactions recorded yet',
    tap_plus_to_start: 'Tap + below to add your first expense',
    saved: 'saved',
  },
  transactions: {
    title: 'Transactions',
    tab_transactions: 'Transactions',
    tab_budget: 'Budget',
    filter_all: 'All',
    filter_income: 'Income',
    filter_expense: 'Expense',
    search_placeholder: 'Search transactions...',
    add_transaction: 'Add Transaction',
    empty_search: 'No transactions found',
    no_transactions_filter: 'No transactions for this filter',
    delete_confirm: 'Delete Transaction?',
    delete_msg: 'Are you sure you want to delete this transaction?',
    delete: 'Delete',
    cancel: 'Cancel',
    total_budget: 'Total Budget',
    spent_of: 'spent of',
    category_budgets: 'Category Budgets',
    edit_budget: 'Edit Budget',
    setup_budget: 'Setup Budget',
    no_budget_title: 'No Budget Set Yet',
    no_budget_desc: 'Set a monthly budget to track your spending and keep finances in check.',
  },
  family: {
    title: 'Family Hub',
    subtab_overview: 'Overview',
    subtab_members: 'Members',
    subtab_expenses: 'Expenses',
    subtab_transactions: 'Transactions',
    invite_member: 'Invite Member',
    family_budget: 'Family Shared Budget',
    settle_up: 'Settle Up',
    no_family: 'No Family Joined',
    create_or_join: 'Create or join a family circle to get started',
  },
  reports: {
    title: 'Reports',
    monthly: 'Monthly',
    weekly: 'Weekly',
    total_spent: 'Total Spent',
    net_savings: 'Net Savings',
    category_breakdown: 'Category Breakdown',
    income_vs_expense: 'Income vs Expenses',
    no_data: 'No spending data available for this period',
  },
  notifications: {
    title: 'Notifications',
    mark_all_read: 'Mark all as read',
    clear_all: 'Clear all',
    filter_all: 'All',
    filter_budget: 'Budget',
    filter_bills: 'Bills',
    filter_savings: 'Savings',
    filter_family: 'Family',
    empty_title: 'No notifications yet',
    empty_desc: 'We will alert you about unusual spending, bills, budget caps, and savings goals.',
  },
  common: {
    save: 'Save',
    close: 'Close',
    done: 'Done',
    confirm: 'Confirm',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
  },
  categories: {
    'Food & Dining': 'Food & Dining',
    'Groceries': 'Groceries',
    'Transportation': 'Transportation',
    'Shopping': 'Shopping',
    'Entertainment': 'Entertainment',
    'Bills & Utilities': 'Bills & Utilities',
    'Health & Medical': 'Health & Medical',
    'Education': 'Education',
    'Travel': 'Travel',
    'Salary': 'Salary',
    'Investment': 'Investment',
    'Gifts & Donations': 'Gifts & Donations',
    'Others': 'Others',
  },
};

const BN: Translations = {
  tabs: {
    home: 'হোম',
    transactions: 'লেনদেন',
    family: 'পরিবার',
    reports: 'রিপোর্ট',
    profile: 'প্রোফাইল',
  },
  profile: {
    title: 'প্রোফাইল',
    preferences: 'পছন্দসমূহ',
    language: 'ভাষা',
    current_language: 'বাংলা',
    notifications: 'বিজ্ঞপ্তি',
    dark_mode: 'ডার্ক মোড',
    account: 'অ্যাকাউন্ট',
    security: 'নিরাপত্তা',
    help_support: 'সাহায্য ও সহায়তা',
    logout: 'লগআউট',
    version: 'সংস্করণ',
    transactions_stat: 'মোট লেনদেন',
    this_month_stat: 'এই মাসে',
    saved_stat: 'সঞ্চয়',
    select_language: 'ভাষা নির্বাচন করুন',
    english: 'English (ইংরেজি)',
    bangla: 'বাংলা (Bangla)',
    security_title: 'নিরাপত্তা ও গোপনীয়তা',
    security_sub: 'আমরা কীভাবে আপনার আর্থিক তথ্য সুরক্ষিত রাখি',
    support_title: 'সাহায্য ও সহায়তা',
    support_sub: 'প্রয়োজনীয় পরামর্শ ও অ্যাপ নির্দেশিকা',
    got_it: 'বুঝেছি',
    e2e_title: 'এন্ড-টু-এন্ড এনক্রিপশন',
    e2e_desc: 'লেনদেন ও ব্যবহারকারীর তথ্য TLS প্রোটোকল ও ক্রিপ্টোগ্রাফিক হ্যাশিং দ্বারা সুরক্ষিত।',
    rls_title: 'রো-লেভেল নিরাপত্তা (RLS)',
    rls_desc: 'আর্থিক তথ্য ও বাজেট পোস্টগ্রেস ডাটাবেসে সম্পূর্ণ সুরক্ষিত — শুধুমাত্র আপনি ও অনুমোদিত সদস্যরা দেখতে পাবেন।',
    otp_title: 'OTP পুনরুদ্ধার নিরাপত্তা',
    otp_desc: 'পাসওয়ার্ড রিসেট আপনার ইমেইলে প্রেরিত ৬ সংখ্যার সাময়িক ভেরিফিকেশন কোড দিয়ে সুরক্ষিত।',
    device_hygiene_title: 'ডিভাইস নিরাপত্তা',
    device_hygiene_desc: 'উন্নত সুরক্ষার জন্য আপনার ডিভাইসে বায়োমেট্রিক লক (আঙুলের ছাপ বা ফেস আইডি) বা পিন ব্যবহারের পরামর্শ দেওয়া হচ্ছে।',
    expense_logging_title: 'দ্রুত খরচ যুক্তকরণ',
    expense_logging_desc: 'খরচ সাথে সাথে যুক্ত করতে নিচের (+) বাটনে চাপুন অথবা এআই ভয়েস ইনপুট ব্যবহার করুন।',
    family_sharing_title: 'পারিবারিক শেয়ারিং',
    family_sharing_desc: 'যৌথ বাজেট পর্যবেক্ষণ ও খরচের হিসাব রাখতে ফ্যামিলি সার্কেলে যোগ দিন।',
    budget_tracking_title: 'বাজেট ট্র্যাকিং ও অ্যালার্ট',
    budget_tracking_desc: 'মাসিক সীমা অতিক্রম করার আগেই রিয়েল-টাইম নোটিফিকেশন পেতে বাজেট সেট করুন।',
    support_contact_title: 'সরাসরি সহায়তা',
    support_contact_desc: 'সাহায্য বা মতামতের প্রয়োজন হলে আমাদের সাপোর্ট টিমে যোগাযোগ করুন: adormuntasir@gmail.com।',
    permission_required: 'অনুমতি প্রয়োজন',
    notif_permission_msg: 'আপনার ফোনের ড্যাশবোর্ডে অ্যালার্ট দেখাতে ফিনঅ্যালার্টের নোটিফিকেশন অনুমতি প্রয়োজন। অনুগ্রহ করে ডিভাইস সেটিংস থেকে নোটিফিকেশন চালু করুন।',
    notif_enabled_title: 'বিজ্ঞপ্তি চালু করা হয়েছে',
    notif_enabled_body: 'আপনি এখন বাজেট এবং লেনদেনের সময়োপযোগী বিজ্ঞপ্তি পাবেন।',
    tracked_providers: 'ট্র্যাককৃত প্রোভাইডার',
    select_providers_title: 'ট্রানজ্যাকশন প্রোভাইডার',
    select_providers_prompt: 'খরচ ট্র্যাক করতে প্রোভাইডার নির্বাচন করুন:',
    save_selection: 'সংরক্ষণ করুন',
    all_providers: 'সব প্রোভাইডার',
    none_selected: 'কোনোটি নির্বাচিত নয়',
    provider_bkash: 'বিকাশ',
    provider_nagad: 'নগদ',
    provider_rocket: 'রকেট',
    provider_upay: 'উপায়',
  },
  home: {
    sms_detection: 'এসএমএস ডিটেকশন',
    sms_detection_sub: 'বিকাশ, নগদ, রকেট, উপায়',
    greeting: 'হ্যালো,',
    total_balance: 'মোট ব্যালেন্স',
    monthly_income: 'আয়',
    monthly_expense: 'ব্যয়',
    monthly_budget: 'মাসিক বাজেট',
    budget_left: 'বাকি আছে',
    spent: 'খরচ',
    quick_actions: 'দ্রুত পদক্ষেপ',
    action_add: 'যুক্ত করুন',
    action_scan: 'স্ক্যান',
    action_voice: 'ভয়েস',
    action_insight: 'পরামর্শ',
    savings_goals: 'সঞ্চয় লক্ষ্য',
    add_goal: 'নতুন লক্ষ্য',
    no_goals: 'এখনও কোনো সঞ্চয় লক্ষ্য সেট করা হয়নি',
    recent_transactions: 'সাম্প্রতিক লেনদেন',
    view_all: 'সব দেখুন',
    no_transactions: 'এখনও কোনো লেনদেন লিপিবদ্ধ হয়নি',
    tap_plus_to_start: 'প্রথম খরচ যোগ করতে নিচের + চাপুন',
    saved: 'সঞ্চিত',
  },
  transactions: {
    title: 'লেনদেন',
    tab_transactions: 'লেনদেন',
    tab_budget: 'বাজেট',
    filter_all: 'সব',
    filter_income: 'আয়',
    filter_expense: 'ব্যয়',
    search_placeholder: 'লেনদেন খুঁজুন...',
    add_transaction: 'নতুন লেনদেন',
    empty_search: 'কোনো লেনদেন পাওয়া যায়নি',
    no_transactions_filter: 'এই ফিল্টারে কোনো লেনদেন নেই',
    delete_confirm: 'লেনদেন মুছে ফেলবেন?',
    delete_msg: 'আপনি কি নিশ্চিত যে এই লেনদেনটি মুছে ফেলতে চান?',
    delete: 'মুছে ফেলুন',
    cancel: 'বাতিল',
    total_budget: 'মোট বাজেট',
    spent_of: 'খরচ হয়েছে মোট',
    category_budgets: 'খাতভিত্তিক বাজেট',
    edit_budget: 'বাজেট পরিবর্তন',
    setup_budget: 'বাজেট নির্ধারণ',
    no_budget_title: 'এখনও বাজেট নির্ধারণ করা হয়নি',
    no_budget_desc: 'খরচ নিয়ন্ত্রণে রাখতে এবং ট্র্যাক করতে একটি মাসিক বাজেট নির্ধারণ করুন।',
  },
  family: {
    title: 'পারিবারিক হিসাব',
    subtab_overview: 'সামগ্রিক',
    subtab_members: 'সদস্য',
    subtab_expenses: 'খরচ',
    subtab_transactions: 'লেনদেন',
    invite_member: 'আমন্ত্রণ',
    family_budget: 'পারিবারিক যৌথ বাজেট',
    settle_up: 'হিসাব সম্পন্ন',
    no_family: 'কোনো পরিবারে যুক্ত নন',
    create_or_join: 'শুরু করতে একটি ফ্যামিলি সার্কেল তৈরি করুন বা যোগ দিন',
  },
  reports: {
    title: 'রিপোর্ট',
    monthly: 'মাসিক',
    weekly: 'সাপ্তাহিক',
    total_spent: 'মোট খরচ',
    net_savings: 'নিট সঞ্চয়',
    category_breakdown: 'খাতভিত্তিক বিশ্লেষণ',
    income_vs_expense: 'আয় বনাম ব্যয়',
    no_data: 'এই সময়ের জন্য কোনো খরচের তথ্য নেই',
  },
  notifications: {
    title: 'বিজ্ঞপ্তি',
    mark_all_read: 'সব পঠিত চিহ্নিত করুন',
    clear_all: 'সব মুছুন',
    filter_all: 'সব',
    filter_budget: 'বাজেট',
    filter_bills: 'বিল',
    filter_savings: 'সঞ্চয়',
    filter_family: 'পরিবার',
    empty_title: 'এখনও কোনো বিজ্ঞপ্তি নেই',
    empty_desc: 'আমরা আপনাকে অস্বাভাবিক খরচ, বিল, বাজেট সীমা ও সঞ্চয় লক্ষ্য সম্পর্কে অবহিত করব।',
  },
  common: {
    save: 'সংরক্ষণ',
    close: 'বন্ধ করুন',
    done: 'সম্পন্ন',
    confirm: 'নিশ্চিত করুন',
    loading: 'লোড হচ্ছে...',
    error: 'ত্রুটি',
    success: 'সফল',
  },
  categories: {
    'Food & Dining': 'খাবার ও রেস্তোরাঁ',
    'Groceries': 'মুদি ও বাজার',
    'Transportation': 'যাতায়াত',
    'Shopping': 'কেনাকাটা',
    'Entertainment': 'বিনোদন',
    'Bills & Utilities': 'বিল ও ইউটিলিটি',
    'Health & Medical': 'স্বাস্থ্য ও চিকিৎসা',
    'Education': 'শিক্ষা',
    'Travel': 'ভ্রমণ',
    'Salary': 'বেতন',
    'Investment': 'বিনিয়োগ',
    'Gifts & Donations': 'উপহার ও অনুদান',
    'Others': 'অন্যান্য',
  },
};

const BENGALI_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBengaliDigits(val: number | string): string {
  return String(val).replace(/[0-9]/g, (w) => BENGALI_DIGITS[+w]);
}

const LANGUAGE_STORAGE_KEY = 'finalert_app_language';

interface LanguageContextType {
  language: Language;
  isBangla: boolean;
  t: (keyPath: string, fallback?: string) => string;
  formatNumber: (n: number | string) => string;
  formatCurrency: (amount: number) => string;
  formatCompactCurrency: (n: number) => string;
  setLanguage: (lang: Language) => Promise<void>;
  toggleLanguage: () => Promise<void>;
  translateCategory: (categoryName: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(LANGUAGE_STORAGE_KEY);
        if (saved === 'bn' || saved === 'en') {
          setLanguageState(saved);
        }
      } catch (err) {
        console.warn('[LanguageContext] Failed to load language preference:', err);
      }
    })();
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    try {
      setLanguageState(lang);
      await SecureStore.setItemAsync(LANGUAGE_STORAGE_KEY, lang);
    } catch (err) {
      console.warn('[LanguageContext] Failed to save language preference:', err);
    }
  }, []);

  const toggleLanguage = useCallback(async () => {
    const next = language === 'bn' ? 'en' : 'bn';
    await setLanguage(next);
  }, [language, setLanguage]);

  const isBangla = language === 'bn';
  const currentDict = isBangla ? BN : EN;

  const t = useCallback(
    (keyPath: string, fallback?: string): string => {
      const parts = keyPath.split('.');
      let cur: any = currentDict;
      for (const p of parts) {
        if (cur && typeof cur === 'object' && p in cur) {
          cur = cur[p];
        } else {
          cur = undefined;
          break;
        }
      }
      if (typeof cur === 'string') return cur;

      // Fallback to English dict if missing in Bangla
      let enCur: any = EN;
      for (const p of parts) {
        if (enCur && typeof enCur === 'object' && p in enCur) {
          enCur = enCur[p];
        } else {
          enCur = undefined;
          break;
        }
      }
      if (typeof enCur === 'string') return enCur;

      return fallback ?? keyPath;
    },
    [currentDict]
  );

  const formatNumber = useCallback(
    (n: number | string): string => {
      if (isBangla) {
        return toBengaliDigits(n);
      }
      return String(n);
    },
    [isBangla]
  );

  const formatCurrency = useCallback(
    (amount: number): string => {
      const formatted = Math.round(amount).toLocaleString();
      if (isBangla) {
        return `৳${toBengaliDigits(formatted)}`;
      }
      return `৳${formatted}`;
    },
    [isBangla]
  );

  const formatCompactCurrency = useCallback(
    (n: number): string => {
      const sign = n < 0 ? '-' : '';
      const abs = Math.abs(Math.round(n));
      let res = '';
      if (abs >= 10000) {
        const val = Math.round(abs / 1000);
        res = `${sign}৳${val}k`;
      } else if (abs >= 1000) {
        const val = (abs / 1000).toFixed(1);
        res = `${sign}৳${val}k`;
      } else {
        res = `${sign}৳${abs}`;
      }

      if (isBangla) {
        return toBengaliDigits(res);
      }
      return res;
    },
    [isBangla]
  );

  const translateCategory = useCallback(
    (categoryName: string): string => {
      if (!isBangla) return categoryName;
      return BN.categories[categoryName] || categoryName;
    },
    [isBangla]
  );

  const value = useMemo(
    () => ({
      language,
      isBangla,
      t,
      formatNumber,
      formatCurrency,
      formatCompactCurrency,
      setLanguage,
      toggleLanguage,
      translateCategory,
    }),
    [
      language,
      isBangla,
      t,
      formatNumber,
      formatCurrency,
      formatCompactCurrency,
      setLanguage,
      toggleLanguage,
      translateCategory,
    ]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

