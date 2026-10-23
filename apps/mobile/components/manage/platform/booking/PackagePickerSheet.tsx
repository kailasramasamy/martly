import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "../../../search/BottomSheet";
import { colors, fonts } from "../../../../constants/theme";
import { manage } from "../../ui/tokens";
import { MockupThumb } from "../placements/MockupThumb";
import { previewFor } from "../placements/placement-previews";
import { PreviewPager } from "../placements/PreviewPager";
import { Button } from "../../ui/Button";
import type { BrandPackage } from "../types";
import { packagePrice } from "./package-format";

interface Props {
  visible: boolean;
  packages: BrandPackage[];
  value: string | null;
  onPick: (productId: string) => void;
  onClose: () => void;
}

interface CardProps { pkg: BrandPackage; selected: boolean; onSelect: () => void; onPreview: () => void }

function PackageCard({ pkg, selected, onSelect, onPreview }: CardProps) {
  const views = previewFor(pkg.kind, pkg.placement)?.mockups.length ?? 0;
  return (
    <View style={[styles.card, selected && styles.cardOn]}>
      <TouchableOpacity style={styles.main} onPress={onSelect} activeOpacity={0.7} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`${pkg.name}, ${packagePrice(pkg)}`}>
        <MockupThumb kind={pkg.kind} placement={pkg.placement} width={96} />
        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text style={styles.name} numberOfLines={2}>{pkg.name}</Text>
            {selected ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
          </View>
          <Text style={styles.price}>{packagePrice(pkg)}</Text>
          {pkg.description ? <Text style={styles.desc} numberOfLines={2}>{pkg.description}</Text> : null}
          {views > 1 ? <Text style={styles.chip}>{views} views</Text> : null}
        </View>
      </TouchableOpacity>
      {views > 0 ? (
        <TouchableOpacity style={styles.where} onPress={onPreview} accessibilityRole="button" accessibilityLabel={`Where ${pkg.name} shows`}>
          <Ionicons name="eye-outline" size={16} color={colors.primary} />
          <Text style={styles.whereText}>Where it shows</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// The package's mockups shown in place of the list; a second sheet would open behind this one on iOS
function PackagePreview({ pkg, onBack, onChoose }: { pkg: BrandPackage; onBack: () => void; onChoose: () => void }) {
  const mockups = previewFor(pkg.kind, pkg.placement)?.mockups ?? [];
  return (
    <ScrollView contentContainerStyle={styles.preview} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={styles.back} onPress={onBack} accessibilityRole="button">
        <Ionicons name="chevron-back" size={18} color={colors.primary} />
        <Text style={styles.backText}>All packages</Text>
      </TouchableOpacity>
      <Text style={styles.previewName}>{pkg.name} · <Text style={styles.price}>{packagePrice(pkg)}</Text></Text>
      <PreviewPager mockups={mockups} />
      <View style={styles.choose}><Button label="Choose this package" onPress={onChoose} /></View>
    </ScrollView>
  );
}

export function PackagePickerSheet({ visible, packages, value, onPick, onClose }: Props) {
  const [previewing, setPreviewing] = useState<BrandPackage | null>(null);
  useEffect(() => { if (visible) setPreviewing(null); }, [visible]);
  const choose = (id: string) => { onPick(id); onClose(); };

  return (
    <BottomSheet visible={visible} title={previewing ? "Where it shows" : "Choose a package"} onClose={onClose} flush centeredTitle>
      {previewing ? (
        <PackagePreview pkg={previewing} onBack={() => setPreviewing(null)} onChoose={() => choose(previewing.id)} />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {packages.map((p) => (
            <PackageCard key={p.id} pkg={p} selected={p.id === value} onSelect={() => choose(p.id)} onPreview={() => setPreviewing(p)} />
          ))}
        </ScrollView>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12 },
  preview: { paddingBottom: 16 },
  back: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 44, paddingHorizontal: 12, alignSelf: "flex-start" },
  backText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
  previewName: { fontFamily: fonts.bold, fontSize: 16, color: colors.text, textAlign: "center", marginBottom: 8 },
  choose: { paddingHorizontal: 16, paddingTop: 12 },
  card: { borderRadius: 14, borderWidth: 1.5, borderColor: manage.line, backgroundColor: manage.card, paddingHorizontal: 12, paddingTop: 12 },
  cardOn: { borderColor: colors.primary, backgroundColor: manage.tint },
  main: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  info: { flex: 1, gap: 4 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  name: { flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  price: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
  desc: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  chip: { alignSelf: "flex-start", overflow: "hidden", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, fontFamily: fonts.semibold, fontSize: 11, color: colors.primary, backgroundColor: manage.tint, borderWidth: 1, borderColor: manage.line },
  where: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, alignSelf: "flex-end" },
  whereText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primary },
});
