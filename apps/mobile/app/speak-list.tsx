import { useEffect, useState } from "react";
import { useStore } from "../lib/store-context";
import { strings } from "../lib/i18n";
import { useVoiceInput } from "../lib/use-voice-input";
import { LIST_HINTS } from "../lib/cart-builder";
import { useCartBuild } from "../lib/use-cart-build";
import { withSignIn } from "../components/SignInPrompt";
import { ListeningPanel } from "../components/cart-builder/ListeningPanel";
import { CartReview } from "../components/cart-builder/CartReview";
import { Building } from "../components/cart-builder/Building";

/** Speak (or type) a shopping list, then check what the store matched before it goes in the cart */
function SpeakListScreen() {
  const { selectedStore } = useStore();
  const [lines, setLines] = useState<string[]>([]);
  const [partial, setPartial] = useState("");
  const cart = useCartBuild();
  const voice = useVoiceInput(setPartial, (text) => {
    setPartial("");
    setLines((prev) => [...prev, text]);
  }, { continuous: true, hints: LIST_HINTS });

  // They came here to speak: start listening straight away
  useEffect(() => {
    if (voice.available) voice.start();
    return voice.stop;
  }, [voice.available]); // eslint-disable-line react-hooks/exhaustive-deps

  // A phrase still being spoken counts too
  const said = [...lines, partial].map((l) => l.trim()).filter(Boolean);
  const find = () => {
    if (said.length === 0 || !selectedStore) return;
    voice.stop();
    cart.build("/api/v1/list-to-cart", { storeId: selectedStore.id, text: said.join("\n"), source: "VOICE" });
  };

  if (cart.phase === "reading") return <Building count={said.length} />;
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
      lines={lines} partial={partial} listening={voice.listening} voiceAvailable={voice.available}
      onMic={voice.listening ? voice.stop : voice.start} onFind={find}
      onEditLine={(i, text) => setLines((prev) => prev.map((l, j) => (j === i ? text : l)))}
      onRemoveLine={(i) => setLines((prev) => prev.filter((_, j) => j !== i))}
      onAddTyped={(text) => setLines((prev) => [...prev, text])}
    />
  );
}

export default withSignIn(SpeakListScreen, "mic-outline", () => ({
  title: strings("shoppingList").signInTitle,
  message: strings("shoppingList").signInMessage,
}));
