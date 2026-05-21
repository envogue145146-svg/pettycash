export function getFriendlyErrorMessage(error: unknown, fallback: string) {
  const rawMessage = error instanceof Error ? error.message : fallback;
  const message = rawMessage.trim();
  const lower = message.toLowerCase();

  if (!message) {
    return fallback;
  }

  if (lower.includes("email not confirmed")) {
    return "Your account exists, but email confirmation is still pending. Confirm the email in your backend provider or disable confirmation for testing.";
  }

  if (lower.includes("invalid login credentials")) {
    return "Email or password is incorrect.";
  }

  if (lower.includes("relation") && lower.includes("does not exist")) {
    return `${message} Run the SQL in supabase/schema.sql in your Supabase project.`;
  }

  if (lower.includes("row-level security") || lower.includes("permission denied") || lower.includes("not allowed")) {
    return `${message} Check that the policies from supabase/schema.sql were created in Supabase.`;
  }

  if (lower.includes("jwt") || lower.includes("token")) {
    return `${message} Sign out and sign in again, then retry.`;
  }

  return message;
}
