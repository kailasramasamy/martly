import { memo } from "react";
import { StyleSheet, View } from "react-native";
import type { CategoryDirectorySection as CategoryDirectory } from "@martly/shared/types";
import { DIRECTORY_TINTS, DepartmentGroup } from "../../category-directory/DepartmentGroup";
import { useSectionText } from "./context";
import { SectionHeader } from "./SectionHeader";
import { H_PADDING } from "./TileGridParts";

// Past the wide tiles a department shows at most this many full rows; its "See all" opens the rest
const MAX_ROWS = 2;

/** Departments with their categories as tiles, each department in its own tint: two wide tiles, then whole rows of four */
export const CategoryDirectorySection = memo(function CategoryDirectorySection({ section }: { section: CategoryDirectory }) {
  const { title, subtitle } = useSectionText(section);
  return (
    <View style={styles.section}>
      <SectionHeader title={title} subtitle={subtitle} />
      <View style={styles.groups}>
        {section.groups.map((group, i) => (
          <DepartmentGroup key={group.departmentId} group={group} tint={DIRECTORY_TINTS[i % DIRECTORY_TINTS.length]} maxRows={MAX_ROWS} />
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  section: { marginTop: 24 },
  groups: { paddingHorizontal: H_PADDING, gap: 28 },
});
