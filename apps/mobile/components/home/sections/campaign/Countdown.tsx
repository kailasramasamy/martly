import { memo, useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { fonts } from "../../../../constants/theme";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const TICK_MS = 30_000;

/** "2d 4h", "3h 12m", "12m"; null once the offer is over */
function remaining(endsAt: string, now: number) {
  const left = new Date(endsAt).getTime() - now;
  if (!(left > 0)) return null;
  const d = Math.floor(left / DAY);
  const h = Math.floor((left % DAY) / HOUR);
  const m = Math.max(1, Math.floor((left % HOUR) / MINUTE));
  if (d > 0) return `${d}d ${h}h`;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function useRemaining(endsAt: string | null) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!endsAt) return;
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [endsAt]);
  return endsAt ? remaining(endsAt, now) : null;
}

interface Props {
  endsAt: string | null;
  ink: string;
  /** Chip fill: a lifted tone of the card */
  fill: string;
}

/** A live "Ends in 2d 4h" chip with a beating dot; nothing when the offer is open-ended */
export const CountdownChip = memo(function CountdownChip({ endsAt, ink, fill }: Props) {
  const left = useRemaining(endsAt);
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const beat = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.25, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]));
    beat.start();
    return () => beat.stop();
  }, [pulse]);
  if (!left) return null;

  return (
    <View style={[styles.chip, { backgroundColor: fill }]} accessibilityLabel={`Offer ends in ${left}`}>
      <Animated.View style={[styles.dot, { backgroundColor: ink, opacity: pulse }]} />
      <Text style={[styles.text, { color: ink }]}>Ends in {left}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.3, fontVariant: ["tabular-nums"] },
});
