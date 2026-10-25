import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** The phone's Reduce Motion setting; animations jump straight to their end (or only fade) when it's on */
export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}
