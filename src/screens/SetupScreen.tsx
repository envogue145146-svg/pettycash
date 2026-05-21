import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SectionTitle } from "../components/SectionTitle";

export function SetupScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <SectionTitle eyebrow="Optional Cloud Sync" title="Use local mode now or add Supabase later" />
        <Text style={styles.text}>
          The app can now run fully in local device mode with no hosted backend cost. Add Supabase for full shared auth, or connect a Google Apps Script web app if you want to sync with an existing Google Sheet.
        </Text>
        <Text style={styles.code}>EXPO_PUBLIC_SUPABASE_URL=...</Text>
        <Text style={styles.code}>EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...</Text>
        <Text style={styles.code}>EXPO_PUBLIC_GOOGLE_SHEETS_WEB_APP_URL=...</Text>
        <Text style={styles.note}>
          Without those keys, accounts and expense data stay on the current device instead of syncing through the cloud.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#07111F",
  },
  card: {
    backgroundColor: "#10233A",
    borderRadius: 28,
    padding: 24,
    gap: 12,
  },
  text: {
    color: "#C4D4E6",
    lineHeight: 21,
  },
  code: {
    color: "#7FD1B9",
    fontWeight: "700",
    backgroundColor: "#0A182A",
    borderRadius: 14,
    padding: 12,
  },
  note: {
    color: "#8FA9C7",
    lineHeight: 20,
  },
});
