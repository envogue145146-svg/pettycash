import { AsyncStorage } from "expo-sqlite/kv-store";
import { backendMode } from "../lib/backend";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { UserPayment } from "../types";

// Payments made to a user against the expenses they recorded.
// Stored in public.user_payments (see supabase/user-payments.sql).
// They are tracked separately and do not change Cash In Hand.

const localKey = "pettyCash.local.userPayments";

type PaymentRow = {
  id: string;
  user_id: string;
  amount: number | string;
  paid_on: string;
  note: string | null;
  created_at: string;
};

function mapPayment(row: PaymentRow): UserPayment {
  return {
    id: row.id,
    userId: row.user_id,
    amount: Number(row.amount),
    paidOn: row.paid_on,
    note: row.note ?? undefined,
    createdAt: row.created_at,
  };
}

async function readLocal(): Promise<UserPayment[]> {
  try {
    const raw = await AsyncStorage.getItem(localKey);
    return raw ? (JSON.parse(raw) as UserPayment[]) : [];
  } catch {
    return [];
  }
}

async function writeLocal(payments: UserPayment[]) {
  await AsyncStorage.setItem(localKey, JSON.stringify(payments));
}

function getSupabaseClient() {
  return backendMode === "supabase" && isSupabaseConfigured && supabase;
}

export async function fetchUserPayments(): Promise<UserPayment[]> {
  const client = getSupabaseClient();
  if (client) {
    const { data, error } = await client
      .from("user_payments")
      .select("id, user_id, amount, paid_on, note, created_at")
      .order("paid_on", { ascending: true });

    if (error) {
      // Table not created yet: behave as "no payments" instead of breaking the app.
      if (error.code === "42P01" || /user_payments/.test(error.message ?? "")) {
        return [];
      }
      throw error;
    }

    return (data as PaymentRow[]).map(mapPayment);
  }

  if (backendMode === "local") {
    return readLocal();
  }

  return [];
}

export async function createUserPayment(input: { userId: string; amount: number; paidOn: string; note?: string }) {
  const client = getSupabaseClient();
  if (client) {
    const { data, error } = await client
      .from("user_payments")
      .insert({
        user_id: input.userId,
        amount: input.amount,
        paid_on: input.paidOn,
        note: input.note?.trim() || null,
      })
      .select("id, user_id, amount, paid_on, note, created_at")
      .single();

    if (error) {
      throw error;
    }

    return mapPayment(data as PaymentRow);
  }

  if (backendMode === "local") {
    const payment: UserPayment = {
      id: `pay-${Date.now()}`,
      userId: input.userId,
      amount: input.amount,
      paidOn: input.paidOn,
      note: input.note?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    await writeLocal([...(await readLocal()), payment]);
    return payment;
  }

  throw new Error("Recording payments needs the Supabase backend.");
}

export async function deleteUserPayment(paymentId: string) {
  const client = getSupabaseClient();
  if (client) {
    const { error } = await client.from("user_payments").delete().eq("id", paymentId);
    if (error) {
      throw error;
    }
    return;
  }

  if (backendMode === "local") {
    await writeLocal((await readLocal()).filter((payment) => payment.id !== paymentId));
  }
}

export function subscribeToUserPayments(refresh: () => void) {
  const client = getSupabaseClient();
  if (!client) {
    return () => undefined;
  }

  const channel = client
    .channel("petty-cash-user-payments")
    .on("postgres_changes", { event: "*", schema: "public", table: "user_payments" }, () => refresh())
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
