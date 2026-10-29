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
      shouldShowBanner: false,
      shouldShowList: false,
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
    // The API sends through FCM, which needs an FCM token; on iOS the device token is a raw APNs token FCM rejects
    const { getMessaging, getToken } = require("@react-native-firebase/messaging") as typeof import("@react-native-firebase/messaging");
    const token = await getToken(getMessaging());

    await api.post("/api/v1/device-tokens", {
      token,
      platform: Platform.OS,
    });

    return token;
  } catch {
    return null;
  }
}

/** Best effort: signing out must not wait on a slow network, so this gives up after a few seconds */
export async function unregisterPushToken(token: string): Promise<void> {
  try {
    await api.delete("/api/v1/device-tokens", { token }, 5_000);
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

/**
 * The app's data from a tapped push. Android puts FCM data in `content.data`; on iOS expo-notifications only
 * reads Expo-format pushes there, so an FCM push's fields are in the raw APNs payload (`trigger.payload`).
 */
export function notificationResponseData(response: any): Record<string, unknown> | null {
  const request = response?.notification?.request;
  const data = request?.content?.data;
  if (data && Object.keys(data).length > 0) return data;
  const payload = request?.trigger?.payload as Record<string, unknown> | undefined;
  if (!payload) return null;
  const { aps: _aps, ...fields } = payload;
  return Object.keys(fields).length > 0 ? fields : null;
}

export async function getLastNotificationResponse(): Promise<any | null> {
  if (!Notifications) return null;
  try {
    return await Notifications.getLastNotificationResponseAsync();
  } catch {
    return null;
  }
}
