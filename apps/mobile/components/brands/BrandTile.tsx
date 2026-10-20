import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { DirectoryBrand } from "@martly/shared/types";
import { fonts } from "../../constants/theme";
import { brandDisplayName, brandTheme, wordmarkColors } from "../../lib/brand-strip";
import { useStrings } from "../../lib/i18n/use-strings";

// Long names step down so most fit on two lines of the signboard
const wordmarkSize = (name: string) => (name.length <= 6 ? 20 : name.length <= 11 ? 16 : 13.5);

function Signboard({ brand }: { brand: DirectoryBrand }) {
  const tc = useStrings("common");
  const [background, ink] = wordmarkColors(brand.name);
  const name = brandDisplayName(brand.name);
  return (
    <View style={[styles.plate, { backgroundColor: background }]}>
      <View style={[styles.stripe, { backgroundColor: ink }]} />
      <View style={[styles.stripe, styles.stripeTwo, { backgroundColor: ink }]} />
      <Text
        style={[styles.wordmark, { color: ink, fontSize: wordmarkSize(name) }]}
        numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}
      >
        {name}
      </Text>
      <Text style={[styles.count, { color: ink }]}>{tc.items(brand.productCount)}</Text>
    </View>
  );
}

// No logo yet: the brand's best-selling pack shot on its signboard colour, with the name as the caption
function PackShot({ brand }: { brand: DirectoryBrand }) {
  const [background, ink] = wordmarkColors(brand.name);
  return (
    <View style={[styles.plate, styles.shotPlate, { backgroundColor: background }]}>
      <View style={styles.shotWell}>
        <Image source={{ uri: brand.coverImageUrl! }} style={styles.shot} resizeMode="contain" />
      </View>
      <Text style={[styles.caption, { color: ink }]} numberOfLines={1}>{brandDisplayName(brand.name)}</Text>
    </View>
  );
}

function LogoPlate({ brand }: { brand: DirectoryBrand }) {
  const t = useStrings("catalog");
  const { base } = brandTheme(brand);
  return (
    <View style={[styles.plate, styles.logoPlate, { borderColor: base }]}>
      <Image source={{ uri: brand.imageUrl! }} style={styles.logo} resizeMode="contain" />
      <View style={[styles.storeBar, { backgroundColor: base }]}>
        <Text style={styles.storeBarText} numberOfLines={1}>{t.brands.storeBar(brand.productCount)}</Text>
      </View>
    </View>
  );
}

export function BrandTile({ brand, width, onPress }: { brand: DirectoryBrand; width: number; onPress: () => void }) {
  const t = useStrings("catalog");
  return (
    <Pressable
      style={({ pressed }) => [{ width }, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t.brands.tileLabel(brandDisplayName(brand.name), brand.productCount)}
    >
      {brand.imageUrl ? <LogoPlate brand={brand} /> : brand.coverImageUrl ? <PackShot brand={brand} /> : <Signboard brand={brand} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { transform: [{ scale: 0.96 }], opacity: 0.9 },
  plate: {
    height: 96, borderRadius: 16, overflow: "hidden", paddingHorizontal: 10,
    alignItems: "center", justifyContent: "center",
  },
  // Two faint diagonal bands give the plate a painted-signboard texture
  stripe: { position: "absolute", width: 160, height: 18, opacity: 0.07, top: -6, right: -60, transform: [{ rotate: "-35deg" }] },
  stripeTwo: { height: 8, top: 22, right: -70 },
  wordmark: { fontFamily: fonts.extrabold, letterSpacing: -0.4, textAlign: "center" },
  count: { fontFamily: fonts.bold, fontSize: 10.5, opacity: 0.65, marginTop: 4, letterSpacing: 0.2 },
  shotPlate: { paddingHorizontal: 6, paddingTop: 6, paddingBottom: 6, justifyContent: "flex-start" },
  shotWell: { alignSelf: "stretch", flex: 1, borderRadius: 11, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  shot: { width: "86%", height: "88%" },
  caption: { fontFamily: fonts.extrabold, fontSize: 12, letterSpacing: -0.2, marginTop: 5, textAlign: "center" },
  logoPlate: { backgroundColor: "#fff", borderWidth: 1.5, paddingHorizontal: 0, paddingBottom: 22 },
  logo: { width: "78%", height: 50 },
  storeBar: { position: "absolute", left: 0, right: 0, bottom: 0, height: 22, alignItems: "center", justifyContent: "center" },
  storeBarText: { fontFamily: fonts.extrabold, fontSize: 9.5, letterSpacing: 1.2, color: "#fff" },
});
