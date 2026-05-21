import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { PettyCashProvider } from "../context/PettyCashContext";
import { useSession } from "../context/SessionContext";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { AuthScreen } from "./AuthScreen";
import { DashboardScreen } from "./DashboardScreen";

export function RootNavigator() {
  const { backendMode, loading, session } = useSession();
  const [demoMode, setDemoMode] = React.useState(false);
  const canUseDemoMode = backendMode === "local" || backendMode === "googleSheets";
  const effectiveDemoMode = canUseDemoMode && demoMode && !session;
  usePushNotifications(session);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color="#7FD1B9" size="large" />
      </View>
    );
  }

  if (!session && !effectiveDemoMode) {
    return <AuthScreen backendMode={backendMode} onUseDemoMode={() => setDemoMode(true)} />;
  }

  return (
    <PettyCashProvider session={session} realtimeEnabled={Boolean(session)}>
      <DashboardScreen />
    </PettyCashProvider>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#07111F",
  },
});
