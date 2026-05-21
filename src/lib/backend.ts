import { isFirebaseConfigured } from "./firebase";
import { isGoogleSheetsConfigured } from "./googleSheets";
import { isSupabaseConfigured } from "./supabase";
import { BackendMode } from "../types";

export const backendMode: BackendMode = isFirebaseConfigured
  ? "firebase"
  : isSupabaseConfigured
    ? "supabase"
    : isGoogleSheetsConfigured
      ? "googleSheets"
    : "local";
