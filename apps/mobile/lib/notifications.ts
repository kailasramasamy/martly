import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { api } from "./api";

// Configure foreground notification display
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
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
    return null;
  }

  try {
    const pushToken = await Notifications.getDevicePushTokenAsync();
    const token = pushToken.data as string;

    // Register token with backend
    await api.post("/api/v1/device-tokens", {
      token,
      platform: Platform.OS,
    });

    return token;
  } catch {
    return null;
  }
}

export async function unregisterPushToken(token: string): Promise<void> {
  try {
    await api.delete("/api/v1/device-tokens", { token });
  } catch {
    // Silently fail — token will be cleaned up on next failed send
  }
}

export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void,
) {
  return Notifications.addNotificationResponseReceivedListener(handler);
}
