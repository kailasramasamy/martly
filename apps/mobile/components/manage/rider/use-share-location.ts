import { useState, useEffect, useCallback, useRef } from "react";
import { Linking } from "react-native";
import * as Location from "expo-location";
import { api } from "../../../lib/api";

export type LocationAccess = "granted" | "askable" | "blocked";

const WATCH = { accuracy: Location.Accuracy.Balanced, timeInterval: 15000, distanceInterval: 50 };

function sender(tripId: string, onSent: () => void) {
  return (position: Location.LocationObject) => {
    const { latitude, longitude, heading, speed } = position.coords;
    const body = { tripId, lat: latitude, lng: longitude, ...(heading !== null && heading >= 0 ? { heading } : {}), ...(speed !== null && speed >= 0 ? { speed } : {}) };
    // A missed position is simply replaced by the next one
    api.post("/api/v1/rider-location", body).then(onSent, () => undefined);
  };
}

/**
 * While a trip is on the road and the screen is mounted, share the rider's position every ~15 s / 50 m.
 * `retry` asks for permission again, or opens Settings once the system won't ask any more.
 */
export function useShareLocation(tripId: string | null, onSent: () => void) {
  const [access, setAccess] = useState<LocationAccess>("granted");
  const [attempt, setAttempt] = useState(0);
  const sent = useRef(onSent);
  sent.current = onSent;

  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;
    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      setAccess(permission.granted ? "granted" : permission.canAskAgain ? "askable" : "blocked");
      if (!permission.granted) return;
      const watch = await Location.watchPositionAsync(WATCH, sender(tripId, () => sent.current()));
      if (cancelled) watch.remove();
      else subscription = watch;
    })();
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [tripId, attempt]);

  const retry = useCallback(() => {
    if (access === "blocked") Linking.openSettings();
    else setAttempt((n) => n + 1);
  }, [access]);

  return { access: tripId ? access : "granted", retry };
}
