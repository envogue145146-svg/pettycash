import React from "react";
import { SafeAreaView, StatusBar, StyleSheet } from "react-native";
import { SessionProvider } from "./src/context/SessionContext";
import { RootNavigator } from "./src/screens/RootNavigator";

export default function App() {
  return (
    <SessionProvider>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <RootNavigator />
      </SafeAreaView>
    </SessionProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F1E8",
  },
});
