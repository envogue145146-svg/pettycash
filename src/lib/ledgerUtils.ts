import { Expense, UserPayment } from "../types";

export type DaybookEntry = {
  expense: Expense;
  receipt: number;
  payment: number;
  balance: number;
};

export type DaybookDay = {
  date: string;
  openingBalance: number;
  entries: DaybookEntry[];
  totalReceipts: number;
  totalPayments: number;
  closingBalance: number;
};

export type Daybook = {
  openingBalance: number;
  totalReceipts: number;
  totalPayments: number;
  closingBalance: number;
  days: DaybookDay[];
};

function compareEntries(left: Expense, right: Expense) {
  const dateCompare = (left.purchaseDate || "").localeCompare(right.purchaseDate || "");
  if (dateCompare !== 0) {
    return dateCompare;
  }
  const createdCompare = (left.createdAt || "").localeCompare(right.createdAt || "");
  if (createdCompare !== 0) {
    return createdCompare;
  }
  return left.id.localeCompare(right.id);
}

function signed(expense: Expense) {
  return expense.transactionType === "credit" ? expense.amount : -expense.amount;
}

/**
 * Day book of approved + pending entries (rejected are left out):
 * credits are receipts, debits are payments, with a running balance.
 * Days and entries come out oldest-first; the screen reverses them for display.
 */
export function buildDaybook(expenses: Expense[], ledgerOpeningBalance: number, fromDate = "", toDate = ""): Daybook {
  const approved = expenses.filter((expense) => expense.status !== "rejected").sort(compareEntries);

  let balance = ledgerOpeningBalance;
  for (const expense of approved) {
    if (fromDate && expense.purchaseDate < fromDate) {
      balance += signed(expense);
    }
  }

  const openingBalance = balance;
  const days: DaybookDay[] = [];
  let totalReceipts = 0;
  let totalPayments = 0;

  for (const expense of approved) {
    if (fromDate && expense.purchaseDate < fromDate) {
      continue;
    }
    if (toDate && expense.purchaseDate > toDate) {
      break;
    }

    let day = days[days.length - 1];
    if (!day || day.date !== expense.purchaseDate) {
      day = {
        date: expense.purchaseDate,
        openingBalance: balance,
        entries: [],
        totalReceipts: 0,
        totalPayments: 0,
        closingBalance: balance,
      };
      days.push(day);
    }

    const receipt = expense.transactionType === "credit" ? expense.amount : 0;
    const payment = expense.transactionType === "credit" ? 0 : expense.amount;
    balance += receipt - payment;

    day.entries.push({ expense, receipt, payment, balance });
    day.totalReceipts += receipt;
    day.totalPayments += payment;
    day.closingBalance = balance;
    totalReceipts += receipt;
    totalPayments += payment;
  }

  return { openingBalance, totalReceipts, totalPayments, closingBalance: balance, days };
}

export type UserSummary = {
  key: string;
  userId?: string;
  name: string;
  approvedExpenses: number;
  pendingExpenses: number;
  paidTillDate: number;
  balance: number;
  expenses: Expense[];
  payments: UserPayment[];
};

/**
 * Per-user totals: approved + pending expenses they recorded (debits only, rejected left out),
 * what has been paid to them, and what is still due.
 */
export function buildUserSummaries(expenses: Expense[], payments: UserPayment[]): UserSummary[] {
  const byKey = new Map<string, UserSummary>();

  const ensure = (key: string, name: string, userId?: string) => {
    let summary = byKey.get(key);
    if (!summary) {
      summary = {
        key,
        userId,
        name,
        approvedExpenses: 0,
        pendingExpenses: 0,
        paidTillDate: 0,
        balance: 0,
        expenses: [],
        payments: [],
      };
      byKey.set(key, summary);
    }
    return summary;
  };

  for (const expense of expenses) {
    const key = expense.creatorId || `name:${expense.createdBy}`;
    const summary = ensure(key, expense.createdBy || "Unknown", expense.creatorId);
    summary.expenses.push(expense);
    if (expense.transactionType === "credit") {
      continue;
    }
    if (expense.status === "rejected") {
      continue;
    }
    // approvedExpenses = total counted towards the balance (approved + pending);
    // pendingExpenses = the part of it still waiting for approval.
    summary.approvedExpenses += expense.amount;
    if (expense.status === "pending") {
      summary.pendingExpenses += expense.amount;
    }
  }

  for (const payment of payments) {
    const summary = byKey.get(payment.userId) ?? ensure(payment.userId, "Unknown user", payment.userId);
    summary.payments.push(payment);
    summary.paidTillDate += payment.amount;
  }

  const result = Array.from(byKey.values());
  for (const summary of result) {
    summary.balance = summary.approvedExpenses - summary.paidTillDate;
    summary.expenses.sort((left, right) => compareEntries(right, left));
    summary.payments.sort((left, right) => right.paidOn.localeCompare(left.paidOn));
  }

  return result.sort((left, right) => left.name.localeCompare(right.name));
}

export function formatRupees(amount: number) {
  const rounded = Math.round(amount * 100) / 100;
  const sign = rounded < 0 ? "-" : "";
  return `${sign}Rs. ${Math.abs(rounded).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatLedgerDate(value: string, withWeekday = false) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || "");
  if (!match) {
    return value || "-";
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const label = `${String(day).padStart(2, "0")} ${monthNames[monthIndex] ?? ""} ${year}`;
  if (!withWeekday) {
    return label;
  }
  const weekday = dayNames[new Date(Date.UTC(year, monthIndex, day)).getUTCDay()];
  return `${weekday}, ${label}`;
}
