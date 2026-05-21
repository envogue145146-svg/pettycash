import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import { AsyncStorage } from "expo-sqlite/kv-store";
import { backendMode } from "../lib/backend";
import {
  getImageMimeType,
  normalizeAssetExtension,
  readUploadBytes,
} from "../lib/fileUploads";
import {
  firebaseCreateExpense,
  firebaseEnsureDefaultLedger,
  firebaseEnsureProfileForSession,
  firebaseFetchExpenses,
  firebaseFetchLedger,
  firebaseFetchProfile,
  firebaseGetSession,
  firebaseOnAuthStateChange,
  firebaseSignIn,
  firebaseSignOut,
  firebaseSignUp,
  firebaseSubscribeToRealtime,
  firebaseUpdateExpense,
  firebaseUpdateExpenseStatus,
  firebaseUploadBillImage,
  firebaseUpsertProfile,
} from "../lib/firebase";
import {
  googleSheetsCreateExpense,
  googleSheetsEnsureDefaultLedger,
  googleSheetsFetchBootstrap,
  googleSheetsFetchExpenses,
  googleSheetsFetchLedger,
  googleSheetsUpdateExpense,
  googleSheetsUpdateExpenseImage,
  googleSheetsUpdateExpenseStatus,
  googleSheetsUploadBillImage,
} from "../lib/googleSheets";
import { getFriendlyErrorMessage } from "../lib/errorMessages";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { AppSession, Expense, ExpenseDraft, ImageSourceMode, Ledger, Profile, TransactionType, UserRole } from "../types";

const billBucket = "expense-bills";
const storageKeys = {
  users: "pettyCash.local.users",
  session: "pettyCash.local.session",
  expenses: "pettyCash.local.expenses",
  ledger: "pettyCash.local.ledger",
  imageDraft: "pettyCash.local.imageDraft",
  accountingHeads: "pettyCash.local.accountingHeads",
};

const draftImageDirectory = `${FileSystem.documentDirectory ?? ""}petty-cash-drafts/`;

type ExpenseRow = {
  id: string;
  accounting_head: string | null;
  description: string;
  amount: number;
  purchase_date: string;
  bill_image_path: string | null;
  status: "pending" | "approved" | "rejected";
  transaction_type: TransactionType | null;
  creator_id: string;
  checker_id: string | null;
  checker_note: string | null;
  created_at: string;
  creator: { full_name: string }[] | { full_name: string } | null;
  checker: { full_name: string }[] | { full_name: string } | null;
};

type LocalUser = {
  id: string;
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
};

type LocalExpense = {
  id: string;
  accountingHead?: string;
  description: string;
  amount: number;
  purchaseDate: string;
  billImageUrl: string;
  createdBy: string;
  creatorId: string;
  checkedBy?: string;
  checkerId?: string;
  status: "pending" | "approved" | "rejected";
  transactionType: TransactionType;
  checkerNote?: string;
  createdAt: string;
};

type SessionListener = (session: AppSession | null) => void;
type DataListener = () => void;

const sessionListeners = new Set<SessionListener>();
const dataListeners = new Set<DataListener>();

function createLocalSession(user: LocalUser): AppSession {
  return {
    user: {
      id: user.id,
      email: user.email,
      user_metadata: {
        full_name: user.fullName,
        role: user.role,
      },
    },
  };
}

function normalizeAccountingHead(label: string) {
  return label.trim().replace(/\s+/g, " ");
}

function uniqueAccountingHeads(heads: string[]) {
  const seen = new Set<string>();
  return heads
    .map(normalizeAccountingHead)
    .filter((head) => {
      if (!head) {
        return false;
      }

      const key = head.toLowerCase();
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const rawValue = await AsyncStorage.getItem(key);
  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string, value: unknown) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

async function ensureDraftImageDirectory() {
  if (!FileSystem.documentDirectory) {
    throw new Error("Local file storage is not available on this device.");
  }

  const info = await FileSystem.getInfoAsync(draftImageDirectory);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(draftImageDirectory, { intermediates: true });
  }
}

async function saveDraftImageUri(uri: string) {
  await AsyncStorage.setItem(storageKeys.imageDraft, uri);
}

async function clearDraftImageUri() {
  await AsyncStorage.removeItem(storageKeys.imageDraft);
}

async function copyBillImageToLocalDraft(uri: string) {
  if (Platform.OS === "web") {
    await saveDraftImageUri(uri);
    return uri;
  }
  await ensureDraftImageDirectory();
  const fileExt = uri.split(".").pop()?.split("?")[0]?.toLowerCase() || "jpg";
  const destination = `${draftImageDirectory}bill-${Date.now()}.${fileExt}`;
  await FileSystem.copyAsync({
    from: uri,
    to: destination,
  });
  await saveDraftImageUri(destination);
  return destination;
}

export async function getSavedDraftImageUri() {
  const savedUri = await AsyncStorage.getItem(storageKeys.imageDraft);
  if (!savedUri) {
    return "";
  }

  if (Platform.OS === "web") {
    return savedUri;
  }

  const info = await FileSystem.getInfoAsync(savedUri);
  if (!info.exists) {
    await clearDraftImageUri();
    return "";
  }

  return savedUri;
}

export async function clearSelectedBillImage() {
  const savedUri = await AsyncStorage.getItem(storageKeys.imageDraft);
  if (savedUri) {
    if (Platform.OS !== "web") {
      const info = await FileSystem.getInfoAsync(savedUri);
      if (info.exists) {
        await FileSystem.deleteAsync(savedUri, { idempotent: true });
      }
    }
  }

  await clearDraftImageUri();
}

async function getLocalUsers() {
  return readJson<LocalUser[]>(storageKeys.users, []);
}

async function saveLocalUsers(users: LocalUser[]) {
  await writeJson(storageKeys.users, users);
}

async function getLocalExpenses() {
  return readJson<LocalExpense[]>(storageKeys.expenses, []);
}

async function saveLocalExpenses(expenses: LocalExpense[]) {
  await writeJson(storageKeys.expenses, expenses);
}

async function getLocalLedgerRecord() {
  return readJson<Ledger | null>(storageKeys.ledger, null);
}

async function getStoredAccountingHeads() {
  const savedHeads = await readJson<string[]>(storageKeys.accountingHeads, ["Petty Cash"]);
  return uniqueAccountingHeads(savedHeads.length ? savedHeads : ["Petty Cash"]);
}

async function setLocalSession(session: AppSession | null) {
  if (session) {
    await writeJson(storageKeys.session, session);
  } else {
    await AsyncStorage.removeItem(storageKeys.session);
  }

  sessionListeners.forEach((listener) => listener(session));
}

function emitDataChanged() {
  dataListeners.forEach((listener) => listener());
}

function requireClient() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  return supabase;
}

function getName(value: ExpenseRow["creator"]) {
  if (!value) {
    return "Unknown";
  }

  return Array.isArray(value) ? value[0]?.full_name ?? "Unknown" : value.full_name;
}

function getOptionalName(value: ExpenseRow["checker"]) {
  if (!value) {
    return undefined;
  }

  return Array.isArray(value) ? value[0]?.full_name : value.full_name;
}

function toPublicUrl(path: string | null) {
  if (!path || !supabase) {
    return path ?? "";
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return supabase.storage.from(billBucket).getPublicUrl(path).data.publicUrl;
}

function getSessionRole(session: AppSession, fallbackRole: UserRole = "creator"): UserRole {
  const metadataRole = session.user.user_metadata?.role;
  return metadataRole === "checker" ? "checker" : fallbackRole;
}

function getDefaultOpeningBalanceDate() {
  return `${new Date().getFullYear()}-01-01`;
}

function mapLedger(row: Record<string, unknown>): Ledger {
  return {
    id: String(row.id),
    label: String(row.label),
    openingBalance: Number(row.opening_balance),
    currentBalance: Number(row.current_balance),
    openingBalanceDate:
      typeof row.opening_balance_date === "string" && row.opening_balance_date.trim()
        ? row.opening_balance_date
        : undefined,
  };
}

function mapExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    accountingHead: row.accounting_head ?? undefined,
    description: row.description,
    amount: Number(row.amount),
    purchaseDate: row.purchase_date,
    billImageUrl: toPublicUrl(row.bill_image_path),
    createdBy: getName(row.creator),
    creatorId: row.creator_id,
    checkedBy: getOptionalName(row.checker),
    checkerId: row.checker_id ?? undefined,
    checkerNote: row.checker_note ?? undefined,
    status: row.status,
    transactionType: row.transaction_type === "credit" ? "credit" : "debit",
    createdAt: row.created_at,
  };
}

export async function getSession() {
  if (backendMode === "firebase") {
    return firebaseGetSession();
  }

  if (backendMode === "supabase") {
    const client = requireClient();
    const { data } = await client.auth.getSession();
    return (data.session as AppSession | null) ?? null;
  }

  return readJson<AppSession | null>(storageKeys.session, null);
}

export function onAuthStateChange(listener: SessionListener) {
  if (backendMode === "firebase") {
    return firebaseOnAuthStateChange(listener);
  }

  if (backendMode === "supabase") {
    const client = requireClient();
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      listener((nextSession as AppSession | null) ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }

  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

export async function ensureDefaultLedger() {
  if (backendMode === "firebase") {
    return firebaseEnsureDefaultLedger();
  }

  if (backendMode === "googleSheets") {
    return googleSheetsEnsureDefaultLedger();
  }

  if (backendMode === "supabase" && isSupabaseConfigured) {
    const client = requireClient();
    const { data: existing, error: fetchError } = await client
      .from("cash_ledgers")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (existing) {
      return mapLedger(existing);
    }

    const { data, error } = await client
      .from("cash_ledgers")
      .insert({
        label: "Main Petty Cash",
        opening_balance: 0,
        current_balance: 0,
        opening_balance_date: getDefaultOpeningBalanceDate(),
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "42501") {
        throw new Error(
          "Unable to create the default petty cash ledger. Update the Supabase ledger insert policy from supabase/schema.sql and retry.",
        );
      }
      throw error;
    }

    return mapLedger(data);
  }

  const existingLedger = await getLocalLedgerRecord();
  if (existingLedger) {
    return existingLedger;
  }

  const ledger: Ledger = {
    id: "local-ledger-1",
    label: "Main Petty Cash",
    openingBalance: 0,
    currentBalance: 0,
    openingBalanceDate: getDefaultOpeningBalanceDate(),
  };

  await writeJson(storageKeys.ledger, ledger);
  emitDataChanged();
  return ledger;
}

export async function fetchLedger() {
  if (backendMode === "firebase") {
    return firebaseFetchLedger();
  }

  if (backendMode === "googleSheets") {
    return googleSheetsFetchLedger();
  }

  if (backendMode === "supabase" && isSupabaseConfigured) {
    const client = requireClient();
    const { data, error } = await client
      .from("cash_ledgers")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? mapLedger(data) : null;
  }

  return getLocalLedgerRecord();
}

async function getApprovedLedgerNetForSupabase(ledgerId: string) {
  const client = requireClient();
  const { data, error } = await client
    .from("expenses")
    .select("amount, transaction_type")
    .eq("ledger_id", ledgerId)
    .eq("status", "approved");

  if (error) {
    throw error;
  }

  return (data ?? []).reduce((total, row) => {
    const amount = Number(row.amount ?? 0);
    return total + (row.transaction_type === "credit" ? amount : -amount);
  }, 0);
}

export async function updateLedgerSettings(input: { ledgerId: string; openingBalance: number; openingBalanceDate: string }) {
  const nextOpeningBalanceDate = input.openingBalanceDate.trim() || getDefaultOpeningBalanceDate();

  if (backendMode === "supabase") {
    const client = requireClient();
    const approvedNet = await getApprovedLedgerNetForSupabase(input.ledgerId);
    const { data, error } = await client
      .from("cash_ledgers")
      .update({
        opening_balance: input.openingBalance,
        opening_balance_date: nextOpeningBalanceDate,
        current_balance: input.openingBalance + approvedNet,
      })
      .eq("id", input.ledgerId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return mapLedger(data);
  }

  const currentLedger = (await getLocalLedgerRecord()) ?? {
    id: input.ledgerId,
    label: "Main Petty Cash",
    openingBalance: 0,
    currentBalance: 0,
    openingBalanceDate: getDefaultOpeningBalanceDate(),
  };
  const localExpenses = await getLocalExpenses();
  const approvedNet = localExpenses
    .filter((expense) => expense.status === "approved")
    .reduce((total, expense) => total + (expense.transactionType === "credit" ? expense.amount : -expense.amount), 0);

  const nextLedger: Ledger = {
    ...currentLedger,
    openingBalance: input.openingBalance,
    openingBalanceDate: nextOpeningBalanceDate,
    currentBalance: input.openingBalance + approvedNet,
  };

  await writeJson(storageKeys.ledger, nextLedger);
  emitDataChanged();
  return nextLedger;
}

export async function fetchProfile(userId: string) {
  if (backendMode === "firebase") {
    return firebaseFetchProfile(userId);
  }

  if (backendMode === "supabase") {
    const client = requireClient();
    const { data, error } = await client.from("profiles").select("*").eq("id", userId).maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    return {
      id: data.id,
      fullName: data.full_name,
      email: data.email,
      role: data.role,
    } satisfies Profile;
  }

  const users = await getLocalUsers();
  const user = users.find((entry) => entry.id === userId);
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
  } satisfies Profile;
}

export async function upsertProfile(profile: Profile) {
  if (backendMode === "firebase") {
    await firebaseUpsertProfile(profile);
    return;
  }

  if (backendMode === "supabase") {
    const client = requireClient();
    const { error } = await client.from("profiles").upsert({
      id: profile.id,
      full_name: profile.fullName,
      email: profile.email,
      role: profile.role,
    });

    if (error) {
      throw error;
    }

    return;
  }

  const users = await getLocalUsers();
  const existingIndex = users.findIndex((entry) => entry.id === profile.id);
  const nextUser: LocalUser = {
    id: profile.id,
    email: profile.email,
    fullName: profile.fullName,
    role: profile.role,
    password: existingIndex >= 0 ? users[existingIndex].password : "",
  };

  if (existingIndex >= 0) {
    users[existingIndex] = nextUser;
  } else {
    users.push(nextUser);
  }

  await saveLocalUsers(users);
  const session = await getSession();
  if (session?.user.id === profile.id) {
    await setLocalSession(createLocalSession(nextUser));
  }
}

export async function ensureProfileForSession(session: AppSession, fallbackRole: UserRole = "creator") {
  if (backendMode === "firebase") {
    return firebaseEnsureProfileForSession(session, fallbackRole);
  }

  const existingProfile = await fetchProfile(session.user.id);

  if (existingProfile) {
    return existingProfile;
  }

  const profile: Profile = {
    id: session.user.id,
    email: session.user.email ?? "",
    fullName: session.user.user_metadata?.full_name?.trim() || session.user.email?.split("@")[0] || "Petty Cash User",
    role: getSessionRole(session, fallbackRole),
  };

  await upsertProfile(profile);
  return profile;
}

export async function fetchExpenses() {
  if (backendMode === "firebase") {
    return firebaseFetchExpenses();
  }

  if (backendMode === "googleSheets") {
    return googleSheetsFetchExpenses();
  }

  if (backendMode === "supabase" && isSupabaseConfigured) {
    const client = requireClient();
    const { data, error } = await client
      .from("expenses")
      .select(`
      id,
      accounting_head,
      description,
      amount,
      purchase_date,
      bill_image_path,
      status,
      transaction_type,
      creator_id,
      checker_id,
      checker_note,
      created_at,
      creator:profiles!expenses_creator_id_fkey(full_name),
      checker:profiles!expenses_checker_id_fkey(full_name)
    `)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return (data as ExpenseRow[]).map(mapExpense);
  }

  const expenses = await getLocalExpenses();
  return [...expenses].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function createExpense(input: {
  id?: string;
  accountingHead?: string;
  description: string;
  amount: number;
  purchaseDate: string;
  billImagePath?: string;
  transactionType?: TransactionType;
  session: AppSession;
  ledgerId: string;
}) {
  if (backendMode === "firebase") {
    await firebaseCreateExpense(input);
    return undefined;
  }

  if (backendMode === "googleSheets") {
    const profile = await ensureProfileForSession(input.session);
    await googleSheetsCreateExpense({
      id: input.id ?? `sheet-expense-${Date.now()}`,
      ledgerId: input.ledgerId,
      accountingHead: input.accountingHead ?? "",
      description: input.description,
      amount: input.amount,
      purchaseDate: input.purchaseDate,
      billImageUrl: input.billImagePath ?? "",
      createdBy: profile.fullName,
      creatorId: profile.id,
      status: "pending",
      transactionType: input.transactionType === "credit" ? "credit" : "debit",
      createdAt: new Date().toISOString(),
    });
    return input.id ?? undefined;
  }

  if (backendMode === "supabase") {
    const client = requireClient();
    const { data, error } = await client
      .from("expenses")
      .insert({
        ledger_id: input.ledgerId,
        accounting_head: input.accountingHead ?? null,
        description: input.description,
        amount: input.amount,
        purchase_date: input.purchaseDate,
        bill_image_path: input.billImagePath ?? null,
        transaction_type: input.transactionType === "credit" ? "credit" : "debit",
        creator_id: input.session.user.id,
      })
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    setTimeout(() => {
      void (async () => {
        try {
          const { error: notifyError } = await client.functions.invoke("notify-expense-users", {
            body: {
              type: "expense_created",
              expenseId: data.id,
              actorName: input.session.user.email ?? "Creator",
              message: `${input.description} submitted for approval`,
            },
          });

          if (notifyError) {
            console.warn("notify-expense-users failed:", notifyError.message);
          }
        } catch (notifyError) {
          console.warn("notify-expense-users threw an error:", notifyError);
        }
      })();
    }, 0);

    return data.id as string;
  }

  const profile = await ensureProfileForSession(input.session);
  const expenses = await getLocalExpenses();
  const nextExpense: LocalExpense = {
    id: `local-expense-${Date.now()}`,
    accountingHead: input.accountingHead ?? "",
    description: input.description,
    amount: input.amount,
    purchaseDate: input.purchaseDate,
    billImageUrl: input.billImagePath ?? "",
    createdBy: profile.fullName,
    creatorId: profile.id,
    status: "pending",
    transactionType: input.transactionType === "credit" ? "credit" : "debit",
    createdAt: new Date().toISOString(),
  };

  expenses.unshift(nextExpense);
  await saveLocalExpenses(expenses);
  emitDataChanged();
  return nextExpense.id;
}

export async function updateExpenseStatus(
  expenseId: string,
  status: "approved" | "rejected",
  session: AppSession,
  checkerNote?: string,
) {
  if (backendMode === "firebase") {
    await firebaseUpdateExpenseStatus(expenseId, status, session, checkerNote);
    return;
  }

  if (backendMode === "googleSheets") {
    const profile = await ensureProfileForSession(session, "checker");
    await googleSheetsUpdateExpenseStatus({
      expenseId,
      status,
      checkerId: profile.id,
      checkedBy: profile.fullName,
      checkerNote,
    });
    return;
  }

  if (backendMode === "supabase") {
    const client = requireClient();
    const checkerProfile = await ensureProfileForSession(session, "checker");
    const { error } = await client
      .from("expenses")
      .update({
        status,
        checker_id: session.user.id,
        checker_note: checkerNote ?? null,
      })
      .eq("id", expenseId);

    if (error) {
      throw error;
    }

    try {
      const actionLabel = status === "approved" ? "approved" : "rejected";
      const { error: notifyError } = await client.functions.invoke("notify-expense-users", {
        body: {
          type: `expense_${status}`,
          expenseId,
          actorName: checkerProfile.fullName || session.user.email || "Checker",
          message: `Expense ${actionLabel}${checkerNote ? ` with note: ${checkerNote}` : ""}`,
        },
      });

      if (notifyError) {
        console.warn("notify-expense-users failed:", notifyError.message);
      }
    } catch (notifyError) {
      console.warn("notify-expense-users threw an error:", notifyError);
    }

    return;
  }

  const profile = await ensureProfileForSession(session, "checker");
  const expenses = await getLocalExpenses();
  const nextExpenses = expenses.map((expense) =>
    expense.id === expenseId
      ? {
          ...expense,
          status,
          checkerId: profile.id,
          checkedBy: profile.fullName,
          checkerNote: checkerNote ?? expense.checkerNote,
        }
      : expense,
  );

  await saveLocalExpenses(nextExpenses);
  emitDataChanged();
}

export async function deleteExpense(expenseId: string) {
  if (backendMode === "supabase") {
    const client = requireClient();
    const { error } = await client.from("expenses").delete().eq("id", expenseId);
    if (error) throw error;
    return;
  }
  const expenses = await getLocalExpenses();
  await saveLocalExpenses(expenses.filter((e) => e.id !== expenseId));
  emitDataChanged();
}

export async function updateExpense(expenseId: string, updates: Partial<ExpenseDraft>) {
  const normalizedAmount =
    updates.amount !== undefined ? Number(String(updates.amount).replace(/[^0-9.-]+/g, "")) : undefined;

  if (backendMode === "firebase") {
    await firebaseUpdateExpense(expenseId, {
      accountingHead: updates.accountingHead,
      description: updates.description,
      amount: normalizedAmount,
      purchaseDate: updates.purchaseDate,
      billImageUrl: updates.billImageUrl,
      transactionType: updates.transactionType,
    });
    return;
  }

  if (backendMode === "googleSheets") {
    await googleSheetsUpdateExpense({
      expenseId,
      accountingHead: updates.accountingHead,
      description: updates.description,
      amount: normalizedAmount,
      purchaseDate: updates.purchaseDate,
      billImageUrl: updates.billImageUrl,
      transactionType: updates.transactionType,
    });
    return;
  }

  if (backendMode === "supabase") {
    const client = requireClient();
    const payload: Record<string, any> = {};
    if (updates.accountingHead !== undefined) payload.accounting_head = updates.accountingHead;
    if (updates.description !== undefined) payload.description = updates.description;
    if (normalizedAmount !== undefined) payload.amount = normalizedAmount;
    if (updates.purchaseDate !== undefined) payload.purchase_date = updates.purchaseDate;
    if (updates.billImageUrl !== undefined) payload.bill_image_path = updates.billImageUrl;
    if (updates.transactionType !== undefined) payload.transaction_type = updates.transactionType;

    const { error } = await client.from("expenses").update(payload).eq("id", expenseId);
    if (error) throw error;
    return;
  }
  
  const expenses = await getLocalExpenses();
  const nextExpenses = expenses.map((e) => {
    if (e.id === expenseId) {
      return {
        ...e,
        accountingHead: updates.accountingHead ?? e.accountingHead,
        description: updates.description ?? e.description,
        amount: normalizedAmount ?? e.amount,
        purchaseDate: updates.purchaseDate ?? e.purchaseDate,
        billImageUrl: updates.billImageUrl ?? e.billImageUrl,
        transactionType: updates.transactionType ?? e.transactionType,
      };
    }
    return e;
  });
  await saveLocalExpenses(nextExpenses);
  emitDataChanged();
}

export async function uploadBillImage(imageUri: string, userId: string) {
  if (backendMode === "firebase") {
    return firebaseUploadBillImage(imageUri, userId);
  }

  if (backendMode === "googleSheets") {
    return googleSheetsUploadBillImage(imageUri, userId);
  }

  if (backendMode === "supabase") {
    const client = requireClient();
    const fileExt = normalizeAssetExtension(imageUri);
    const path = `${userId}/${Date.now()}.${fileExt}`;
    const bytes = await readUploadBytes(imageUri);

    const { error } = await client.storage.from(billBucket).upload(path, bytes, {
      contentType: getImageMimeType(fileExt),
      upsert: false,
    });

    if (error) {
      throw error;
    }

    return path;
  }

  return imageUri;
}

export async function updateExpenseImage(expenseId: string, billImageUrl: string) {
  if (backendMode === "supabase") {
    const client = requireClient();
    const { error } = await client.from("expenses").update({ bill_image_path: billImageUrl }).eq("id", expenseId);
    if (error) {
      throw error;
    }
    return;
  }

  if (backendMode === "googleSheets") {
    await googleSheetsUpdateExpenseImage({
      expenseId,
      billImageUrl,
    });
  }
}

export async function pickBillImage(mode: ImageSourceMode) {
  if (mode === "gallery") {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      throw new Error("Media library permission is required to attach a bill image.");
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.2,
    });

    if (result.canceled || !result.assets?.[0]) {
      return null;
    }

    const asset = result.assets[0];
    const localUri = await copyBillImageToLocalDraft(asset.uri);
    return {
      ...asset,
      uri: localUri,
    };
  }

  const permission = await ImagePicker.requestCameraPermissionsAsync();

  if (!permission.granted) {
    throw new Error("Camera permission is required to capture a bill image.");
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    quality: 0.2,
  });

  if (result.canceled || !result.assets?.[0]) {
    return null;
  }

  const asset = result.assets[0];
  const localUri = await copyBillImageToLocalDraft(asset.uri);
  return {
    ...asset,
    uri: localUri,
  };
}

export function subscribeToRealtime(refresh: () => Promise<void>) {
  if (backendMode === "firebase") {
    return firebaseSubscribeToRealtime(refresh);
  }

  if (backendMode === "googleSheets") {
    const intervalId = setInterval(() => {
      void refresh();
    }, 15000);

    return () => {
      clearInterval(intervalId);
    };
  }

  if (backendMode === "supabase") {
    const client = requireClient();
    const channel = client
      .channel("petty-cash-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, () => {
        void refresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "cash_ledgers" }, () => {
        void refresh();
      })
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }

  const wrapped = () => {
    void refresh();
  };

  dataListeners.add(wrapped);
  return () => {
    dataListeners.delete(wrapped);
  };
}

export async function signOut() {
  if (backendMode === "firebase") {
    await firebaseSignOut();
    return;
  }

  if (backendMode === "supabase") {
    const client = requireClient();
    const { error } = await client.auth.signOut();

    if (error) {
      throw error;
    }

    return;
  }

  await setLocalSession(null);
}

export async function signIn(email: string, password: string) {
  if (backendMode === "firebase") {
    try {
      await firebaseSignIn(email, password);
    } catch (error) {
      throw new Error(getFriendlyErrorMessage(error, "Unable to sign in."));
    }
    return;
  }

  if (backendMode === "supabase") {
    const client = requireClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(getFriendlyErrorMessage(error, "Unable to sign in."));
    }
    return;
  }

  const users = await getLocalUsers();
  const normalizedEmail = email.trim().toLowerCase();
  const user = users.find((entry) => entry.email.toLowerCase() === normalizedEmail);

  if (!user || user.password !== password) {
    throw new Error("Email or password is incorrect.");
  }

  await setLocalSession(createLocalSession(user));
}

export async function signUp(email: string, password: string, fullName: string, role: UserRole) {
  if (backendMode === "firebase") {
    try {
      await firebaseSignUp(email, password, fullName, role);
      await ensureDefaultLedger();
    } catch (error) {
      throw new Error(getFriendlyErrorMessage(error, "Unable to create account."));
    }
    return;
  }

  if (backendMode === "supabase") {
    const client = requireClient();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
        },
      },
    });

    if (error) {
      throw new Error(getFriendlyErrorMessage(error, "Unable to create account."));
    }

    if (data.user) {
      await upsertProfile({
        id: data.user.id,
        email,
        fullName,
        role,
      });

      await ensureDefaultLedger();
    }

    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const trimmedName = fullName.trim();
  const users = await getLocalUsers();

  if (!normalizedEmail || !password || !trimmedName) {
    throw new Error("Enter full name, email, and password.");
  }

  if (users.some((entry) => entry.email.toLowerCase() === normalizedEmail)) {
    throw new Error("An account with this email already exists on this device.");
  }

  const nextUser: LocalUser = {
    id: `local-user-${Date.now()}`,
    email: normalizedEmail,
    password,
    fullName: trimmedName,
    role,
  };

  users.push(nextUser);
  await saveLocalUsers(users);
  await ensureDefaultLedger();
  await setLocalSession(createLocalSession(nextUser));
}

export async function fetchAccountingHeads() {
  const storedHeads = await getStoredAccountingHeads();

  if (backendMode === "supabase" && isSupabaseConfigured) {
    const client = requireClient();
    const { data, error } = await client
      .from("accounting_heads")
      .select("label")
      .order("label", { ascending: true });

    if (error) {
      throw error;
    }

    const remoteHeads = (data ?? []).map((row) => String(row.label || ""));
    return uniqueAccountingHeads([...storedHeads, ...remoteHeads]);
  }

  if (backendMode === "googleSheets") {
    const expenses = await googleSheetsFetchExpenses();
    const expenseHeads = expenses.map((expense) => expense.accountingHead ?? "");
    return uniqueAccountingHeads([...storedHeads, ...expenseHeads]);
  }

  if (backendMode === "firebase") {
    const expenses = await firebaseFetchExpenses();
    const expenseHeads = expenses.map((expense) => expense.accountingHead ?? "");
    return uniqueAccountingHeads([...storedHeads, ...expenseHeads]);
  }

  return storedHeads.length ? storedHeads : ["Petty Cash"];
}

export async function createAccountingHead(label: string) {
  const normalizedLabel = normalizeAccountingHead(label);
  if (!normalizedLabel) {
    throw new Error("Enter an accounting head name.");
  }

  if (backendMode === "supabase" && isSupabaseConfigured) {
    const client = requireClient();
    const { error } = await client.from("accounting_heads").upsert({ label: normalizedLabel }, { onConflict: "label" });
    if (error) {
      throw error;
    }
  }

  const nextHeads = uniqueAccountingHeads([...(await getStoredAccountingHeads()), normalizedLabel]);
  await writeJson(storageKeys.accountingHeads, nextHeads);
  return nextHeads;
}
