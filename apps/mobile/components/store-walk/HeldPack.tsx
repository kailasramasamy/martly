import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated, Easing, Image, PanResponder, StyleSheet, View,
  type GestureResponderEvent, type ImageLoadEventData, type NativeSyntheticEvent, type PanResponderGestureState,
} from "react-native";
import { colors } from "../../constants/theme";
import { useStrings } from "../../lib/i18n/use-strings";
import { useReduceMotion } from "../../lib/use-reduce-motion";

const MAX_ZOOM = 3;
// The shadow's layers, each further down: stacked faint copies make the soft edge (iOS can't blur a tinted image)
const CAST = [8, 12, 16, 20];
const DOUBLE_TAP_ZOOM = 2.5;
const DOUBLE_TAP_MS = 280;
// A touch that moves less than this is a tap, not a drag
const TAP_SLOP = 8;
// A sideways swipe this long turns the pack; a shorter one lets it settle back
const SWIPE = 50;
// Each half of a turn: the pack turns edge-on, shows its next side, and turns back to face the shopper
const HALF_TURN_MS = 220;
// The first pack picked up after the app opens turns a little and settles back, so the shopper sees it turns
let hinted = false;

const spread = (e: GestureResponderEvent) => {
  const [a, b] = e.nativeEvent.touches;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
};

const sideways = (g: PanResponderGestureState) => Math.abs(g.dx) > Math.abs(g.dy);

interface Swipe { move: (dx: number) => void; end: (dx: number) => void }

// The pack's zoom and drag: where it rests, and the pinch under way
function zoomer(scale: Animated.Value, pan: Animated.ValueXY) {
  const at = { scale: 1, x: 0, y: 0 };
  let pinch: { from: number; scale: number; now: number } | null = null;
  const settle = (to: number) => {
    Object.assign(at, { scale: to, x: 0, y: 0 });
    Animated.parallel([
      Animated.spring(scale, { toValue: to, friction: 7, useNativeDriver: true }),
      Animated.spring(pan, { toValue: { x: 0, y: 0 }, friction: 7, useNativeDriver: true }),
    ]).start();
  };
  return {
    at, settle,
    pinching: () => !!pinch,
    pinchTo: (e: GestureResponderEvent) => {
      pinch ??= { from: spread(e), scale: at.scale, now: at.scale };
      pinch.now = Math.min(MAX_ZOOM, Math.max(0.8, (pinch.scale * spread(e)) / pinch.from));
      scale.setValue(pinch.now);
    },
    endPinch: () => {
      const zoomed = pinch?.now ?? 1;
      pinch = null;
      if (zoomed < 1.05) settle(1);
      else at.scale = zoomed;
    },
    drag: (g: PanResponderGestureState) => pan.setValue({ x: at.x + g.dx, y: at.y + g.dy }),
  };
}

/**
 * The held pack's touches. Pinch zooms it (1× to 3×), double-tap zooms in or back out, and letting go below 1× springs
 * it back. Zoomed in, a drag moves it about; at rest, a sideways swipe turns it
 */
function usePackTouch(swipe: Swipe) {
  const scale = useRef(new Animated.Value(1)).current;
  const pan = useRef(new Animated.ValueXY()).current;
  const swiped = useRef(swipe);
  swiped.current = swipe;
  return useMemo(() => {
    const zoom = zoomer(scale, pan);
    const { at } = zoom;
    let lastTap = 0;
    const release = (g: PanResponderGestureState) => {
      if (zoom.pinching()) return zoom.endPinch();
      if (Math.abs(g.dx) > TAP_SLOP || Math.abs(g.dy) > TAP_SLOP) {
        if (at.scale > 1) Object.assign(at, { x: at.x + g.dx, y: at.y + g.dy });
        else swiped.current.end(sideways(g) ? g.dx : 0);
        return;
      }
      const double = Date.now() - lastTap < DOUBLE_TAP_MS;
      lastTap = double ? 0 : Date.now();
      if (double) zoom.settle(at.scale > 1 ? 1 : DOUBLE_TAP_ZOOM);
    };
    const responder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      // A second finger landing on the dimmed aisle would otherwise take the touch and end the pinch
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (e, g) => {
        if (e.nativeEvent.touches.length === 2) zoom.pinchTo(e);
        else if (zoom.pinching()) return;
        else if (at.scale > 1) zoom.drag(g);
        else if (sideways(g)) swiped.current.move(g.dx);
      },
      onPanResponderTerminate: () => {
        zoom.endPinch();
        zoom.settle(1);
        swiped.current.end(0);
      },
      onPanResponderRelease: (_, g) => release(g),
    });
    return {
      handlers: responder.panHandlers,
      reset: () => zoom.settle(1),
      style: { transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale }] },
      // The shadow belongs to the pack at rest; zoomed in, it would sit across the sheet
      cast: { opacity: scale.interpolate({ inputRange: [1, 1.3], outputRange: [1, 0], extrapolate: "clamp" }) },
    };
  }, [scale, pan]);
}

export interface Side { uri: string; cut: boolean }

/**
 * Turning the pack: it follows the finger round towards edge-on, and past a swipe's length carries on to show its next
 * side (or, swiped the other way, the one before) and turns back to face the shopper. `v` runs -1 to 1, edge-on at each end
 */
function useTurn(count: number, width: number) {
  const reduce = useReduceMotion();
  const [side, setSide] = useState(0);
  const v = useRef(new Animated.Value(0)).current;
  const busy = useRef(false);
  const half = (toValue: number, easing: (t: number) => number, done?: () => void) =>
    Animated.timing(v, { toValue, duration: HALF_TURN_MS, easing, useNativeDriver: true }).start(done);
  const turn = (dir: 1 | -1) => {
    if (count < 2 || busy.current) return;
    const next = (side + dir + count) % count;
    if (reduce) return setSide(next);
    busy.current = true;
    half(dir, Easing.in(Easing.quad), () => {
      setSide(next);
      v.setValue(-dir);
      half(0, Easing.out(Easing.quad), () => { busy.current = false; });
    });
  };
  const swipe: Swipe = {
    move: (dx) => { if (count > 1 && !busy.current && !reduce) v.setValue(Math.max(-0.8, Math.min(0.8, -dx / width))); },
    end: (dx) => {
      if (Math.abs(dx) >= SWIPE) turn(dx < 0 ? 1 : -1);
      else if (!busy.current) Animated.spring(v, { toValue: 0, friction: 6, useNativeDriver: true }).start();
    },
  };
  useEffect(() => {
    if (hinted || count < 2 || reduce) return;
    hinted = true;
    Animated.sequence([
      Animated.delay(700),
      Animated.timing(v, { toValue: 0.3, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(v, { toValue: 0, friction: 5, useNativeDriver: true }),
    ]).start();
  }, [count, reduce, v]);
  const style = {
    transform: [
      { perspective: 900 },
      { rotateY: v.interpolate({ inputRange: [-1, 0, 1], outputRange: ["90deg", "0deg", "-90deg"] }) },
      { scale: v.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.92, 1, 0.92] }) },
    ],
  };
  return { side, turn, swipe, style };
}

// The pack's size in the room, in the shape of the side showing
function useFit(width: number, height: number) {
  const [aspect, setAspect] = useState<number | null>(null);
  const onLoad = ({ nativeEvent: { source } }: NativeSyntheticEvent<ImageLoadEventData>) => {
    if (source.width && source.height) setAspect(source.width / source.height);
  };
  const fit = aspect ? Math.min(width, height * aspect) : width;
  return { loaded: !!aspect, onLoad, size: { width: fit, height: aspect ? fit / aspect : height } };
}

function Shadow({ uri, style }: { uri: string; style: object }) {
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      {CAST.map((step) => (
        <Image
          key={step} source={{ uri }} tintColor="#000000"
          style={[StyleSheet.absoluteFill, styles.cast, { transform: [{ translateX: step * 0.6 }, { translateY: step }] }]}
        />
      ))}
    </Animated.View>
  );
}

// One dot per side, the side showing filled in. For a screen reader it's the control that turns the pack
function Dots({ count, side, turn }: { count: number; side: number; turn: (dir: 1 | -1) => void }) {
  const t = useStrings("storeWalk");
  return (
    <View
      style={styles.dots} accessible accessibilityRole="adjustable" accessibilityLabel={t.turnOver}
      accessibilityValue={{ min: 1, max: count, now: side + 1 }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => turn(e.nativeEvent.actionName === "increment" ? 1 : -1)}
    >
      {Array.from({ length: count }, (_, i) => <View key={i} style={[styles.dot, i === side && styles.dotOn]} />)}
    </View>
  );
}

/**
 * The picked-up pack, as big as the room allows in its own shape, casting its shadow down and to the right. Swipe it
 * sideways to turn it round to its other sides
 */
export function HeldPack({ sides, width, height }: { sides: Side[]; width: number; height: number }) {
  const turning = useTurn(sides.length, width);
  const touch = usePackTouch(turning.swipe);
  const { uri, cut } = sides[turning.side];
  const { loaded, onLoad, size } = useFit(width, height);
  useEffect(() => { sides.slice(1).forEach((s) => Image.prefetch(s.uri)); }, [sides]);
  useEffect(() => touch.reset(), [turning.side, touch]);
  return (
    <View style={styles.held}>
      <Animated.View style={[size, turning.style]}>
        {cut && loaded && <Shadow uri={uri} style={touch.cast} />}
        <Animated.View style={[StyleSheet.absoluteFill, touch.style]} {...touch.handlers}>
          <Image source={{ uri }} style={[styles.image, !cut && styles.plate]} onLoad={onLoad} />
        </Animated.View>
      </Animated.View>
      {sides.length > 1 && <Dots count={sides.length} side={turning.side} turn={turning.turn} />}
    </View>
  );
}

const styles = StyleSheet.create({
  // Black copies of the pack; iOS draws a shadow style on a cut-out as a pale box
  cast: { resizeMode: "contain", opacity: 0.16 },
  image: { flex: 1, resizeMode: "contain" },
  plate: { borderRadius: 10, backgroundColor: "#ffffff" },
  held: { alignItems: "center", gap: 18 },
  dots: {
    flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
    backgroundColor: "rgba(15,23,42,0.55)",
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.45)" },
  dotOn: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.surface },
});
