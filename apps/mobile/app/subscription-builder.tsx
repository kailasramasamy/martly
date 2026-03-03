import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../lib/api";
import { useStore } from "../lib/store-context";
import { useToast } from "../lib/toast-context";
import { colors, spacing, fontSize, fonts } from "../constants/theme";
import type { StoreProduct, UserAddress } from "../lib/types";

type Frequency = "DAILY" | "ALTERNATE_DAYS" | "SPECIFIC_DAYS" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";

interface SubscriptionItem {
  storeProduct: StoreProduct;
  quantity: number;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STEPS = ["Items", "Frequency", "Address", "Review"];

function getEffectivePrice(sp: StoreProduct): number {
  return sp.pricing?.effectivePrice ?? sp.price;
}

function formatPrice(amount: number): string {
  return `\u20B9${Math.round(amount).toLocaleString("en-IN")}`;
}

function getNextDeliveryDate(frequency: Frequency, selectedDays: number[]): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (frequency === "DAILY" || frequency === "ALTERNATE_DAYS") return formatDate(tomorrow);

  if (frequency === "SPECIFIC_DAYS") {
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + 1 + i);
      if (selectedDays.includes(d.getDay())) return formatDate(d);
    }
    return formatDate(tomorrow);
  }

  if (frequency === "WEEKLY" || frequency === "BIWEEKLY") {
    const targetDay = selectedDays[0] ?? 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + 1 + i);
      if (d.getDay() === targetDay) return formatDate(d);
    }
    return formatDate(tomorrow);
  }

  if (frequency === "MONTHLY") {
    const targetDate = selectedDays[0] ?? 1;
    const candidate = new Date(tomorrow);
    if (candidate.getDate() <= targetDate) {
      candidate.setDate(targetDate);
      return formatDate(candidate);
    }
    candidate.setMonth(candidate.getMonth() + 1);
    candidate.setDate(targetDate);
    return formatDate(candidate);
  }

  return formatDate(tomorrow);
}

function formatDate(d: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

export default function SubscriptionBuilderScreen() {
  const router = useRouter();
  const { storeProductId, productId: paramProductId } = useLocalSearchParams<{ storeProductId?: string; productId?: string }>();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { selectedStore } = useStore();
  const storeId = selectedStore?.id;

  const [step, setStep] = useState(0);

  // Step 1: Items
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StoreProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [items, setItems] = useState<SubscriptionItem[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 2: Frequency
  const [frequency, setFrequency] = useState<Frequency>("DAILY");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  // Step 3: Address
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  // Step 4: Submit
  const [autoPayWithWallet, setAutoPayWithWallet] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Search products with debounce
  useEffect(() => {
    if (!storeId || !searchQuery.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    if (searchTimer.current) clearTimeout(searchTimer.current);

    searchTimer.current = setTimeout(async () => {
      try {
        const res = await api.getList<StoreProduct>(
          `/api/v1/stores/${storeId}/products?q=${encodeURIComponent(searchQuery.trim())}&page=1&pageSize=20`
        );
        setSearchResults(res.data);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchQuery, storeId]);

  // Auto-load product from storeProductId param (navigated from product detail)
  useEffect(() => {
    if (!storeProductId || !storeId) return;
    const query = paramProductId
      ? `/api/v1/stores/${storeId}/products?productId=${paramProductId}`
      : `/api/v1/stores/${storeId}/products?search=&pageSize=50`;
    api
      .getList<StoreProduct>(query)
      .then((res) => {
        const sp = res.data.find((p) => p.id === storeProductId);
        if (!sp) return;
        setItems((prev) => {
          if (prev.some((i) => i.storeProduct.id === sp.id)) return prev;
          return [...prev, { storeProduct: sp, quantity: 1 }];
        });
      })
      .catch(() => {});
  }, [storeProductId, paramProductId, storeId]);

  // Fetch addresses when entering step 3
  useEffect(() => {
    if (step === 2) {
      setLoadingAddresses(true);
      api
        .get<UserAddress[]>("/api/v1/addresses")
        .then((res) => {
          setAddresses(res.data);
          const defaultAddr = res.data.find((a) => a.isDefault);
          if (defaultAddr && !selectedAddressId) {
            setSelectedAddressId(defaultAddr.id);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingAddresses(false));
    }
  }, [step]);

  const addItem = useCallback((sp: StoreProduct) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.storeProduct.id === sp.id);
      if (existing) return prev;
      return [...prev, { storeProduct: sp, quantity: 1 }];
    });
  }, []);

  const updateQuantity = useCallback((spId: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((i) => {
          if (i.storeProduct.id !== spId) return i;
          const newQty = i.quantity + delta;
          if (newQty <= 0) return null;
          return { ...i, quantity: newQty };
        })
        .filter(Boolean) as SubscriptionItem[]
    );
  }, []);

  const removeItem = useCallback((spId: string) => {
    setItems((prev) => prev.filter((i) => i.storeProduct.id !== spId));
  }, []);

  const toggleDay = useCallback((day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }, []);

  const canProceed = (): boolean => {
    if (step === 0) return items.length > 0;
    if (step === 1) {
      if (frequency === "SPECIFIC_DAYS") return selectedDays.length > 0;
      if (frequency === "WEEKLY" || frequency === "BIWEEKLY") return selectedDays.length === 1;
      if (frequency === "MONTHLY") return selectedDays.length === 1;
      return true;
    }
    if (step === 2) return selectedAddressId !== null;
    return true;
  };

  const handleBack = () => {
    if (step === 0) {
      router.back();
    } else {
      setStep((s) => s - 1);
    }
  };

  const handleNext = () => {
    if (step < 3) {
      setStep((s) => s + 1);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!storeId || !selectedAddressId) return;
    const selectedAddress = addresses.find((a) => a.id === selectedAddressId);
    if (!selectedAddress) return;

    setSubmitting(true);
    try {
      const needsDays = ["SPECIFIC_DAYS", "WEEKLY", "BIWEEKLY", "MONTHLY"].includes(frequency);
      await api.post("/api/v1/subscriptions", {
        storeId,
        frequency,
        selectedDays: needsDays ? selectedDays : [],
        deliveryAddress: selectedAddress.address,
        addressId: selectedAddressId,
        autoPayWithWallet,
        items: items.map((i) => ({
          storeProductId: i.storeProduct.id,
          quantity: i.quantity,
        })),
      });
      toast.show("Subscription created!", "success");
      router.replace("/subscriptions");
    } catch (e: any) {
      toast.show(e.message || "Failed to create subscription", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const totalAmount = items.reduce(
    (sum, i) => sum + getEffectivePrice(i.storeProduct) * i.quantity,
    0
  );

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);

  const isItemAdded = (spId: string) => items.some((i) => i.storeProduct.id === spId);

  // --- Renderers ---

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {STEPS.map((label, i) => (
        <View key={label} style={styles.stepDotRow}>
          <View
            style={[
              styles.stepDot,
              i <= step ? styles.stepDotActive : null,
              i < step ? styles.stepDotCompleted : null,
            ]}
          >
            {i < step ? (
              <Ionicons name="checkmark" size={12} color="#fff" />
            ) : (
              <Text
                style={[
                  styles.stepDotText,
                  i <= step ? styles.stepDotTextActive : null,
                ]}
              >
                {i + 1}
              </Text>
            )}
          </View>
          <Text
            style={[
              styles.stepLabel,
              i === step ? styles.stepLabelActive : null,
            ]}
          >
            {label}
          </Text>
          {i < STEPS.length - 1 && (
            <View
              style={[
                styles.stepLine,
                i < step ? styles.stepLineActive : null,
              ]}
            />
          )}
        </View>
      ))}
    </View>
  );

  const renderSearchResult = ({ item: sp }: { item: StoreProduct }) => {
    const added = isItemAdded(sp.id);
    const price = getEffectivePrice(sp);
    return (
      <View style={styles.searchResultRow}>
        {sp.product.imageUrl ? (
          <Image source={{ uri: sp.product.imageUrl }} style={styles.searchResultImage} />
        ) : (
          <View style={[styles.searchResultImage, styles.imagePlaceholder]}>
            <Ionicons name="image-outline" size={20} color={colors.border} />
          </View>
        )}
        <View style={styles.searchResultInfo}>
          <Text style={styles.searchResultName} numberOfLines={1}>
            {sp.product.name}
          </Text>
          <Text style={styles.searchResultVariant}>
            {sp.variant.name} &middot; {sp.variant.unitValue}
            {sp.variant.unitType}
          </Text>
          <Text style={styles.searchResultPrice}>{formatPrice(price)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, added ? styles.addBtnDisabled : null]}
          onPress={() => !added && addItem(sp)}
          disabled={added}
        >
          <Ionicons
            name={added ? "checkmark" : "add"}
            size={20}
            color={added ? colors.textSecondary : "#fff"}
          />
        </TouchableOpacity>
      </View>
    );
  };

  const renderSelectedItem = (item: SubscriptionItem) => {
    const price = getEffectivePrice(item.storeProduct);
    return (
      <View key={item.storeProduct.id} style={styles.selectedItemRow}>
        {item.storeProduct.product.imageUrl ? (
          <Image source={{ uri: item.storeProduct.product.imageUrl }} style={styles.selectedItemImage} />
        ) : (
          <View style={[styles.selectedItemImage, styles.imagePlaceholder]}>
            <Ionicons name="image-outline" size={18} color={colors.border} />
          </View>
        )}
        <View style={styles.selectedItemInfo}>
          <Text style={styles.selectedItemName} numberOfLines={1}>
            {item.storeProduct.product.name}
          </Text>
          <Text style={styles.selectedItemVariant}>
            {item.storeProduct.variant.unitValue}
            {item.storeProduct.variant.unitType}
          </Text>
        </View>
        <View style={styles.qtyControls}>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={() => updateQuantity(item.storeProduct.id, -1)}
          >
            <Ionicons
              name={item.quantity === 1 ? "trash-outline" : "remove"}
              size={16}
              color={item.quantity === 1 ? colors.error : colors.text}
            />
          </TouchableOpacity>
          <Text style={styles.qtyText}>{item.quantity}</Text>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={() => updateQuantity(item.storeProduct.id, 1)}
          >
            <Ionicons name="add" size={16} color={colors.text} />
          </TouchableOpacity>
        </View>
        <Text style={styles.selectedItemPrice}>
          {formatPrice(price * item.quantity)}
        </Text>
      </View>
    );
  };

  // Step 1: Add Items
  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color={colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {searching && (
        <ActivityIndicator
          size="small"
          color={colors.primary}
          style={{ marginTop: spacing.md }}
        />
      )}

      {!searching && searchQuery.trim().length > 0 && searchResults.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={40} color={colors.border} />
          <Text style={styles.emptyText}>No products found</Text>
        </View>
      )}

      {!searching && searchResults.length > 0 && (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id}
          renderItem={renderSearchResult}
          style={styles.searchResultsList}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {!searchQuery.trim() && items.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="cart-outline" size={48} color={colors.border} />
          <Text style={styles.emptyText}>Search and add items to your subscription</Text>
        </View>
      )}

      {items.length > 0 && !searchQuery.trim() && (
        <ScrollView style={styles.selectedItemsList}>
          <Text style={styles.sectionTitle}>
            Subscription Items ({items.length})
          </Text>
          {items.map(renderSelectedItem)}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Per delivery total</Text>
            <Text style={styles.totalValue}>{formatPrice(totalAmount)}</Text>
          </View>
        </ScrollView>
      )}
    </View>
  );

  const selectSingleDay = useCallback((day: number) => {
    setSelectedDays([day]);
  }, []);

  // Step 2: Frequency
  const renderStep2 = () => {
    const frequencyOptions: {
      value: Frequency;
      title: string;
      desc: string;
      icon: keyof typeof Ionicons.glyphMap;
      needsPicker?: "days" | "dayOfWeek" | "monthDate";
    }[] = [
      { value: "DAILY", title: "Daily", desc: "Delivered every day", icon: "calendar" },
      { value: "ALTERNATE_DAYS", title: "Alternate Days", desc: "Every other day", icon: "calendar-outline" },
      { value: "SPECIFIC_DAYS", title: "Specific Days", desc: "Choose your days", icon: "calendar-number-outline", needsPicker: "days" },
      { value: "WEEKLY", title: "Weekly", desc: "Once a week", icon: "repeat", needsPicker: "dayOfWeek" },
      { value: "BIWEEKLY", title: "Every 2 Weeks", desc: "Once every 2 weeks", icon: "swap-horizontal", needsPicker: "dayOfWeek" },
      { value: "MONTHLY", title: "Monthly", desc: "Once a month", icon: "calendar-clear-outline", needsPicker: "monthDate" },
    ];

    const monthDates = Array.from({ length: 28 }, (_, i) => i + 1);

    const renderInlinePicker = (type: "days" | "dayOfWeek" | "monthDate") => {
      if (type === "days") {
        return (
          <View style={styles.inlinePicker}>
            <Text style={styles.inlinePickerLabel}>Select delivery days</Text>
            <View style={styles.dayChips}>
              {DAY_LABELS.map((label, i) => (
                <TouchableOpacity
                  key={label}
                  style={[styles.dayChip, selectedDays.includes(i) && styles.dayChipActive]}
                  onPress={() => toggleDay(i)}
                >
                  <Text style={[styles.dayChipText, selectedDays.includes(i) && styles.dayChipTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      }
      if (type === "dayOfWeek") {
        return (
          <View style={styles.inlinePicker}>
            <Text style={styles.inlinePickerLabel}>Pick delivery day</Text>
            <View style={styles.dayChips}>
              {DAY_LABELS.map((label, i) => (
                <TouchableOpacity
                  key={label}
                  style={[styles.dayChip, selectedDays[0] === i && styles.dayChipActive]}
                  onPress={() => selectSingleDay(i)}
                >
                  <Text style={[styles.dayChipText, selectedDays[0] === i && styles.dayChipTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      }
      return (
        <View style={styles.inlinePicker}>
          <Text style={styles.inlinePickerLabel}>Pick day of month</Text>
          <View style={styles.monthDateGrid}>
            {monthDates.map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.monthDateCell, selectedDays[0] === d && styles.monthDateCellActive]}
                onPress={() => selectSingleDay(d)}
              >
                <Text style={[styles.monthDateText, selectedDays[0] === d && styles.monthDateTextActive]}>
                  {d}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    };

    return (
      <ScrollView style={styles.stepContent} contentContainerStyle={styles.stepContentPadding}>
        <Text style={styles.sectionTitle}>How often do you want delivery?</Text>
        <View style={styles.freqList}>
          {frequencyOptions.map((opt) => {
            const isActive = frequency === opt.value;
            return (
              <View key={opt.value}>
                <TouchableOpacity
                  style={[
                    styles.freqRow,
                    isActive && styles.freqRowActive,
                    isActive && opt.needsPicker && styles.freqRowWithPicker,
                  ]}
                  onPress={() => {
                    setFrequency(opt.value);
                    setSelectedDays([]);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.freqIconWrap, isActive && styles.freqIconWrapActive]}>
                    <Ionicons name={opt.icon} size={20} color={isActive ? "#fff" : colors.textSecondary} />
                  </View>
                  <View style={styles.freqTextWrap}>
                    <Text style={[styles.freqTitle, isActive && styles.freqTitleActive]}>{opt.title}</Text>
                    <Text style={styles.freqDesc}>{opt.desc}</Text>
                  </View>
                  <View style={[styles.freqRadio, isActive && styles.freqRadioActive]}>
                    {isActive && <View style={styles.freqRadioDot} />}
                  </View>
                </TouchableOpacity>
                {isActive && opt.needsPicker && renderInlinePicker(opt.needsPicker)}
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  // Step 3: Address
  const renderStep3 = () => {
    if (loadingAddresses) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    if (addresses.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="location-outline" size={48} color={colors.border} />
          <Text style={styles.emptyText}>No saved addresses</Text>
          <Text style={styles.emptySubtext}>
            Add an address from your profile to continue
          </Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.stepContent} contentContainerStyle={styles.stepContentPadding}>
        <Text style={styles.sectionTitle}>Select delivery address</Text>
        {addresses.map((addr) => (
          <TouchableOpacity
            key={addr.id}
            style={[
              styles.addressCard,
              selectedAddressId === addr.id ? styles.addressCardActive : null,
            ]}
            onPress={() => setSelectedAddressId(addr.id)}
            activeOpacity={0.7}
          >
            <View style={styles.addressRadio}>
              <View
                style={[
                  styles.radioOuter,
                  selectedAddressId === addr.id
                    ? styles.radioOuterActive
                    : null,
                ]}
              >
                {selectedAddressId === addr.id && (
                  <View style={styles.radioInner} />
                )}
              </View>
            </View>
            <View style={styles.addressInfo}>
              <View style={styles.addressLabelRow}>
                <Ionicons
                  name={
                    addr.label.toLowerCase() === "home"
                      ? "home-outline"
                      : addr.label.toLowerCase() === "work"
                      ? "briefcase-outline"
                      : "location-outline"
                  }
                  size={16}
                  color={
                    selectedAddressId === addr.id
                      ? colors.primary
                      : colors.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.addressLabel,
                    selectedAddressId === addr.id
                      ? styles.addressLabelActive
                      : null,
                  ]}
                >
                  {addr.label}
                </Text>
                {addr.isDefault && (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultBadgeText}>Default</Text>
                  </View>
                )}
              </View>
              <Text style={styles.addressText} numberOfLines={2}>
                {addr.address}
              </Text>
              {addr.pincode && (
                <Text style={styles.addressPincode}>{addr.pincode}</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  // Step 4: Review
  const renderStep4 = () => {
    const FULL_DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const frequencyLabel =
      frequency === "DAILY"
        ? "Daily"
        : frequency === "ALTERNATE_DAYS"
        ? "Alternate Days"
        : frequency === "WEEKLY"
        ? `Weekly \u2013 ${FULL_DAY_LABELS[selectedDays[0]] ?? ""}`
        : frequency === "BIWEEKLY"
        ? `Every 2 Weeks \u2013 ${FULL_DAY_LABELS[selectedDays[0]] ?? ""}`
        : frequency === "MONTHLY"
        ? `Monthly \u2013 ${selectedDays[0]}${selectedDays[0] === 1 ? "st" : selectedDays[0] === 2 ? "nd" : selectedDays[0] === 3 ? "rd" : "th"} of each month`
        : `${selectedDays.map((d) => DAY_LABELS[d]).join(", ")}`;

    const nextDelivery = getNextDeliveryDate(frequency, selectedDays);

    return (
      <ScrollView style={styles.stepContent} contentContainerStyle={styles.stepContentPadding}>
        <Text style={styles.sectionTitle}>Review your subscription</Text>

        {/* Items */}
        <View style={styles.reviewCard}>
          <View style={styles.reviewCardHeader}>
            <Ionicons name="cart-outline" size={18} color={colors.primary} />
            <Text style={styles.reviewCardTitle}>
              Items ({items.length})
            </Text>
          </View>
          {items.map((item) => {
            const price = getEffectivePrice(item.storeProduct);
            return (
              <View key={item.storeProduct.id} style={styles.reviewItemRow}>
                <Text style={styles.reviewItemName} numberOfLines={1}>
                  {item.storeProduct.product.name}
                </Text>
                <Text style={styles.reviewItemQty}>x{item.quantity}</Text>
                <Text style={styles.reviewItemPrice}>
                  {formatPrice(price * item.quantity)}
                </Text>
              </View>
            );
          })}
          <View style={styles.reviewTotalRow}>
            <Text style={styles.reviewTotalLabel}>Per delivery</Text>
            <Text style={styles.reviewTotalValue}>
              {formatPrice(totalAmount)}
            </Text>
          </View>
        </View>

        {/* Frequency */}
        <View style={styles.reviewCard}>
          <View style={styles.reviewCardHeader}>
            <Ionicons name="repeat-outline" size={18} color={colors.primary} />
            <Text style={styles.reviewCardTitle}>Frequency</Text>
          </View>
          <Text style={styles.reviewCardValue}>{frequencyLabel}</Text>
        </View>

        {/* Address */}
        <View style={styles.reviewCard}>
          <View style={styles.reviewCardHeader}>
            <Ionicons
              name="location-outline"
              size={18}
              color={colors.primary}
            />
            <Text style={styles.reviewCardTitle}>Delivery Address</Text>
          </View>
          {selectedAddress && (
            <>
              <Text style={styles.reviewAddressLabel}>
                {selectedAddress.label}
              </Text>
              <Text style={styles.reviewAddressText}>
                {selectedAddress.address}
              </Text>
            </>
          )}
        </View>

        {/* Auto-pay toggle */}
        <View style={styles.reviewCard}>
          <View style={styles.autoPayRow}>
            <View style={styles.autoPayInfo}>
              <Ionicons
                name="wallet-outline"
                size={18}
                color={colors.primary}
              />
              <Text style={styles.autoPayLabel}>Auto-pay with wallet</Text>
            </View>
            <Switch
              value={autoPayWithWallet}
              onValueChange={setAutoPayWithWallet}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={autoPayWithWallet ? colors.primary : "#f4f3f4"}
            />
          </View>
        </View>

        {/* First delivery */}
        <View style={styles.firstDeliveryCard}>
          <Ionicons name="time-outline" size={18} color={colors.primary} />
          <Text style={styles.firstDeliveryText}>
            First delivery: {nextDelivery}
          </Text>
        </View>
      </ScrollView>
    );
  };

  const renderCurrentStep = () => {
    switch (step) {
      case 0:
        return renderStep1();
      case 1:
        return renderStep2();
      case 2:
        return renderStep3();
      case 3:
        return renderStep4();
      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      {renderStepIndicator()}
      {renderCurrentStep()}

      {/* Bottom action bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.sm }]}>
        {step > 0 && (
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.nextButton,
            !canProceed() ? styles.nextButtonDisabled : null,
            step === 0 && styles.nextButtonFull,
          ]}
          onPress={handleNext}
          disabled={!canProceed() || submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.nextButtonText}>
              {step === 3 ? "Subscribe" : "Next"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Step indicator
  stepIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stepDotRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  stepDotCompleted: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepDotText: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
  },
  stepDotTextActive: {
    color: "#fff",
  },
  stepLabel: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  stepLabelActive: {
    color: colors.primary,
    fontFamily: fonts.semibold,
  },
  stepLine: {
    width: 20,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: 4,
  },
  stepLineActive: {
    backgroundColor: colors.primary,
  },

  // Step content
  stepContent: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  stepContentPadding: {
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // Search
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm + 4,
    height: 44,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.md,
    fontFamily: fonts.regular,
    color: colors.text,
    paddingVertical: 0,
  },

  // Search results
  searchResultsList: {
    marginTop: spacing.sm,
    flex: 1,
  },
  searchResultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  searchResultImage: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: colors.surface,
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: fontSize.md,
    fontFamily: fonts.medium,
    color: colors.text,
  },
  searchResultVariant: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 1,
  },
  searchResultPrice: {
    fontSize: fontSize.md,
    fontFamily: fonts.semibold,
    color: colors.text,
    marginTop: 2,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnDisabled: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // Selected items
  selectedItemsList: {
    flex: 1,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontFamily: fonts.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  selectedItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  selectedItemImage: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: colors.surface,
  },
  selectedItemInfo: {
    flex: 1,
  },
  selectedItemName: {
    fontSize: fontSize.md,
    fontFamily: fonts.medium,
    color: colors.text,
  },
  selectedItemVariant: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  qtyControls: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 0,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: {
    fontSize: fontSize.md,
    fontFamily: fonts.semibold,
    color: colors.text,
    minWidth: 20,
    textAlign: "center",
  },
  selectedItemPrice: {
    fontSize: fontSize.md,
    fontFamily: fonts.semibold,
    color: colors.text,
    minWidth: 60,
    textAlign: "right",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  totalLabel: {
    fontSize: fontSize.md,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  totalValue: {
    fontSize: fontSize.lg,
    fontFamily: fonts.bold,
    color: colors.primary,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  emptyText: {
    fontSize: fontSize.md,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: "center",
  },

  // Frequency cards
  freqList: {
    gap: 0,
  },
  freqRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  freqRowActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + "08",
  },
  freqRowWithPicker: {
    marginBottom: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  freqIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.border + "60",
    alignItems: "center",
    justifyContent: "center",
  },
  freqIconWrapActive: {
    backgroundColor: colors.primary,
  },
  freqTextWrap: {
    flex: 1,
  },
  freqTitle: {
    fontSize: fontSize.md,
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  freqTitleActive: {
    color: colors.primary,
  },
  freqDesc: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 1,
  },
  freqRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  freqRadioActive: {
    borderColor: colors.primary,
  },
  freqRadioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  inlinePicker: {
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderColor: colors.primary,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    backgroundColor: colors.primary + "08",
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  inlinePickerLabel: {
    fontSize: fontSize.sm,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  dayChips: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  dayChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  dayChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  dayChipText: {
    fontSize: fontSize.md,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  dayChipTextActive: {
    color: "#fff",
  },

  // Month date grid
  monthDateGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  monthDateCell: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  monthDateCellActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  monthDateText: {
    fontSize: fontSize.md,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  monthDateTextActive: {
    color: "#fff",
  },

  // Address cards
  addressCard: {
    flexDirection: "row",
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    marginBottom: spacing.sm,
  },
  addressCardActive: {
    borderColor: colors.primary,
    backgroundColor: "#f0fdf4",
  },
  addressRadio: {
    paddingTop: 2,
    marginRight: spacing.sm,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterActive: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  addressInfo: {
    flex: 1,
  },
  addressLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: 4,
  },
  addressLabel: {
    fontSize: fontSize.md,
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  addressLabelActive: {
    color: colors.primary,
  },
  defaultBadge: {
    backgroundColor: colors.primary + "18",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 4,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontFamily: fonts.medium,
    color: colors.primary,
  },
  addressText: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  addressPincode: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Review
  reviewCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  reviewCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  reviewCardTitle: {
    fontSize: fontSize.md,
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  reviewCardValue: {
    fontSize: fontSize.md,
    fontFamily: fonts.medium,
    color: colors.text,
  },
  reviewItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    gap: spacing.sm,
  },
  reviewItemName: {
    flex: 1,
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.text,
  },
  reviewItemQty: {
    fontSize: fontSize.sm,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  reviewItemPrice: {
    fontSize: fontSize.sm,
    fontFamily: fonts.semibold,
    color: colors.text,
    minWidth: 50,
    textAlign: "right",
  },
  reviewTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
  },
  reviewTotalLabel: {
    fontSize: fontSize.md,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  reviewTotalValue: {
    fontSize: fontSize.lg,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  reviewAddressLabel: {
    fontSize: fontSize.md,
    fontFamily: fonts.semibold,
    color: colors.text,
    marginBottom: 2,
  },
  reviewAddressText: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  autoPayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  autoPayInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  autoPayLabel: {
    fontSize: fontSize.md,
    fontFamily: fonts.medium,
    color: colors.text,
  },
  firstDeliveryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "#f0fdf4",
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  firstDeliveryText: {
    fontSize: fontSize.md,
    fontFamily: fonts.medium,
    color: colors.primaryDark,
  },

  // Bottom bar
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  backButtonText: {
    fontSize: fontSize.md,
    fontFamily: fonts.medium,
    color: colors.text,
  },
  nextButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm + 4,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  nextButtonFull: {
    flex: 1,
  },
  nextButtonDisabled: {
    backgroundColor: colors.border,
  },
  nextButtonText: {
    fontSize: fontSize.lg,
    fontFamily: fonts.semibold,
    color: "#fff",
  },
});
