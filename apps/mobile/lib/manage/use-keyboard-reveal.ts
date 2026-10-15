import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, TextInput, type ScrollView, type NativeSyntheticEvent, type NativeScrollEvent, type View } from "react-native";

const MARGIN = 24;

/**
 * Keeps the focused field visible in a form ScrollView. KeyboardAvoidingView only shrinks the
 * viewport; it never scrolls, so a field near the bottom stays hidden behind the keyboard.
 * Also measures where the screen starts on-screen so the avoiding offset matches the real header height.
 */
export function useKeyboardReveal() {
  const scrollRef = useRef<ScrollView>(null);
  const rootRef = useRef<View>(null);
  const scrollY = useRef(0);
  const [topOffset, setTopOffset] = useState(0);

  const reveal = useCallback(() => {
    const input = TextInput.State.currentlyFocusedInput();
    const viewport = scrollRef.current?.getNativeScrollRef();
    if (!input || !viewport) return;
    input.measureInWindow((_x, inputY, _w, inputH) => {
      viewport.measureInWindow((_vx, viewY, _vw, viewH) => {
        const overflow = inputY + inputH + MARGIN - (viewY + viewH);
        if (overflow > 0) scrollRef.current?.scrollTo({ y: scrollY.current + overflow, animated: true });
      });
    });
  }, []);

  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidShow", reveal);
    return () => sub.remove();
  }, [reveal]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
  }, []);

  const onRootLayout = useCallback(() => {
    rootRef.current?.measureInWindow((_x, y) => setTopOffset(y));
  }, []);

  return { scrollRef, rootRef, onScroll, onRootLayout, topOffset };
}
