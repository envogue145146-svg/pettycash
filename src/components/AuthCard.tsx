import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { getFriendlyErrorMessage } from "../lib/errorMessages";
import { AuthFormMode, BackendMode, UserRole } from "../types";
import { signIn, signUp } from "../services/expenseService";

export function AuthCard({
  backendMode,
  onUseDemoMode,
}: {
  backendMode: BackendMode;
  onUseDemoMode: () => void;
}) {
  const canUseDemoMode = backendMode === "local" || backendMode === "googleSheets";
  const [mode, setMode] = useState<AuthFormMode>("signIn");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("creator");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (mode === "signUp") {
        await signUp(email.trim(), password, fullName.trim(), role);
        Alert.alert(
          "Account created",
          backendMode === "supabase"
            ? "Check your email if Supabase email confirmation is enabled."
            : "Your local account is ready on this device.",
        );
      } else {
        await signIn(email.trim(), password);
      }
    } catch (error) {
      const message = getFriendlyErrorMessage(error, "Unable to authenticate.");
      Alert.alert("Authentication failed", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Organization access</Text>
      <Text style={styles.subtitle}>
        {backendMode === "firebase"
          ? "Sign in from mobile or browser with shared cloud data for creators, checkers, and managers."
          : backendMode === "supabase"
            ? "Sign in as creator or checker to use the live petty cash workflow."
            : backendMode === "googleSheets"
              ? "Create a local phone account and sync expense records with your Google Sheet."
              : "Create a local creator or checker account to use the app without cloud hosting costs."}
      </Text>

      <View style={styles.modeRow}>
        <Pressable onPress={() => setMode("signIn")} style={[styles.modeButton, mode === "signIn" && styles.modeButtonActive]}>
          <Text style={[styles.modeText, mode === "signIn" && styles.modeTextActive]}>Sign In</Text>
        </Pressable>
        <Pressable onPress={() => setMode("signUp")} style={[styles.modeButton, mode === "signUp" && styles.modeButtonActive]}>
          <Text style={[styles.modeText, mode === "signUp" && styles.modeTextActive]}>Create Account</Text>
        </Pressable>
      </View>

      {mode === "signUp" ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="Full name"
            placeholderTextColor="#A38C77"
            value={fullName}
            onChangeText={setFullName}
          />
          <View style={styles.roleRow}>
            <Pressable onPress={() => setRole("creator")} style={[styles.roleButton, role === "creator" && styles.roleButtonActive]}>
              <Text style={[styles.roleText, role === "creator" && styles.roleTextActive]}>Creator</Text>
            </Pressable>
            <Pressable onPress={() => setRole("checker")} style={[styles.roleButton, role === "checker" && styles.roleButtonActive]}>
              <Text style={[styles.roleText, role === "checker" && styles.roleTextActive]}>Checker</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#A38C77"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#A38C77"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Pressable onPress={handleSubmit} style={styles.submitButton} disabled={loading}>
        <Text style={styles.submitText}>{loading ? "Please wait..." : mode === "signIn" ? "Sign In" : "Create Account"}</Text>
      </Pressable>

      {canUseDemoMode ? (
        <Pressable onPress={onUseDemoMode} style={styles.demoButton}>
          <Text style={styles.demoText}>Continue In Demo Mode</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFF9F3",
    borderRadius: 28,
    padding: 22,
    gap: 12,
    borderWidth: 1,
    borderColor: "#E6D4C4",
  },
  title: {
    color: "#2F241B",
    fontSize: 24,
    fontWeight: "800",
  },
  subtitle: {
    color: "#7A6858",
    lineHeight: 20,
  },
  modeRow: {
    flexDirection: "row",
    backgroundColor: "#F3E6D9",
    borderRadius: 16,
    padding: 4,
    gap: 6,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  modeButtonActive: {
    backgroundColor: "#CFE9D5",
  },
  modeText: {
    color: "#8A745E",
    fontWeight: "700",
  },
  modeTextActive: {
    color: "#215733",
  },
  input: {
    backgroundColor: "#FFFDF9",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: "#2F241B",
    borderWidth: 1,
    borderColor: "#E6D4C4",
  },
  roleRow: {
    flexDirection: "row",
    gap: 8,
  },
  roleButton: {
    flex: 1,
    backgroundColor: "#FFFDF9",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E6D4C4",
  },
  roleButtonActive: {
    backgroundColor: "#F6EBB5",
    borderWidth: 1,
    borderColor: "#D4B04E",
  },
  roleText: {
    color: "#7A6858",
    fontWeight: "700",
  },
  roleTextActive: {
    color: "#7A5200",
  },
  submitButton: {
    backgroundColor: "#2E6A49",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  submitText: {
    color: "#FFFDF9",
    fontWeight: "800",
  },
  demoButton: {
    borderWidth: 1,
    borderColor: "#D7C2AE",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#FFFDF9",
  },
  demoText: {
    color: "#8A5A30",
    fontWeight: "700",
  },
});
