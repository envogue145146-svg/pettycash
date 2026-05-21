import * as FileSystem from "expo-file-system";
import { Expense, Ledger, TransactionType } from "../types";
import { getImageMimeType, normalizeAssetExtension } from "./fileUploads";
import { normalizeImportedDriveUrl } from "./pettyCashWebUtils";

const googleSheetsWebAppUrl = process.env.EXPO_PUBLIC_GOOGLE_SHEETS_WEB_APP_URL?.trim();

export const isGoogleSheetsConfigured = Boolean(googleSheetsWebAppUrl);

type BootstrapResponse = {
  ledger: Ledger | null;
  expenses: Expense[];
};

type GoogleSheetsEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

type UploadResponse = {
  url: string;
};

function normalizeGoogleDriveUrl(url: string) {
  return normalizeImportedDriveUrl(url);
}

function parseLooseDate(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return 0;
  }

  const nativeTimestamp = Date.parse(trimmedValue);
  if (!Number.isNaN(nativeTimestamp)) {
    return nativeTimestamp;
  }

  const dateTimeMatch = trimmedValue.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i,
  );
  if (!dateTimeMatch) {
    return 0;
  }

  let [, first, second, year, hour = "0", minute = "0", secondPart = "0", meridiem = ""] = dateTimeMatch;
  let month = Number(first);
  let day = Number(second);

  // Sheet timestamps like 10/19/2025 should be interpreted as month/day/year.
  if (month > 12 && day <= 12) {
    month = Number(second);
    day = Number(first);
  }

  let normalizedHour = Number(hour);
  const upperMeridiem = meridiem.toUpperCase();
  if (upperMeridiem === "PM" && normalizedHour < 12) {
    normalizedHour += 12;
  }
  if (upperMeridiem === "AM" && normalizedHour === 12) {
    normalizedHour = 0;
  }

  const normalizedYear = year.length === 2 ? 2000 + Number(year) : Number(year);
  return new Date(
    normalizedYear,
    Math.max(month - 1, 0),
    day,
    normalizedHour,
    Number(minute),
    Number(secondPart),
  ).getTime();
}

function compareExpensesNewestFirst(left: Expense, right: Expense) {
  const timestampDifference =
    parseLooseDate(right.createdAt || right.purchaseDate) - parseLooseDate(left.createdAt || left.purchaseDate);

  if (timestampDifference !== 0) {
    return timestampDifference;
  }

  return right.id.localeCompare(left.id);
}

function requireWebAppUrl() {
  if (!googleSheetsWebAppUrl) {
    throw new Error("Google Sheets web app URL is not configured.");
  }

  return googleSheetsWebAppUrl;
}

function normalizeExpense(expense: Partial<Expense> & { id: string }): Expense {
  const transactionType: TransactionType = expense.transactionType === "credit" ? "credit" : "debit";
  return {
    id: expense.id,
    accountingHead: expense.accountingHead ?? "",
    description: expense.description ?? "",
    amount: Number(expense.amount ?? 0),
    purchaseDate: expense.purchaseDate ?? "",
    billImageUrl: normalizeGoogleDriveUrl(expense.billImageUrl ?? ""),
    createdBy: expense.createdBy ?? "Unknown",
    creatorId: expense.creatorId,
    checkedBy: expense.checkedBy,
    checkerId: expense.checkerId,
    status:
      expense.status === "approved" || expense.status === "rejected" || expense.status === "pending"
        ? expense.status
        : "pending",
    transactionType,
    checkerNote: expense.checkerNote,
    createdAt: expense.createdAt ?? new Date().toISOString(),
  };
}

function normalizeLedger(ledger: Partial<Ledger> | null | undefined): Ledger | null {
  if (!ledger?.id) {
    return null;
  }

  return {
    id: String(ledger.id),
    label: ledger.label ?? "Main Petty Cash",
    openingBalance: Number(ledger.openingBalance ?? 0),
    currentBalance: Number(ledger.currentBalance ?? 0),
  };
}

async function readEnvelope<T>(response: Response): Promise<T> {
  const rawText = await response.text();
  let parsed: GoogleSheetsEnvelope<T> | T;

  try {
    parsed = JSON.parse(rawText) as GoogleSheetsEnvelope<T> | T;
  } catch {
    throw new Error(rawText || `Google Sheets request failed with status ${response.status}.`);
  }

  if (!response.ok) {
    const error = (parsed as GoogleSheetsEnvelope<T>).error;
    throw new Error(error || `Google Sheets request failed with status ${response.status}.`);
  }

  const envelope = parsed as GoogleSheetsEnvelope<T>;
  if (typeof envelope.ok === "boolean") {
    if (!envelope.ok) {
      throw new Error(envelope.error || "Google Sheets request failed.");
    }

    return envelope.data as T;
  }

  return parsed as T;
}

async function getJson<T>(action: string) {
  const baseUrl = requireWebAppUrl();
  const url = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}action=${encodeURIComponent(action)}`;
  const response = await fetch(url);
  return readEnvelope<T>(response);
}

async function postJson<T>(payload: Record<string, unknown>) {
  const response = await fetch(requireWebAppUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(payload),
  });

  return readEnvelope<T>(response);
}

export async function googleSheetsFetchBootstrap(): Promise<BootstrapResponse> {
  const data = await getJson<BootstrapResponse>("bootstrap");
  return {
    ledger: normalizeLedger(data.ledger),
    expenses: Array.isArray(data.expenses) ? data.expenses.map(normalizeExpense).sort(compareExpensesNewestFirst) : [],
  };
}

export async function googleSheetsEnsureDefaultLedger() {
  const data = await postJson<Ledger>({
    action: "ensureLedger",
    ledger: {
      id: "sheet-ledger-1",
      label: "Main Petty Cash",
      openingBalance: 0,
      currentBalance: 0,
    },
  });

  return normalizeLedger(data);
}

export async function googleSheetsFetchLedger() {
  const data = await getJson<Ledger | null>("ledger");
  return normalizeLedger(data);
}

export async function googleSheetsFetchExpenses() {
  const data = await getJson<Expense[]>("expenses");
  return Array.isArray(data) ? data.map(normalizeExpense).sort(compareExpensesNewestFirst) : [];
}

export async function googleSheetsCreateExpense(expense: Expense & { ledgerId: string }) {
  await postJson({
    action: "createExpense",
    expense,
  });
}

export async function googleSheetsUpdateExpenseImage(input: {
  expenseId: string;
  billImageUrl: string;
}) {
  await postJson({
    action: "updateExpenseImage",
    ...input,
  });
}

export async function googleSheetsUpdateExpenseStatus(input: {
  expenseId: string;
  status: Expense["status"];
  checkerId?: string;
  checkedBy?: string;
  checkerNote?: string;
}) {
  await postJson({
    action: "updateExpenseStatus",
    ...input,
  });
}

export async function googleSheetsUpdateExpense(input: {
  expenseId: string;
  accountingHead?: string;
  description?: string;
  amount?: number;
  purchaseDate?: string;
  billImageUrl?: string;
  transactionType?: TransactionType;
}) {
  await postJson({
    action: "updateExpense",
    ...input,
  });
}

export async function googleSheetsUploadBillImage(imageUri: string, userId: string) {
  const info = await FileSystem.getInfoAsync(imageUri);
  if (!info.exists) {
    throw new Error("Selected slip image is no longer available on this device.");
  }

  if ("size" in info && typeof info.size === "number" && info.size > 750 * 1024) {
    throw new Error("Slip image is too large. Please retake it a little smaller or choose a lighter image.");
  }

  const fileExt = normalizeAssetExtension(imageUri);
  const mimeType = getImageMimeType(fileExt);
  const base64Data = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const data = await postJson<UploadResponse>({
    action: "uploadBillImage",
    userId,
    fileName: `${userId}-${Date.now()}.${fileExt}`,
    mimeType,
    base64Data,
  });

  return data.url;
}
