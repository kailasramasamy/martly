import { useEffect, useRef, useState, type ReactNode } from "react";
import { View, Text, TextInput, TouchableOpacity, Animated, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { useStrings } from "../../lib/i18n/use-strings";
import { useKeyboardReveal } from "../../lib/use-keyboard-reveal";

const PAPER = "#fffdf5";
const RULE = "#e8e1cc";
const MARGIN = "#f3b4a8";

/** A big mic with a ring while it listens: it follows the voice when the level is known, else pulses slowly */
function MicButton({ listening, level, onPress }: { listening: boolean; level: Animated.Value | null; onPress: () => void }) {
  const t = useStrings("shoppingList");
  const ring = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!listening || level) return ring.setValue(0);
    const loop = Animated.loop(Animated.timing(ring, { toValue: 1, duration: 1600, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [listening, level, ring]);
  const live = listening && level;
  const scale = live ? level.interpolate({ inputRange: [0, 1], outputRange: [1.05, 1.45] }) : ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] });
  const opacity = live ? 0.3 : ring.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });
  return (
    <View style={styles.micWrap}>
      <Animated.View style={[styles.ring, { transform: [{ scale }], opacity }]} />
      <TouchableOpacity
        style={[styles.mic, listening && styles.micOn]} onPress={onPress} activeOpacity={0.85}
        accessibilityRole="button" accessibilityLabel={listening ? t.stopListening : t.startListening}
      >
        <Ionicons name={listening ? "stop" : "mic"} size={44} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );
}

interface PaperProps {
  lines: string[];
  partial: string;
  /** Spoken items still being written out */
  pending?: number;
  onEditLine: (i: number, text: string) => void;
  onRemoveLine: (i: number) => void;
  onAddTyped: (text: string) => void;
}

/** The list as a ruled paper slip: every spoken pause is a line the shopper can fix or remove */
function PaperList({ lines, partial, pending = 0, onEditLine, onRemoveLine, onAddTyped }: PaperProps) {
  const t = useStrings("shoppingList");
  const [typed, setTyped] = useState("");
  const submit = () => {
    if (typed.trim()) onAddTyped(typed.trim());
    setTyped("");
  };
  return (
    <View style={styles.paper}>
      <View style={styles.margin} />
      {lines.map((line, i) => (
        <View key={i} style={styles.line}>
          <Text style={styles.num}>{i + 1}</Text>
          <TextInput
            style={styles.lineText} value={line} onChangeText={(text) => onEditLine(i, text)}
            multiline returnKeyType="done" submitBehavior="blurAndSubmit"
          />
          <TouchableOpacity style={styles.remove} onPress={() => onRemoveLine(i)} accessibilityLabel={t.removeLine}>
            <Ionicons name="close" size={20} color="#a8a29e" />
          </TouchableOpacity>
        </View>
      ))}
      {Array.from({ length: pending }, (_, i) => (
        <View key={`pending-${i}`} style={styles.line}>
          <Text style={styles.num}>{lines.length + i + 1}</Text>
          <Text style={[styles.lineText, styles.partial]}>…</Text>
        </View>
      ))}
      {partial ? (
        <View style={styles.line}>
          <Text style={styles.num}>{lines.length + 1}</Text>
          <Text style={[styles.lineText, styles.partial]}>{partial}…</Text>
        </View>
      ) : null}
      <View style={styles.line}>
        <Ionicons name="create-outline" size={18} color="#d6a756" style={styles.numIcon} />
        <TextInput
          style={styles.lineText} value={typed} onChangeText={setTyped} placeholder={t.typeHere}
          placeholderTextColor="#a8a29e" onSubmitEditing={submit} onBlur={submit} returnKeyType="done" blurOnSubmit={false}
        />
      </View>
    </View>
  );
}

interface Props extends PaperProps {
  listening: boolean;
  /** The live voice level (0-1), when the mic can measure it */
  level?: Animated.Value | null;
  voiceAvailable: boolean;
  onMic: () => void;
  onFind: () => void;
  /** Below the list, e.g. lists from earlier shops */
  footer?: ReactNode;
}

/** Speaking (or typing) the list, before it's matched */
export function ListeningPanel({ listening, level = null, voiceAvailable, onMic, onFind, footer, ...paper }: Props) {
  const t = useStrings("shoppingList");
  const count = paper.lines.length + (paper.pending ?? 0) + (paper.partial ? 1 : 0);
  const status = !voiceAvailable ? t.noVoice : listening ? t.listening : count ? t.tapToResume : t.tapToSpeak;
  // The screen shrinks above the keyboard, so Find stays in reach while typing or fixing a line
  const keyboard = useKeyboardReveal();
  return (
    <View ref={keyboard.rootRef} onLayout={keyboard.onRootLayout} style={styles.root}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={keyboard.topOffset}>
        <ScrollView
          ref={keyboard.scrollRef} onScroll={keyboard.onScroll} scrollEventThrottle={16}
          contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        >
          {voiceAvailable && <MicButton listening={listening} level={level} onPress={onMic} />}
          <Text style={styles.status}>{status}</Text>
          {count === 0 && voiceAvailable && (
            <View style={styles.example}>
              <Text style={styles.hint}>{t.speakHint}</Text>
              <Text style={styles.exampleText}>{t.speakExample}</Text>
            </View>
          )}
          <PaperList {...paper} />
          {footer}
        </ScrollView>
        {count > 0 && (
          <View style={styles.footer}>
            <TouchableOpacity style={styles.find} onPress={onFind} activeOpacity={0.85}>
              <Ionicons name="basket" size={20} color="#ffffff" />
              <Text style={styles.findText}>{t.findItems(count)}</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: 20, paddingBottom: 32, alignItems: "stretch" },
  micWrap: { alignSelf: "center", width: 152, height: 152, alignItems: "center", justifyContent: "center", marginTop: 8 },
  ring: { position: "absolute", width: 112, height: 112, borderRadius: 56, backgroundColor: colors.primary },
  mic: { width: 112, height: 112, borderRadius: 56, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", elevation: 4, shadowColor: colors.primaryDark, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  micOn: { backgroundColor: colors.primaryDark },
  // Line heights leave room for Tamil vowel signs above and below the letters
  status: { fontSize: 18, lineHeight: 27, fontFamily: fonts.bold, color: colors.text, textAlign: "center", marginTop: 6 },
  example: { marginTop: 14, alignItems: "center", gap: 10, paddingHorizontal: 8 },
  hint: { fontSize: 14, lineHeight: 22, fontFamily: fonts.medium, color: colors.textSecondary, textAlign: "center" },
  exampleText: { fontSize: 15, lineHeight: 24, fontFamily: fonts.semibold, color: "#92400e", textAlign: "center" },
  paper: { marginTop: 22, backgroundColor: PAPER, borderRadius: 14, borderWidth: 1, borderColor: "#efe6c9", paddingVertical: 6, overflow: "hidden" },
  margin: { position: "absolute", left: 44, top: 0, bottom: 0, width: 1.5, backgroundColor: MARGIN },
  line: { flexDirection: "row", alignItems: "center", minHeight: 52, borderBottomWidth: 1, borderBottomColor: RULE },
  num: { width: 44, textAlign: "center", fontSize: 15, fontFamily: fonts.bold, color: "#d6a756" },
  numIcon: { width: 44, textAlign: "center" },
  lineText: { flex: 1, fontSize: 18, fontFamily: fonts.medium, color: "#1c1917", paddingHorizontal: 12, paddingVertical: 10 },
  partial: { color: "#a8a29e" },
  remove: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  footer: { padding: 16, paddingBottom: 24, backgroundColor: "#ffffff", borderTopWidth: 1, borderTopColor: colors.border },
  find: { flexDirection: "row", gap: 8, backgroundColor: colors.primary, borderRadius: 26, minHeight: 52, alignItems: "center", justifyContent: "center" },
  findText: { fontSize: 16, fontFamily: fonts.bold, color: "#ffffff" },
});
