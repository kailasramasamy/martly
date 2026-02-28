import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { api } from "./api";

const isExpoGo = Constants.executionEnvironment === "storeClient";

let Notifications: typeof import("expo-notifications") | null = null;
if (!isExpoGo) {
  Notifications = require("expo-notifications");
}

if (Notifications && Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("default", {
    name: "Martly",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    sound: "default",
  });
}

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Notifications || !Device.isDevice) {
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
  } catch {}
}

export function addNotificationResponseListener(
  handler: (response: any) => void,
) {
  if (!Notifications) {
    return { remove: () => {} };
  }
  return Notifications.addNotificationResponseReceivedListener(handler);
}

export async function getLastNotificationResponse(): Promise<any | null> {
  if (!Notifications) return null;
  try {
    return await Notifications.getLastNotificationResponseAsync();
  } catch {
    return null;
  }
}
