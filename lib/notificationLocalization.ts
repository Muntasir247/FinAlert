import type {
  AppNotification,
  NewNotification,
  NotificationActionType,
  NotificationCategory,
} from './notifications';

// ── Bengali Digits Helpers ──────────────────────────────────────────────────

const BENGALI_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
const BENGALI_TO_WESTERN: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

export function toBengaliDigits(val: number | string): string {
  return String(val).replace(/[0-9]/g, (w) => BENGALI_DIGITS[+w]);
}

export function toWesternDigits(val: number | string): string {
  return String(val).replace(/[০-৯]/g, (b) => BENGALI_TO_WESTERN[b] ?? b);
}

// ── Category Translation Mappings ──────────────────────────────────────────

export const CATEGORY_EN_TO_BN: Record<string, string> = {
  'Food & Dining': 'খাবার ও ডাইনিং',
  Food: 'খাবার',
  Dining: 'ডাইনিং',
  Shopping: 'কেনাকাটা',
  Transportation: 'যাতায়াত',
  Transport: 'যাতায়াত',
  'Bills & Utilities': 'বিল ও পরিষেবা',
  Bills: 'বিল',
  Utilities: 'পরিষেবা',
  Entertainment: 'বিনোদন',
  Health: 'স্বাস্থ্য',
  Healthcare: 'স্বাস্থ্যসেবা',
  Education: 'শিক্ষা',
  Groceries: 'মুদি বাজার',
  'Personal Care': 'ব্যক্তিগত যত্ন',
  Housing: 'বাসস্থান',
  Rent: 'ভাড়া',
  Travel: 'ভ্রমণ',
  Salary: 'বেতন',
  Investment: 'বিনিয়োগ',
  'Gifts & Donations': 'উপহার ও অনুদান',
  Others: 'অন্যান্য',
  expense: 'খরচ',
  income: 'আয়',
  contribution: 'অবদান',
  payment: 'পরিশোধ',
};

export const CATEGORY_BN_TO_EN: Record<string, string> = Object.entries(
  CATEGORY_EN_TO_BN
).reduce((acc, [en, bn]) => {
  if (!acc[bn]) acc[bn] = en;
  return acc;
}, {} as Record<string, string>);

export function translateCategoryName(category: string, toBangla: boolean): string {
  if (!category) return category;
  if (toBangla) {
    return CATEGORY_EN_TO_BN[category] || category;
  }
  return CATEGORY_BN_TO_EN[category] || category;
}

// ── Action Label Translation Mappings ──────────────────────────────────────

export const ACTION_LABELS_EN: Record<NotificationActionType, string> = {
  review_spending: 'Review spending ↗',
  review_budget: 'Review budget ↗',
  view_goal: 'View goal ↗',
  view_family: 'View family ↗',
};

export const ACTION_LABELS_BN: Record<NotificationActionType, string> = {
  review_spending: 'খরচ পর্যালোচনা ↗',
  review_budget: 'বাজেট পর্যালোচনা ↗',
  view_goal: 'লক্ষ্য দেখুন ↗',
  view_family: 'পরিবার দেখুন ↗',
};

export function getLocalizedActionLabel(
  actionType: NotificationActionType,
  isBangla: boolean
): string {
  if (isBangla) {
    return ACTION_LABELS_BN[actionType] || 'দেখুন ↗';
  }
  return ACTION_LABELS_EN[actionType] || 'View ↗';
}

// ── Time Ago Formatting ────────────────────────────────────────────────────

export function getLocalizedTimeAgo(iso: string, isBangla: boolean): string {
  const diffMs = Math.max(0, Date.now() - new Date(iso).getTime());
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) {
    return isBangla ? 'এইমাত্র' : 'just now';
  }
  if (minutes < 60) {
    return isBangla ? `${toBengaliDigits(minutes)} মিনিট আগে` : `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return isBangla ? `${toBengaliDigits(hours)} ঘণ্টা আগে` : `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 30) {
    return isBangla ? `${toBengaliDigits(days)} দিন আগে` : `${days}d ago`;
  }
  const months = Math.floor(days / 30);
  return isBangla ? `${toBengaliDigits(months)} মাস আগে` : `${months}mo ago`;
}

// ── Notification Translation ───────────────────────────────────────────────

/**
 * Translates a notification title and message dynamically between English and Bangla.
 * Preserves custom dynamic parameters (amounts, percentages, goal names, member names).
 */
export function translateNotification(
  notif: { title: string; message: string; category?: NotificationCategory },
  isBangla: boolean
): { title: string; message: string } {
  const { title, message } = notif;

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Budget Notifications
  // ──────────────────────────────────────────────────────────────────────────

  // 1.1 Monthly budget 80% used
  if (
    title.includes('80% used') ||
    title.includes('৮০% ব্যবহৃত') ||
    title.includes('80% ব্যবহৃত')
  ) {
    if (isBangla) {
      const match =
        message.match(/used\s+(\d+)%\s+of your monthly budget\s*\((.+?)\s+of\s+(.+?)\)/i) ||
        message.match(/([০-৯\d]+)%\s+(?:ব্যয়|ব্যয়|ব্যবহার)\s+করেছেন\s*\((.+?)-এর মধ্যে\s+(.+?)\)/i);
      let localizedMsg = message;
      if (match) {
        const pct = toBengaliDigits(match[1]);
        const isFromBn = message.includes('-এর মধ্যে');
        const spent = toBengaliDigits(isFromBn ? match[3] : match[2]);
        const total = toBengaliDigits(isFromBn ? match[2] : match[3]);
        localizedMsg = `আপনি আপনার মাসিক বাজেটের ${pct}% ব্যয় করেছেন (${total}-এর মধ্যে ${spent})।`;
      } else {
        localizedMsg = toBengaliDigits(message);
      }
      return {
        title: 'মাসিক বাজেটের ৮০% ব্যবহৃত',
        message: localizedMsg,
      };
    } else {
      const match =
        message.match(/used\s+(\d+)%\s+of your monthly budget\s*\((.+?)\s+of\s+(.+?)\)/i) ||
        message.match(/([০-৯\d]+)%\s+(?:ব্যয়|ব্যয়|ব্যবহার)\s+করেছেন\s*\((.+?)-এর মধ্যে\s+(.+?)\)/i);
      let localizedMsg = message;
      if (match) {
        const pct = toWesternDigits(match[1]);
        const isFromBn = message.includes('-এর মধ্যে');
        const spent = toWesternDigits(isFromBn ? match[3] : match[2]);
        const total = toWesternDigits(isFromBn ? match[2] : match[3]);
        localizedMsg = `You've used ${pct}% of your monthly budget (${spent} of ${total}).`;
      }
      return {
        title: 'Monthly budget 80% used',
        message: localizedMsg,
      };
    }
  }

  // 1.2 Monthly budget used up
  if (
    title.includes('budget used up') ||
    title.includes('বাজেট শেষ হয়ে গেছে') ||
    title.includes('বাজেট শেষ হয়ে গেছে')
  ) {
    if (isBangla) {
      const match =
        message.match(/spent\s+(.+?)\s+of your\s+(.+?)\s+total budget/i) ||
        message.match(/বাজেটের\s+(.+?)\s+খরচ করেছেন/i);
      let localizedMsg = message;
      if (match && match[1] && match[2]) {
        const spent = toBengaliDigits(match[1]);
        const total = toBengaliDigits(match[2]);
        localizedMsg = `আপনি এই মাসে আপনার মোট ${total} বাজেটের ${spent} খরচ করেছেন।`;
      } else {
        localizedMsg = toBengaliDigits(message);
      }
      return {
        title: 'মাসিক বাজেট শেষ হয়ে গেছে',
        message: localizedMsg,
      };
    } else {
      const match =
        message.match(/spent\s+(.+?)\s+of your\s+(.+?)\s+total budget/i) ||
        message.match(/মোট\s+(.+?)\s+বাজেটের\s+(.+?)\s+খরচ করেছেন/i);
      let localizedMsg = message;
      if (match && match[1] && match[2]) {
        const total = toWesternDigits(match[1]);
        const spent = toWesternDigits(match[2]);
        localizedMsg = `You have spent ${spent} of your ${total} total budget this month.`;
      }
      return {
        title: 'Monthly budget used up',
        message: localizedMsg,
      };
    }
  }

  // 1.3 Budget overrun
  if (title.includes('Budget overrun') || title.includes('বাজেট অতিক্রম করেছে')) {
    if (isBangla) {
      const match = message.match(
        /^(.+?)\s+is\s+(\d+)%\s+over its monthly limit of\s+(.+?)\.\s*Review your recent spending\./i
      );
      if (match) {
        const cat = translateCategoryName(match[1], true);
        const pct = toBengaliDigits(match[2]);
        const limit = toBengaliDigits(match[3]);
        return {
          title: 'বাজেট অতিক্রম করেছে',
          message: `${cat} এর মাসিক সীমা ${limit}-এর চেয়ে ${pct}% বেশি খরচ হয়েছে। আপনার সাম্প্রতিক খরচ পর্যালোচনা করুন।`,
        };
      }
      return {
        title: 'বাজেট অতিক্রম করেছে',
        message: toBengaliDigits(message),
      };
    } else {
      const match = message.match(
        /^(.+?)\s+এর মাসিক সীমা\s+(.+?)-এর চেয়ে\s+([০-৯\d]+)%\s+বেশি খরচ হয়েছে/i
      );
      if (match) {
        const cat = translateCategoryName(match[1].trim(), false);
        const limit = toWesternDigits(match[2]);
        const pct = toWesternDigits(match[3]);
        return {
          title: 'Budget overrun',
          message: `${cat} is ${pct}% over its monthly limit of ${limit}. Review your recent spending.`,
        };
      }
      return {
        title: 'Budget overrun',
        message: toWesternDigits(message),
      };
    }
  }

  // 1.4 Month-over-month increase: "{category} is higher than last month"
  if (
    title.includes('is higher than last month') ||
    title.includes('গত মাসের চেয়ে বেশি') ||
    title.includes('গত মাসের চেয়ে বেশি')
  ) {
    if (isBangla) {
      const titleCat = title.replace(/\s+is higher than last month/i, '').trim();
      const bnTitleCat = translateCategoryName(titleCat, true);
      const match = message.match(
        /spent\s+(.+?)\s+on\s+(.+?)\s+this month,\s*up from\s+(.+?)\s+last month/i
      );
      if (match) {
        const current = toBengaliDigits(match[1]);
        const cat = translateCategoryName(match[2], true);
        const last = toBengaliDigits(match[3]);
        return {
          title: `${bnTitleCat} গত মাসের চেয়ে বেশি`,
          message: `আপনি এই মাসে ${cat} খাতে ${current} ব্যয় করেছেন, যা গত মাসে ছিল ${last}।`,
        };
      }
      return {
        title: `${bnTitleCat} গত মাসের চেয়ে বেশি`,
        message: toBengaliDigits(message),
      };
    } else {
      const bnTitleCat = title
        .replace(/\s*গত মাসের চে[য়ে|য়ে] বেশি/i, '')
        .trim();
      const enTitleCat = translateCategoryName(bnTitleCat, false);
      const match = message.match(
        /এই মাসে\s+(.+?)\s+খাতে\s+(.+?)\s+ব্যয় করেছেন,\s*যা গত মাসে ছিল\s+(.+?)।/i
      );
      if (match) {
        const cat = translateCategoryName(match[1].trim(), false);
        const current = toWesternDigits(match[2]);
        const last = toWesternDigits(match[3]);
        return {
          title: `${enTitleCat} is higher than last month`,
          message: `You've spent ${current} on ${cat} this month, up from ${last} last month.`,
        };
      }
      return {
        title: `${enTitleCat} is higher than last month`,
        message: toWesternDigits(message),
      };
    }
  }

  // 1.5 Daily spend spike: "You spent too much on {category} today!"
  if (
    title.includes('spent too much on') ||
    title.includes('খাতে অতিরিক্ত খরচ হয়েছে') ||
    title.includes('খাতে অতিরিক্ত খরচ হয়েছে')
  ) {
    if (isBangla) {
      const titleCatMatch = title.match(/spent too much on\s+(.+?)\s+today!/i);
      const cat = titleCatMatch ? translateCategoryName(titleCatMatch[1], true) : 'এই';
      const msgMatch = message.match(
        /Your\s+(.+?)\s+spending today\s*\((.+?)\)\s+is well above your usual daily pace/i
      );
      const todayAmount = msgMatch ? toBengaliDigits(msgMatch[2]) : '';
      return {
        title: `আজ ${cat} খাতে অতিরিক্ত খরচ হয়েছে!`,
        message: todayAmount
          ? `আজ আপনার ${cat} খাতের খরচ (${todayAmount}) স্বাভাবিক দৈনিক ব্যয়ের তুলনায় অনেকটাই বেশি।`
          : `আজ আপনার ${cat} খাতের খরচ স্বাভাবিক দৈনিক ব্যয়ের চেয়ে অনেকটাই বেশি।`,
      };
    } else {
      const titleCatMatch = title.match(/আজ\s+(.+?)\s+খাতে অতিরিক্ত খরচ হয়েছে/i);
      const cat = titleCatMatch ? translateCategoryName(titleCatMatch[1].trim(), false) : 'this category';
      const msgMatch = message.match(
        /আজ আপনার\s+(.+?)\s+খাতের খরচ\s*\((.+?)\)\s+স্বাভাবিক দৈনিক ব্যয়ের তুলনায় অনেকটাই বেশি/i
      );
      const todayAmount = msgMatch ? toWesternDigits(msgMatch[2]) : '';
      return {
        title: `You spent too much on ${cat} today!`,
        message: todayAmount
          ? `Your ${cat} spending today (${todayAmount}) is well above your usual daily pace.`
          : `Your ${cat} spending today is well above your usual daily pace.`,
      };
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Savings Goals Notifications
  // ──────────────────────────────────────────────────────────────────────────

  // 2.1 Milestone Title: "Savings goal {milestone}% reached!"
  if (
    title.includes('Savings goal') ||
    title.includes('সঞ্চয় লক্ষ্য') ||
    title.includes('সঞ্চয় লক্ষ্য')
  ) {
    const milestoneMatch = title.match(/([০-৯\d]+)%/);
    const rawMilestone = milestoneMatch ? milestoneMatch[1] : '';

    if (isBangla) {
      const bnMilestone = toBengaliDigits(rawMilestone);
      const bnTitle = `সঞ্চয় লক্ষ্য ${bnMilestone}% অর্জিত হয়েছে!`;

      // Check 100% reached
      if (rawMilestone === '100' || rawMilestone === '১০০') {
        const m100 = message.match(/You reached your\s+(.+?)\s+goal of\s+(.+?)\.\s*Great job!/i);
        if (m100) {
          const goalName = m100[1];
          const target = toBengaliDigits(m100[2]);
          return {
            title: bnTitle,
            message: `আপনি আপনার ${goalName} লক্ষ্যের ${target} অর্জন করেছেন। অসাধারণ!`,
          };
        }
      }

      // Check partial milestone (< 100%)
      const mPartial = message.match(
        /You're\s+(\d+)%\s+of the way to your\s+(.+?)\s+goal\s*\((.+?)\s+of\s+(.+?)\)/i
      );
      if (mPartial) {
        const pct = toBengaliDigits(mPartial[1]);
        const goalName = mPartial[2];
        const current = toBengaliDigits(mPartial[3]);
        const target = toBengaliDigits(mPartial[4]);
        return {
          title: bnTitle,
          message: `আপনি আপনার ${goalName} লক্ষ্যের ${pct}% সম্পন্ন করেছেন (${target}-এর মধ্যে ${current})।`,
        };
      }

      return {
        title: bnTitle,
        message: toBengaliDigits(message),
      };
    } else {
      const enMilestone = toWesternDigits(rawMilestone);
      const enTitle = `Savings goal ${enMilestone}% reached!`;

      // Check 100% reached in Bangla
      const m100Bn = message.match(
        /আপনি আপনার\s+(.+?)\s+লক্ষ্যের\s+(.+?)\s+অর্জন করেছেন।\s*অসাধারণ!/i
      );
      if (m100Bn) {
        const goalName = m100Bn[1];
        const target = toWesternDigits(m100Bn[2]);
        return {
          title: enTitle,
          message: `You reached your ${goalName} goal of ${target}. Great job!`,
        };
      }

      // Check partial milestone in Bangla
      const mPartialBn = message.match(
        /আপনি আপনার\s+(.+?)\s+লক্ষ্যের\s+([০-৯\d]+)%\s+সম্পন্ন করেছেন\s*\((.+?)-এর মধ্যে\s+(.+?)\)/i
      );
      if (mPartialBn) {
        const goalName = mPartialBn[1];
        const pct = toWesternDigits(mPartialBn[2]);
        const target = toWesternDigits(mPartialBn[3]);
        const current = toWesternDigits(mPartialBn[4]);
        return {
          title: enTitle,
          message: `You're ${pct}% of the way to your ${goalName} goal (${current} of ${target}).`,
        };
      }

      return {
        title: enTitle,
        message: toWesternDigits(message),
      };
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Family Notifications
  // ──────────────────────────────────────────────────────────────────────────

  // 3.1 Family group created
  if (title.includes('Family group created') || title.includes('পারিবারিক গ্রুপ তৈরি হয়েছে')) {
    if (isBangla) {
      const match = message.match(/You created\s+(.+?)\.\s*Share code\s+(\w+)\s+to invite members\./i);
      return {
        title: 'পারিবারিক গ্রুপ তৈরি হয়েছে',
        message: match
          ? `আপনি ${match[1]} তৈরি করেছেন। সদস্যদের আমন্ত্রণ জানাতে কোড ${match[2]} শেয়ার করুন।`
          : 'আপনি একটি পারিবারিক গ্রুপ তৈরি করেছেন।',
      };
    } else {
      const match = message.match(
        /আপনি\s+(.+?)\s+তৈরি করেছেন।\s*সদস্যদের আমন্ত্রণ জানাতে কোড\s+(\w+)\s+শেয়ার করুন।/i
      );
      return {
        title: 'Family group created',
        message: match
          ? `You created ${match[1]}. Share code ${match[2]} to invite members.`
          : 'You created a family group.',
      };
    }
  }

  // 3.2 You joined a family
  if (title.includes('You joined a family') || title.includes('পরিবারে যুক্ত হয়েছেন')) {
    if (isBangla) {
      const match = message.match(/You joined\s+(.+?)\./i);
      return {
        title: 'আপনি একটি পরিবারে যুক্ত হয়েছেন',
        message: match ? `আপনি ${match[1]} পরিবারে যুক্ত হয়েছেন।` : 'আপনি একটি পরিবারে যুক্ত হয়েছেন।',
      };
    } else {
      const match = message.match(/আপনি\s+(.+?)\s+পরিবারে যুক্ত হয়েছেন।/i);
      return {
        title: 'You joined a family',
        message: match ? `You joined ${match[1]}.` : 'You joined a family.',
      };
    }
  }

  // 3.3 Left family group
  if (title.includes('Left family group') || title.includes('পারিবারিক গ্রুপ ত্যাগ করেছেন')) {
    return {
      title: isBangla ? 'পারিবারিক গ্রুপ ত্যাগ করেছেন' : 'Left family group',
      message: isBangla
        ? 'আপনি পারিবারিক গ্রুপটি ত্যাগ করেছেন।'
        : 'You have left the family group.',
    };
  }

  // 3.4 Family group deleted
  if (title.includes('Family group deleted') || title.includes('পারিবারিক গ্রুপ মুছে ফেলা হয়েছে')) {
    if (isBangla) {
      const match = message.match(/^(.+?)\s+was deleted\./i);
      return {
        title: 'পারিবারিক গ্রুপ মুছে ফেলা হয়েছে',
        message: match ? `${match[1]} মুছে ফেলা হয়েছে।` : 'পারিবারিক গ্রুপ মুছে ফেলা হয়েছে।',
      };
    } else {
      const match = message.match(/^(.+?)\s+মুছে ফেলা হয়েছে।/i);
      return {
        title: 'Family group deleted',
        message: match ? `${match[1]} was deleted.` : 'Family group was deleted.',
      };
    }
  }

  // 3.5 Member joined (trigger notification)
  if (title.includes('joined the family') || title.includes('পরিবারে যুক্ত হয়েছেন')) {
    if (isBangla) {
      const nameMatch = title.match(/^(.+?)\s+joined the family/i);
      const memberName = nameMatch ? nameMatch[1] : 'একজন সদস্য';
      const famMatch = message.match(/joined\s+(.+?)\./i);
      const famName = famMatch ? famMatch[1] : 'পরিবার';
      return {
        title: `${memberName} পরিবারে যুক্ত হয়েছেন`,
        message: `${memberName} ${famName}-এ যুক্ত হয়েছেন।`,
      };
    } else {
      const nameMatch = title.match(/^(.+?)\s+পরিবারে যুক্ত হয়েছেন/i);
      const memberName = nameMatch ? nameMatch[1] : 'A family member';
      const famMatch = message.match(/(.+?)-এ যুক্ত হয়েছেন।/i);
      const famName = famMatch ? famMatch[1].trim() : 'the family';
      return {
        title: `${memberName} joined the family`,
        message: `${memberName} joined ${famName}.`,
      };
    }
  }

  // 3.6 Family expense added (client or trigger)
  if (
    title.includes('added a family expense') ||
    title.includes('Family expense added') ||
    title.includes('পারিবারিক খরচ যোগ')
  ) {
    if (isBangla) {
      const isYou = title.includes('Family expense added');
      // "You added a Food expense of ৳500." or "{name} added a Food expense of ৳500."
      const match =
        message.match(/You added a\s+(.+?)\s+expense of\s+(.+?)\./i) ||
        message.match(/^(.+?)\s+added a\s+(.+?)\s+expense of\s+(.+?)\./i);

      if (isYou && match) {
        const cat = translateCategoryName(match[1], true);
        const total = toBengaliDigits(match[2]);
        return {
          title: 'পারিবারিক খরচ যোগ করা হয়েছে',
          message: `আপনি ${total}-এর ${cat} খরচ যোগ করেছেন।`,
        };
      } else if (match) {
        const actor = match[1];
        const cat = translateCategoryName(match[2], true);
        const total = toBengaliDigits(match[3]);
        return {
          title: `${actor} পারিবারিক খরচ যোগ করেছেন`,
          message: `${actor} ${cat} খাতে ${total} খরচ যোগ করেছেন।`,
        };
      }
      return {
        title: 'পারিবারিক খরচ যোগ করা হয়েছে',
        message: toBengaliDigits(message),
      };
    } else {
      const matchYou = message.match(/আপনি\s+(.+?)-এর\s+(.+?)\s+খরচ যোগ করেছেন।/i);
      if (matchYou) {
        const total = toWesternDigits(matchYou[1]);
        const cat = translateCategoryName(matchYou[2], false);
        return {
          title: 'Family expense added',
          message: `You added a ${cat} expense of ${total}.`,
        };
      }
      const matchOther = message.match(
        /^(.+?)\s+(.+?)\s+খাতে\s+(.+?)\s+খরচ যোগ করেছেন।/i
      );
      if (matchOther) {
        const actor = matchOther[1];
        const cat = translateCategoryName(matchOther[2], false);
        const total = toWesternDigits(matchOther[3]);
        return {
          title: `${actor} added a family expense`,
          message: `${actor} added a ${cat} expense of ${total}.`,
        };
      }
      return {
        title: 'Family expense added',
        message: toWesternDigits(message),
      };
    }
  }

  // 3.7 Family payment recorded
  if (title.includes('Family payment recorded') || title.includes('পারিবারিক লেনদেন সম্পন্ন')) {
    if (isBangla) {
      const match = message.match(/You recorded a\s+(.+?)\s+of\s+(.+?)(\s*\(.+?\))?\./i);
      if (match) {
        const type = translateCategoryName(match[1], true);
        const amount = toBengaliDigits(match[2]);
        const note = match[3] ? toBengaliDigits(match[3]) : '';
        return {
          title: 'পারিবারিক লেনদেন সম্পন্ন',
          message: `আপনি ${amount}-এর একটি ${type} লেনদেন রেকর্ড করেছেন${note}।`,
        };
      }
      return {
        title: 'পারিবারিক লেনদেন সম্পন্ন',
        message: toBengaliDigits(message),
      };
    } else {
      const match = message.match(
        /আপনি\s+(.+?)-এর একটি\s+(.+?)\s+লেনদেন রেকর্ড করেছেন(\s*\(.+?\))?।/i
      );
      if (match) {
        const amount = toWesternDigits(match[1]);
        const type = translateCategoryName(match[2], false);
        const note = match[3] ? toWesternDigits(match[3]) : '';
        return {
          title: 'Family payment recorded',
          message: `You recorded a ${type} of ${amount}${note}.`,
        };
      }
      return {
        title: 'Family payment recorded',
        message: toWesternDigits(message),
      };
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. General / Settings Notifications
  // ──────────────────────────────────────────────────────────────────────────

  if (
    title.includes('FinAlert Notifications Enabled') ||
    title.includes('FinAlert বিজ্ঞপ্তি সক্রিয় হয়েছে') ||
    title.includes('FinAlert বিজ্ঞপ্তি সক্রিয় হয়েছে')
  ) {
    return {
      title: isBangla ? 'FinAlert বিজ্ঞপ্তি সক্রিয় হয়েছে' : 'FinAlert Notifications Enabled',
      message: isBangla
        ? 'আপনি এখন থেকে বাজেট, লেনদেন এবং সঞ্চয় লক্ষ্যের সময়োপযোগী বিজ্ঞপ্তি পাবেন।'
        : 'You will now receive timely alerts for budgets, transactions, and goals.',
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Fallback: Digit & Category Transformation
  // ──────────────────────────────────────────────────────────────────────────

  if (isBangla) {
    let localizedTitle = title;
    let localizedMessage = message;

    // Convert known category names in title and message
    for (const [enCat, bnCat] of Object.entries(CATEGORY_EN_TO_BN)) {
      const regex = new RegExp(`\\b${enCat}\\b`, 'g');
      localizedTitle = localizedTitle.replace(regex, bnCat);
      localizedMessage = localizedMessage.replace(regex, bnCat);
    }

    return {
      title: toBengaliDigits(localizedTitle),
      message: toBengaliDigits(localizedMessage),
    };
  } else {
    let localizedTitle = title;
    let localizedMessage = message;

    // Convert known Bengali categories back to English
    for (const [bnCat, enCat] of Object.entries(CATEGORY_BN_TO_EN)) {
      localizedTitle = localizedTitle.split(bnCat).join(enCat);
      localizedMessage = localizedMessage.split(bnCat).join(enCat);
    }

    return {
      title: toWesternDigits(localizedTitle),
      message: toWesternDigits(localizedMessage),
    };
  }
}

// ── Notification Deduplication Logic ───────────────────────────────────────

/**
 * Derives a canonical semantic key for any notification.
 * Ignores language differences and transient timestamp noise so that
 * notifications representing the same event match across languages and retries.
 */
export function getNotificationDedupeKey(notif: {
  category?: string;
  title: string;
  message?: string;
  created_at?: string;
}): string {
  const category = (notif.category || 'general').toLowerCase();
  const title = notif.title || '';
  const message = notif.message || '';

  // Extract year-month and year-month-day for date bucketing
  let dateKey = '';
  let monthKey = '';
  if (notif.created_at) {
    try {
      const d = new Date(notif.created_at);
      monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      dateKey = `${monthKey}-${String(d.getDate()).padStart(2, '0')}`;
    } catch {
      // Fallback
    }
  }
  if (!monthKey) {
    const now = new Date();
    monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    dateKey = `${monthKey}-${String(now.getDate()).padStart(2, '0')}`;
  }

  // 1. Budget Alerts
  if (category === 'budget' || title.includes('budget') || title.includes('বাজেট')) {
    if (title.includes('80%') || title.includes('৮০%')) {
      return `budget:total80:${monthKey}`;
    }
    if (
      title.includes('used up') ||
      title.includes('শেষ হয়ে গেছে') ||
      title.includes('শেষ হয়ে গেছে')
    ) {
      return `budget:total100:${monthKey}`;
    }
    if (title.includes('overrun') || title.includes('অতিক্রম')) {
      // Extract category name
      const catMatch =
        message.match(/^([A-Za-z\s&]+)\s+is/i) ||
        message.match(/^(.+?)\s+এর মাসিক সীমা/i);
      const cat = catMatch ? catMatch[1].trim() : 'any';
      return `budget:overrun:${translateCategoryName(cat, false)}:${monthKey}`;
    }
    if (title.includes('higher than last month') || title.includes('গত মাসের চেয়ে বেশি')) {
      const catMatch =
        title.match(/^([A-Za-z\s&]+)\s+is higher/i) ||
        title.match(/^(.+?)\s*গত মাসের/i);
      const cat = catMatch ? catMatch[1].trim() : 'any';
      return `budget:mom:${translateCategoryName(cat, false)}:${monthKey}`;
    }
    if (title.includes('spent too much') || title.includes('অতিরিক্ত খরচ')) {
      const catMatch =
        title.match(/spent too much on\s+([A-Za-z\s&]+)\s+today/i) ||
        title.match(/আজ\s+(.+?)\s+খাতে/i);
      const cat = catMatch ? catMatch[1].trim() : 'any';
      return `budget:daily:${translateCategoryName(cat, false)}:${dateKey}`;
    }
  }

  // 2. Savings Alerts
  if (category === 'savings' || title.includes('Savings') || title.includes('সঞ্চয়')) {
    const pctMatch = title.match(/([০-৯\d]+)%/);
    const pct = pctMatch ? toWesternDigits(pctMatch[1]) : '';
    // Extract goal name
    const goalMatch =
      message.match(/your\s+(.+?)\s+goal/i) ||
      message.match(/আপনার\s+(.+?)\s+লক্ষ্যের/i);
    const goal = goalMatch ? goalMatch[1].trim() : 'any';
    return `savings:${goal}:${pct}`;
  }

  // 3. Family Alerts
  if (category === 'family' || title.includes('Family') || title.includes('পরিবার')) {
    if (title.includes('created') || title.includes('তৈরি')) {
      return `family:created`;
    }
    if (title.includes('joined') || title.includes('যুক্ত')) {
      const nameMatch = title.match(/^(.+?)\s+(joined|পরিবারে)/i);
      const name = nameMatch ? nameMatch[1].trim() : 'user';
      return `family:joined:${name}:${dateKey}`;
    }
    if (title.includes('Left') || title.includes('ত্যাগ')) {
      return `family:left`;
    }
    if (title.includes('deleted') || title.includes('মুছে')) {
      return `family:deleted`;
    }
    if (title.includes('expense') || title.includes('খরচ')) {
      // Bucket per hour
      const hour = notif.created_at ? new Date(notif.created_at).getHours() : new Date().getHours();
      return `family:expense:${dateKey}:${hour}:${message.slice(0, 30)}`;
    }
  }

  // 4. General fallback: Normalized title + message snippet + 6-hour bucket
  const normalizedTitle = title
    .toLowerCase()
    .replace(/[0-9০-৯\s\W_]+/g, '')
    .slice(0, 20);
  const hourBucket = Math.floor(
    (notif.created_at ? new Date(notif.created_at).getHours() : new Date().getHours()) / 6
  );
  return `${category}:${normalizedTitle}:${dateKey}:${hourBucket}`;
}

/**
 * Deduplicates a list of notifications so that:
 * 1. Duplicate IDs are removed.
 * 2. Notifications with the same semantic key within a time window (default 12 hours)
 *    are kept once (newest first).
 */
export function deduplicateNotificationList<T extends AppNotification>(
  list: T[],
  windowMs: number = 12 * 60 * 60 * 1000
): T[] {
  if (!list || list.length <= 1) return list || [];

  const seenIds = new Set<string>();
  const seenKeys = new Map<string, number>();
  const result: T[] = [];

  for (const notif of list) {
    if (notif.id && seenIds.has(notif.id)) {
      continue;
    }
    if (notif.id) {
      seenIds.add(notif.id);
    }

    const key = getNotificationDedupeKey(notif);
    const notifTime = notif.created_at ? new Date(notif.created_at).getTime() : Date.now();

    const lastTime = seenKeys.get(key);
    if (lastTime !== undefined && Math.abs(lastTime - notifTime) < windowMs) {
      // Duplicate within window; skip it
      continue;
    }

    seenKeys.set(key, notifTime);
    result.push(notif);
  }

  return result;
}
