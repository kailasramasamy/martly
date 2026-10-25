import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { useReduceMotion } from "../../lib/use-reduce-motion";

type Rect = { x: number; y: number; width: number; height: number };
/** Anything on screen that can say where it is: a view, or a pack's photo */
type Measurable = Pick<View, "measureInWindow">;
type Flight = { id: number; uri: string; from: Rect; to: Rect };

interface Fly {
  /** Sends a pack's photo from where it sits on screen into the basket */
  fly: (uri: string, from: Measurable | null) => void;
  basketRef: RefObject<View | null>;
}

const FlyContext = createContext<Fly | null>(null);
// How high a pack rises before it drops
const RISE = 40;

const measure = (view: Measurable) => new Promise<Rect>((resolve) => view.measureInWindow((x, y, width, height) => resolve({ x, y, width, height })));

// One photo dropping into the basket: across in a straight line, down with gravity, shrinking as it lands
function FlyingPack({ flight, origin, onDone }: { flight: Flight; origin: Rect; onDone: (id: number) => void }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 620, easing: Easing.linear, useNativeDriver: true }).start(() => onDone(flight.id));
  }, [t, flight.id, onDone]);
  const { from, to } = flight;
  const dx = to.x + to.width / 2 - (from.x + from.width / 2);
  const dy = to.y + to.height / 2 - (from.y + from.height / 2);
  // Rises a little, then falls faster and faster into the basket (points along a gravity curve: the native driver takes
  // no easing inside an interpolation)
  const arc = t.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, -RISE, -RISE + (dy + RISE) * 0.18, -RISE + (dy + RISE) * 0.56, dy],
  });
  const style = {
    left: from.x - origin.x, top: from.y - origin.y, width: from.width, height: from.height,
    opacity: t.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
    transform: [
      { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
      { translateY: arc },
      { scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 0.22] }) },
      { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-18deg"] }) },
    ],
  };
  return <Animated.Image source={{ uri: flight.uri }} style={[styles.flying, style]} />;
}

/** Holds the walk's basket and the packs flying into it, drawn above everything on the screen */
export function FlyProvider({ children }: { children: ReactNode }) {
  const reduce = useReduceMotion();
  const root = useRef<View>(null);
  const basketRef = useRef<View>(null);
  const nextId = useRef(0);
  const [origin, setOrigin] = useState<Rect>({ x: 0, y: 0, width: 0, height: 0 });
  const [flights, setFlights] = useState<Flight[]>([]);
  const fly = useCallback(async (uri: string, fromView: Measurable | null) => {
    if (reduce || !fromView || !basketRef.current || !root.current) return;
    const [from, to, at] = await Promise.all([measure(fromView), measure(basketRef.current), measure(root.current)]);
    setOrigin(at);
    setFlights((f) => [...f, { id: nextId.current++, uri, from, to }]);
  }, [reduce]);
  const done = useCallback((id: number) => setFlights((f) => f.filter((x) => x.id !== id)), []);
  return (
    <FlyContext.Provider value={{ fly, basketRef }}>
      <View ref={root} style={styles.root} collapsable={false}>
        {children}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {flights.map((f) => <FlyingPack key={f.id} flight={f} origin={origin} onDone={done} />)}
        </View>
      </View>
    </FlyContext.Provider>
  );
}

/** The basket to fly packs into; null outside a walk, where adding simply adds */
export function useFly() {
  return useContext(FlyContext);
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flying: { position: "absolute", resizeMode: "contain" },
});
