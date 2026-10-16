import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Platform, TextInput, type FlatList, type ScrollView, type NativeSyntheticEvent, type NativeScrollEvent, type View } from "react-native";

const MARGIN = 24;

/**
 * Keeps the focused field visible in a form ScrollView. KeyboardAvoidingView only shrinks the
 * viewport; it never scrolls, so a field near the bottom stays hidden behind the keyboard or a sticky bar.
 * Also measures where the screen starts on-screen so the avoiding offset matches the real header height.
 *
 * Use: wrap the screen in <KeyboardAvoidingView ref={rootRef} onLayout={onRootLayout}
 * keyboardVerticalOffset={topOffset} behavior="padding" (iOS)>, put sticky bars inside it after the
 * ScrollView, and give the ScrollView ref={scrollRef} onScroll={onScroll} scrollEventThrottle={16}.
 * Call `reveal` from a TextInput's onFocus when fields can be switched while the keyboard stays open.
 * For a FlatList pass it as the type argument: useKeyboardReveal<FlatList>().
 */
export function useKeyboardReveal<T extends ScrollView | FlatList = ScrollView>() {
  const scrollRef = useRef<T>(null);
  const rootRef = useRef<View>(null);
  const scrollY = useRef(0);
  const [topOffset, setTopOffset] = useState(0);

  const reveal = useCallback(() => {
    const input = TextInput.State.currentlyFocusedInput();
    // FlatList types this as a union, but both lists hand back the native scroll host
    const viewport = scrollRef.current?.getNativeScrollRef() as View | null | undefined;
    if (!input || !viewport) return;
    input.measureInWindow((_x, inputY, _w, inputH) => {
      viewport.measureInWindow((_vx, viewY, _vw, viewH) => {
        const overflow = inputY + inputH + MARGIN - (viewY + viewH);
        if (overflow <= 0) return;
        const list = scrollRef.current;
        const y = scrollY.current + overflow;
        if (list && "scrollToOffset" in list) list.scrollToOffset({ offset: y, animated: true });
        else list?.scrollTo({ y, animated: true });
      });
    });
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", reveal);
    // Moving to another field with the keyboard already up resizes nothing, so check again after the focus settles
    const change = Platform.OS === "ios" ? Keyboard.addListener("keyboardDidChangeFrame", reveal) : null;
    return () => { show.remove(); change?.remove(); };
  }, [reveal]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
  }, []);

  const onRootLayout = useCallback(() => {
    rootRef.current?.measureInWindow((_x, y) => setTopOffset(y));
  }, []);

  return { scrollRef, rootRef, onScroll, onRootLayout, topOffset, reveal };
}
