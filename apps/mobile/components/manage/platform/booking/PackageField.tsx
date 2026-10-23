import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../../constants/theme";
import { FieldFrame } from "../../ui/FieldFrame";
import { fieldStyles as fs } from "../../ui/fieldStyles";
import { manage } from "../../ui/tokens";
import { MockupThumb } from "../placements/MockupThumb";
import { PlacementPreviewSheet, WhereItShowsLink } from "../placements/PlacementPreviewSheet";
import type { BrandPackage } from "../types";
import { PackagePickerSheet } from "./PackagePickerSheet";
import { packagePrice } from "./package-format";

interface Props {
  value: string | null;
  packages: BrandPackage[];
  onChange: (productId: string) => void;
  error?: string | null;
  disabled?: boolean;
}

/** Visual package picker: a card for the chosen package, a sheet of mockup cards to change it */
export function PackageField({ value, packages, onChange, error, disabled }: Props) {
  const [picking, setPicking] = useState(false);
  const [previewing, setPreviewing] = useState<BrandPackage | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const preview = (p: BrandPackage) => { setPreviewing(p); setPreviewOpen(true); };
  const selected = packages.find((p) => p.id === value);
  return (
    <FieldFrame label="Package" required error={error}>
      {selected ? (
        <View style={[styles.card, !!error && fs.boxError, disabled && fs.boxDisabled]}>
          <TouchableOpacity style={styles.main} onPress={() => setPicking(true)} disabled={disabled} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={`Package: ${selected.name}. Change`}>
            <MockupThumb kind={selected.kind} placement={selected.placement} width={44} />
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>{selected.name}</Text>
              <Text style={styles.price}>{packagePrice(selected)}</Text>
            </View>
            {disabled ? null : <Text style={styles.change}>Change</Text>}
          </TouchableOpacity>
          <WhereItShowsLink onPress={() => preview(selected)} />
        </View>
      ) : (
        <TouchableOpacity style={[styles.empty, !!error && fs.boxError, disabled && fs.boxDisabled]} onPress={() => setPicking(true)} disabled={disabled} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Package: none. Choose a package">
          <Ionicons name="albums-outline" size={20} color={colors.primary} />
          <Text style={styles.emptyText}>Choose a package</Text>
          <Ionicons name="chevron-forward" size={18} color={manage.muted} />
        </TouchableOpacity>
      )}
      <PackagePickerSheet visible={picking} packages={packages} value={value} onPick={onChange} onClose={() => setPicking(false)} />
      <PlacementPreviewSheet visible={previewOpen} target={previewing} onClose={() => setPreviewOpen(false)} />
    </FieldFrame>
  );
}

const styles = StyleSheet.create({
  empty: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.primary, backgroundColor: manage.tint },
  emptyText: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.primary },
  card: { borderRadius: 12, borderWidth: 1, borderColor: manage.line, backgroundColor: manage.card, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 2 },
  main: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 80 },
  info: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  price: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  change: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primary },
});
