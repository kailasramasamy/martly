import { useEffect, useRef, useState } from "react";
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../constants/theme";
import { openBannerTarget } from "../../lib/banner-action";
import { recordBannerTap, recordBannerView } from "../../lib/banner-events";
import type { Banner } from "../../lib/types";

interface Props {
  banner: Banner | null;
  storeId: string | undefined;
}

/** The store's pop-up banner, shown once per visit to Home */
export function PopupBanner({ banner, storeId }: Props) {
  const [visible, setVisible] = useState(false);
  const shown = useRef(false);

  useEffect(() => {
    if (!banner || shown.current) return;
    shown.current = true;
    setVisible(true);
    recordBannerView(storeId, banner.id);
  }, [banner, storeId]);

  if (!banner) return null;
  const close = () => setVisible(false);
  const open = () => {
    recordBannerTap(storeId, banner.id);
    openBannerTarget(banner);
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <TouchableOpacity style={styles.close} onPress={close} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={20} color="#64748b" />
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={banner.actionType === "NONE" ? 1 : 0.9} onPress={open}>
            <Image source={{ uri: banner.imageUrl }} style={styles.image} resizeMode="cover" />
          </TouchableOpacity>
          <View style={styles.content}>
            <Text style={styles.title}>{banner.title}</Text>
            {banner.subtitle && <Text style={styles.subtitle}>{banner.subtitle}</Text>}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 32 },
  card: { width: "100%", maxWidth: 340, backgroundColor: "#fff", borderRadius: 20, overflow: "hidden" },
  close: {
    position: "absolute", top: 10, right: 10, zIndex: 10, width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.9)", justifyContent: "center", alignItems: "center",
  },
  image: { width: "100%", height: 200 },
  content: { padding: 20, alignItems: "center" },
  title: { fontSize: 18, fontWeight: "700", color: colors.text, textAlign: "center" },
  subtitle: { fontSize: 13, color: colors.textSecondary, textAlign: "center", marginTop: 6, lineHeight: 18 },
});
