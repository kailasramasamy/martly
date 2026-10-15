import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../constants/theme";
import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import { Button } from "../ui/Button";

interface InstructionsCardProps {
  steps: string[];
  onChange: (next: string[]) => void;
}

export function InstructionsCard({ steps, onChange }: InstructionsCardProps) {
  return (
    <SectionCard title="Steps">
      {steps.map((step, i) => (
        <View key={i} style={styles.row}>
          <View style={styles.field}>
            <TextField label={`Step ${i + 1}`} multiline value={step} onChangeText={(text) => onChange(steps.map((s, j) => (j === i ? text : s)))} />
          </View>
          {steps.length > 1 && (
            <TouchableOpacity style={styles.remove} onPress={() => onChange(steps.filter((_, j) => j !== i))} accessibilityLabel={`Remove step ${i + 1}`}>
              <Ionicons name="close-circle-outline" size={22} color={colors.error} />
            </TouchableOpacity>
          )}
        </View>
      ))}
      <Button label="Add step" icon="add" variant="secondary" onPress={() => onChange([...steps, ""])} />
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 4 },
  field: { flex: 1 },
  remove: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginTop: 20 },
});
