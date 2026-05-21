import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const expoAccessToken = Deno.env.get("EXPO_ACCESS_TOKEN") ?? "";

const supabase = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async (request) => {
  try {
    const { type, expenseId, actorName, message } = await request.json();

    const { data: tokens, error } = await supabase
      .from("push_tokens")
      .select("expo_push_token");

    if (error) {
      throw error;
    }

    const messages = (tokens ?? []).map((row) => ({
      to: row.expo_push_token,
      sound: "default",
      title: type === "expense_created" ? "New Expense Submitted" : "Petty Cash Update",
      body: `${actorName}: ${message}`,
      data: {
        expenseId,
        type,
      },
    }));

    if (!messages.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });
    }

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(expoAccessToken ? { Authorization: `Bearer ${expoAccessToken}` } : {}),
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const responseText = await response.text();
      return new Response(responseText, { status: response.status });
    }

    return new Response(JSON.stringify({ ok: true, sent: messages.length }), { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notification dispatch failed.";
    return new Response(JSON.stringify({ ok: false, error: message }), { status: 500 });
  }
});
