import { useEffect, useRef } from "react";
import { Modal, View, StyleSheet, ActivityIndicator, TouchableOpacity, Text, SafeAreaView, KeyboardAvoidingView, Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";

export interface RazorpayCheckoutProps {
  visible: boolean;
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  name?: string;
  description?: string;
  prefill?: { email?: string; contact?: string; name?: string };
  onSuccess: (data: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  onCancel: () => void;
}

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Resolve native SDK at module load — returns null in Expo Go (native module missing)
let RazorpayNative: { open: (options: Record<string, unknown>) => Promise<{ razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }> } | null = null;
if (!isExpoGo) {
  try {
    RazorpayNative = require("react-native-razorpay").default;
  } catch {
    // Native module not available — will fall back to WebView
  }
}

// ── Native SDK (production / dev client) ──────────────────
function NativeCheckout({ visible, keyId, orderId, amount, currency, name = "Martly", description = "Order Payment", prefill, onSuccess, onCancel }: RazorpayCheckoutProps) {
  const openedRef = useRef(false);

  useEffect(() => {
    if (!visible || !RazorpayNative || openedRef.current) return;
    openedRef.current = true;

    RazorpayNative.open({
      key: keyId,
      amount,
      currency,
      name,
      description,
      order_id: orderId,
      prefill: {
        email: prefill?.email ?? "",
        contact: prefill?.contact ?? "",
        name: prefill?.name ?? "",
      },
      theme: { color: "#0d9488" },
    })
      .then((data) => {
        openedRef.current = false;
        onSuccess(data);
      })
      .catch(() => {
        openedRef.current = false;
        onCancel();
      });
  }, [visible]);

  // Reset when modal is dismissed so it can be opened again
  useEffect(() => {
    if (!visible) openedRef.current = false;
  }, [visible]);

  return null;
}

// ── WebView fallback (Expo Go / native SDK unavailable) ───
function WebViewCheckout({ visible, keyId, orderId, amount, currency, name = "Martly", description = "Order Payment", prefill, onSuccess, onCancel }: RazorpayCheckoutProps) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <style>
    body { margin: 0; background: #f8fafc; display: flex; justify-content: center; align-items: center; height: 100vh; font-family: -apple-system, sans-serif; }
    .loading { text-align: center; color: #64748b; }
    .loading p { margin-top: 12px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="loading">
    <p>Opening payment...</p>
  </div>
  <script>
    var options = {
      key: ${JSON.stringify(keyId)},
      amount: ${amount},
      currency: ${JSON.stringify(currency)},
      name: ${JSON.stringify(name)},
      description: ${JSON.stringify(description)},
      order_id: ${JSON.stringify(orderId)},
      prefill: ${JSON.stringify(prefill ?? {})},
      theme: { color: "#0d9488" },
      modal: { ondismiss: function() { window.ReactNativeWebView.postMessage(JSON.stringify({ event: "cancelled" })); } },
      handler: function(response) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ event: "success", data: response }));
      }
    };
    var rzp = new Razorpay(options);
    rzp.on("payment.failed", function(response) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ event: "failed", error: response.error }));
    });
    rzp.open();
  </script>
</body>
</html>`;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Payment</Text>
          <View style={{ width: 32 }} />
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <WebView
            source={{ html }}
            originWhitelist={["*"]}
            javaScriptEnabled
            domStorageEnabled
            scrollEnabled
            startInLoadingState
            automaticallyAdjustContentInsets
            renderLoading={() => (
              <View style={styles.loader}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            )}
            onMessage={(event) => {
              try {
                const msg = JSON.parse(event.nativeEvent.data);
                if (msg.event === "success") {
                  onSuccess(msg.data);
                } else if (msg.event === "cancelled" || msg.event === "failed") {
                  onCancel();
                }
              } catch {}
            }}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Auto-select: native SDK in production, WebView in Expo Go ──
export function RazorpayCheckout(props: RazorpayCheckoutProps) {
  if (RazorpayNative) return <NativeCheckout {...props} />;
  return <WebViewCheckout {...props} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeBtn: { width: 32, height: 32, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  loader: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
});
