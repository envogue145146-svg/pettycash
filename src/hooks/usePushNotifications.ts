import { useEffect } from "react";
import { Alert, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { backendMode } from "../lib/backend";
import { savePushToken, registerForPushNotificationsAsync } from "../services/notificationService";
import { AppSession } from "../types";

export function usePushNotifications(session: AppSession | null) {
  useEffect(() => {
    if (!session || backendMode === "local" || backendMode === "googleSheets") {
      return;
    }

    let active = true;

    if (Platform.OS === "android") {
      void Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    registerForPushNotificationsAsync()
      .then((token) => {
        if (active && token) {
          return savePushToken(session.user.id, token);
        }
        return undefined;
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Unable to enable notifications.";
        Alert.alert("Notifications", message);
      });

    const notificationListener = Notifications.addNotificationReceivedListener(() => undefined);
    const responseListener = Notifications.addNotificationResponseReceivedListener(() => undefined);

    return () => {
      active = false;
      notificationListener.remove();
      responseListener.remove();
    };
  }, [session]);
}
