import { useEffect, useState } from "react";
import { useStore } from "../lib/store-context";
import { strings } from "../lib/i18n";
import { useStrings } from "../lib/i18n/use-strings";
import { useCloudVoice } from "../lib/use-cloud-voice";
import { LIST_HINTS } from "../lib/cart-builder";
import { useCartBuild } from "../lib/use-cart-build";
import { useRecentLists } from "../lib/use-shopping-list";
import { withSignIn } from "../components/SignInPrompt";
import { ListeningPanel } from "../components/cart-builder/ListeningPanel";
import { CartReview } from "../components/cart-builder/CartReview";
import { Building } from "../components/cart-builder/Building";
import { RecentLists } from "../components/shopping-list/RecentLists";

/** The spoken list: lines heard so far, and finding products for them once every spoken item is written out */
function useSpokenList(cart: ReturnType<typeof useCartBuild>) {
  const { selectedStore } = useStore();
  const [lines, setLines] = useState<string[]>([]);
  const [partial, setPartial] = useState("");
  const voice = useCloudVoice(setPartial, (text) => {
    setPartial("");
    setLines((prev) => [...prev, text]);
  }, { storeId: selectedStore?.id, continuous: true, hints: LIST_HINTS });
  // Find was tapped while spoken items were still being written: find once they're in
  const [findWhenReady, setFindWhenReady] = useState(false);

  // They came here to speak: start listening straight away
  useEffect(() => {
    if (voice.available) voice.start();
    return voice.stop;
  }, [voice.available]); // eslint-disable-line react-hooks/exhaustive-deps

  // A phrase still being spoken counts too
  const said = [...lines, partial].map((l) => l.trim()).filter(Boolean);
  const build = (texts: string[], source: "VOICE" | "LIST") => {
    if (texts.length === 0 || !selectedStore) return;
    cart.build("/api/v1/list-to-cart", { storeId: selectedStore.id, text: texts.join("\n"), source });
  };
  const find = async () => {
    // Done speaking: the item being said is cut and written out before finding
    if (!voice.level) {
      voice.stop();
      return build(said, "VOICE");
    }
    await voice.stop();
    setFindWhenReady(true);
  };
  useEffect(() => {
    if (!findWhenReady || voice.listening || voice.pending > 0) return;
    setFindWhenReady(false);
    build(said, "VOICE");
  }, [findWhenReady, voice.listening, voice.pending]); // eslint-disable-line react-hooks/exhaustive-deps

  // A list from an earlier shop, straight to products (the build logs it, so it stays in Recent lists)
  const findFrom = (texts: string[]) => {
    voice.stop();
    setLines(texts);
    build(texts, "LIST");
  };
  return { voice, lines, setLines, partial, said, find, findFrom, waiting: findWhenReady };
}

/** Speak (or type) a shopping list, then check what the store matched before it goes in the cart */
function SpeakListScreen() {
  const { selectedStore } = useStore();
  const t = useStrings("shoppingList");
  const cart = useCartBuild();
  const recent = useRecentLists();
  const { voice, lines, setLines, partial, said, find, findFrom, waiting } = useSpokenList(cart);

  if (waiting || cart.phase === "reading") return <Building count={said.length + voice.pending} />;
  if (cart.phase === "review" && cart.review) {
    return (
      <CartReview
        review={cart.review} onStartOver={() => { cart.reset(); setLines([]); }}
        onResearch={(i, text) => selectedStore && cart.research(i, text, selectedStore.id)}
      />
    );
  }
  return (
    <ListeningPanel
      lines={lines} partial={partial} pending={voice.pending} listening={voice.listening} level={voice.level}
      voiceAvailable={voice.available}
      onMic={voice.listening ? voice.stop : voice.start} onFind={find}
      onEditLine={(i, text) => setLines((prev) => prev.map((l, j) => (j === i ? text : l)))}
      onRemoveLine={(i) => setLines((prev) => prev.filter((_, j) => j !== i))}
      onAddTyped={(text) => setLines((prev) => [...prev, text])}
      footer={
        <RecentLists
          lists={recent} onFind={findFrom} addLabel={t.addToSpoken}
          onAdd={(texts) => setLines((prev) => [...prev, ...texts])}
        />
      }
    />
  );
}

export default withSignIn(SpeakListScreen, "mic-outline", () => ({
  title: strings("shoppingList").signInTitle,
  message: strings("shoppingList").signInMessage,
}));
