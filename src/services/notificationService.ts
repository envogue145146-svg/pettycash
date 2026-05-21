import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { AsyncStorage } from "expo-sqlite/kv-store";
import { backendMode } from "../lib/backend";
import { firebaseSavePushToken } from "../lib/firebase";
import { supabase } from "../lib/supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync() {
  if (backendMode === "local" || backendMode === "googleSheets") {
    return null;
  }

  if (!Device.isDevice) {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

  if (!projectId || projectId === "YOUR_EAS_PROJECT_ID") {
    throw new Error("Set the EAS projectId in app.json before enabling push notifications.");
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });

  return token.data;
}

export async function savePushToken(userId: string, token: string) {
  if (backendMode === "firebase") {
    await firebaseSavePushToken(userId, token);
    return;
  }

  if (backendMode === "local") {
    const existing = await AsyncStorage.getItem("pettyCash.local.pushTokens");
    const parsed = existing ? (JSON.parse(existing) as Record<string, string>) : {};
    parsed[userId] = token;
    await AsyncStorage.setItem("pettyCash.local.pushTokens", JSON.stringify(parsed));
    return;
  }

  if (!supabase) {
    return;
  }

  const { error } = await supabase.from("push_tokens").upsert(
    {
      user_id: userId,
      expo_push_token: token,
      platform: Device.osName ?? "unknown",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,expo_push_token" },
  );

  if (error) {
    throw error;
  }
}
