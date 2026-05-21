import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { AuthCard } from "../components/AuthCard";
import { LogoWatermark } from "../components/LogoWatermark";
import { SectionTitle } from "../components/SectionTitle";
import { BackendMode } from "../types";

export function AuthScreen({
  backendMode,
  onUseDemoMode,
}: {
  backendMode: BackendMode;
  onUseDemoMode: () => void;
}) {
  const isLocalMode = backendMode === "local";
  const isFirebaseMode = backendMode === "firebase";
  const isGoogleSheetsMode = backendMode === "googleSheets";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <LogoWatermark style={styles.watermark} />
        <SectionTitle
          eyebrow={
            isLocalMode
              ? "Local Mode"
              : isFirebaseMode
                ? "Shared Web Access"
                : isGoogleSheetsMode
                  ? "Google Sheets Sync"
                  : "Petty Cash Live"
          }
          title={
            isLocalMode
              ? "Run petty cash without paying for a backend"
              : isFirebaseMode
                ? "Open petty cash from iPhone, browser, or app"
                : isGoogleSheetsMode
                  ? "Sync petty cash with your existing Google Sheet"
                : "Approve daily expenses from any phone"
          }
        />
        <Text style={styles.text}>
          {isLocalMode
            ? "This build uses on-device storage, so sign-in, expenses, approvals, and bill images work immediately on the phone without Supabase."
            : isFirebaseMode
              ? "Use one shared login system and cloud data so your manager can open a link in Safari, review expenses, approve items, and track the daybook balance daily."
              : isGoogleSheetsMode
                ? "Use your Google Sheet as the shared data store while keeping account sign-in on the phone. Expenses, approvals, and balance can sync through the sheet."
                : "Creators submit cash purchases with bill images, and checkers review them in real time on Android or iPhone."}
        </Text>
      </View>
      <AuthCard backendMode={backendMode} onUseDemoMode={onUseDemoMode} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#F7F1E8",
    gap: 18,
  },
  hero: {
    backgroundColor: "#FDF6EE",
    borderRadius: 28,
    padding: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: "#E7D7C7",
    overflow: "hidden",
  },
  text: {
    color: "#6F5E50",
    lineHeight: 22,
  },
  watermark: {
    position: "absolute",
    right: -8,
    top: 4,
  },
});
