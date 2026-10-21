import { useState } from "react";
import { View, Text, TextInput, FlatList, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ShoppingListItem } from "@martly/shared/types";
import { colors, fonts } from "../constants/theme";
import { useStore } from "../lib/store-context";
import { strings } from "../lib/i18n";
import { useStrings } from "../lib/i18n/use-strings";
import { useVoiceInput } from "../lib/use-voice-input";
import { useShoppingList } from "../lib/use-shopping-list";
import { useKeyboardReveal } from "../lib/use-keyboard-reveal";
import { useCartBuild } from "../lib/use-cart-build";
import { withSignIn } from "../components/SignInPrompt";
import { CartReview } from "../components/cart-builder/CartReview";
import { Building } from "../components/cart-builder/Building";
import { RecentLists } from "../components/shopping-list/RecentLists";

const PAPER = "#fffdf5";
const RULE = "#e8e1cc";

function Row({ item, index, onEdit, onRemove }: { item: ShoppingListItem; index: number; onEdit: (text: string) => void; onRemove: () => void }) {
  const t = useStrings("shoppingList");
  const [text, setText] = useState(item.text);
  const save = () => {
    const next = text.trim();
    if (!next) setText(item.text);
    else if (next !== item.text) onEdit(next);
  };
  return (
    <View style={styles.row}>
      <Text style={styles.num}>{index + 1}</Text>
      {/* Wraps long items, but return means done: it saves the edit and closes the keyboard */}
      <TextInput style={styles.rowText} value={text} onChangeText={setText} onEndEditing={save} multiline returnKeyType="done" submitBehavior="blurAndSubmit" />
      <TouchableOpacity style={styles.iconBtn} onPress={onRemove} accessibilityLabel={t.removeLine}>
        <Ionicons name="close" size={20} color="#a8a29e" />
      </TouchableOpacity>
    </View>
  );
}

/** Typing or speaking one item at a time */
function AddBar({ onAdd }: { onAdd: (text: string) => void }) {
  const t = useStrings("shoppingList");
  const [draft, setDraft] = useState("");
  const voice = useVoiceInput(setDraft, (text) => {
    setDraft("");
    onAdd(text);
  });
  const submit = () => {
    if (draft.trim()) onAdd(draft.trim());
    setDraft("");
  };
  return (
    <View style={styles.addBar}>
      <TextInput
        style={styles.addInput} value={draft} onChangeText={setDraft} placeholder={t.addItem}
        placeholderTextColor="#a8a29e" onSubmitEditing={submit} returnKeyType="done" blurOnSubmit={false}
      />
      {voice.available && (
        <TouchableOpacity style={[styles.mic, voice.listening && styles.micOn]} onPress={voice.listening ? voice.stop : voice.start} accessibilityLabel={t.addByVoice}>
          <Ionicons name={voice.listening ? "stop" : "mic"} size={22} color="#ffffff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Matching the list against the store (streamed), and ticking off what made it into the cart */
function useMakeCart(list: ReturnType<typeof useShoppingList>) {
  const { selectedStore } = useStore();
  const cart = useCartBuild();
  // How many things are being found, for the "Finding your N products" screen
  const [count, setCount] = useState(0);
  const make = () => {
    if (!selectedStore) return;
    setCount(list.items.length);
    cart.build("/api/v1/shopping-list/build", { storeId: selectedStore.id });
  };
  // A past list's items, straight to products; the build logs them, so they stay in Recent lists
  const makeFrom = (texts: string[]) => {
    if (!selectedStore) return;
    setCount(texts.length);
    cart.build("/api/v1/list-to-cart", { storeId: selectedStore.id, text: texts.join("\n"), source: "LIST" });
  };

  // Items whose words became a line in the cart are done; anything skipped stays on the list
  const tickOff = (lines: number[]) => {
    const review = cart.review;
    if (!review?.itemIds) return;
    // By the words first read from the list, so a line re-worded in review still ticks its item off
    const kept = lines.map((i) => norm(review.lines[i].said));
    const ids = list.items.filter((it) => review.itemIds!.includes(it.id) && kept.some((k) => norm(it.text).includes(k) || k.includes(norm(it.text))));
    list.done(ids.map((it) => it.id));
  };
  const researchLine = (index: number, text: string) => {
    if (selectedStore) cart.research(index, text, selectedStore.id);
  };
  return { ...cart, count, make, makeFrom, tickOff, researchLine };
}

/** The running list: things added whenever the shopper remembers them, turned into a cart when they're ready */
function EmptyList() {
  const t = useStrings("shoppingList");
  return (
    <View style={styles.empty}>
      <Ionicons name="list-outline" size={40} color="#d6a756" />
      <Text style={styles.emptyTitle}>{t.myListEmpty}</Text>
      <Text style={styles.emptyHint}>{t.myListEmptyHint}</Text>
    </View>
  );
}

function MyListScreen() {
  const t = useStrings("shoppingList");
  const list = useShoppingList();
  const cart = useMakeCart(list);
  // The screen shrinks above the keyboard, so Make my cart stays in reach while typing
  const keyboard = useKeyboardReveal<FlatList<ShoppingListItem>>();

  if (cart.phase === "reading") return <Building count={cart.count} />;
  if (cart.phase === "review" && cart.review) {
    return <CartReview review={cart.review} onStartOver={cart.reset} onResearch={cart.researchLine} onAdded={cart.tickOff} />;
  }
  return (
    <View ref={keyboard.rootRef} onLayout={keyboard.onRootLayout} style={styles.root}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={keyboard.topOffset}>
        {list.loading ? <ActivityIndicator style={styles.loader} color={colors.primary} /> : (
          <FlatList
            ref={keyboard.scrollRef}
            onScroll={keyboard.onScroll}
            scrollEventThrottle={16}
            data={list.items}
            keyExtractor={(i) => i.id}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ListHeaderComponent={<AddBar onAdd={list.add} />}
            ListEmptyComponent={<EmptyList />}
          ListFooterComponent={<RecentLists lists={list.recent} onFind={cart.makeFrom} onAdd={list.addMany} />}
            renderItem={({ item, index }) => <Row item={item} index={index} onEdit={(text) => list.edit(item.id, text)} onRemove={() => list.remove(item.id)} />}
            style={styles.paperList}
          />
        )}
        {list.items.length > 0 && (
          <View style={styles.footer}>
            <TouchableOpacity style={styles.make} onPress={cart.make} activeOpacity={0.85}>
              <Ionicons name="basket" size={20} color="#ffffff" />
              <Text style={styles.makeText}>{t.makeMyCart(list.items.length)}</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

export default withSignIn(MyListScreen, "list-outline", () => ({
  title: strings("shoppingList").signInTitle,
  message: strings("shoppingList").signInMessage,
}));

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  loader: { marginTop: 48 },
  paperList: { flex: 1 },
  content: { padding: 16, paddingBottom: 24 },
  addBar: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  addInput: { flex: 1, minHeight: 52, backgroundColor: "#ffffff", borderWidth: 1.5, borderColor: colors.border, borderRadius: 26, paddingHorizontal: 18, fontSize: 16, fontFamily: fonts.medium, color: colors.text },
  mic: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  micOn: { backgroundColor: colors.primaryDark },
  row: { flexDirection: "row", alignItems: "center", minHeight: 52, backgroundColor: PAPER, borderBottomWidth: 1, borderBottomColor: RULE, borderLeftWidth: 1, borderRightWidth: 1, borderColor: "#efe6c9" },
  num: { width: 44, textAlign: "center", fontSize: 15, fontFamily: fonts.bold, color: "#d6a756" },
  rowText: { flex: 1, fontSize: 18, fontFamily: fonts.medium, color: "#1c1917", paddingHorizontal: 12, paddingVertical: 10, borderLeftWidth: 1.5, borderLeftColor: "#f3b4a8" },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", gap: 8, paddingVertical: 40, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.text },
  emptyHint: { fontSize: 14, fontFamily: fonts.medium, color: colors.textSecondary, textAlign: "center" },
  footer: { padding: 16, paddingBottom: 24, backgroundColor: "#ffffff", borderTopWidth: 1, borderTopColor: colors.border },
  make: { flexDirection: "row", gap: 8, backgroundColor: colors.primary, borderRadius: 26, minHeight: 52, alignItems: "center", justifyContent: "center" },
  makeText: { fontSize: 16, fontFamily: fonts.bold, color: "#ffffff" },
});
