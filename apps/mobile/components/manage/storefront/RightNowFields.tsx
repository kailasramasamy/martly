import { View } from "react-native";
import { DAY_PARTS, type DayPart } from "@martly/shared/constants";
import { CollectionField } from "../home-layout/CollectionField";
import type { HeroConfig } from "./use-hero-cards";

const DAY_PART_LABELS: Record<DayPart, string> = {
  morning: "Morning (6 am to noon)", afternoon: "Afternoon (noon to 5 pm)", evening: "Evening (5 to 9 pm)", night: "Night (9 pm to 6 am)",
};

/** The collection the "Right now" card shows in each part of the day; a part left empty shows no card then */
export function RightNowFields({ config, onChange }: { config: HeroConfig; onChange: (rightNow: HeroConfig["rightNow"]) => void }) {
  const set = (part: DayPart, id: string | null) => {
    const { [part]: _, ...rest } = config.rightNow;
    onChange(id ? { ...rest, [part]: id } : rest);
  };
  return (
    <View>
      {DAY_PARTS.map((part) => (
        <CollectionField key={part} label={DAY_PART_LABELS[part]} value={config.rightNow[part] ?? null} onChange={(id) => set(part, id)} />
      ))}
    </View>
  );
}
