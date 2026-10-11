import { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";

// Light status bar while this screen is focused (it draws a dark hero under the bar). A <StatusBar> element
// would keep applying while the screen sits under a pushed one, leaving the next screen's bar white on white
export function useLightStatusBar() {
  useFocusEffect(useCallback(() => {
    setStatusBarStyle("light");
    return () => setStatusBarStyle("dark");
  }, []));
}
