import { memo } from "react";
import { StyleSheet, View } from "react-native";
import type { CategoryDirectorySection as CategoryDirectory } from "@martly/shared/types";
import { DepartmentGroup } from "../../category-directory/DepartmentGroup";
import { useSectionText } from "./context";
import { SectionHeader } from "./SectionHeader";
import { H_PADDING } from "./TileGridParts";

// A department shows at most this many full rows; its "See all" opens the rest
const MAX_ROWS = 2;

/** Departments with their categories as tiles, whole rows of four under each department's heading */
export const CategoryDirectorySection = memo(function CategoryDirectorySection({ section }: { section: CategoryDirectory }) {
  const { title, subtitle } = useSectionText(section);
  return (
    <View style={styles.section}>
      <SectionHeader title={title} subtitle={subtitle} />
      <View style={styles.groups}>
        {section.groups.map((group) => <DepartmentGroup key={group.departmentId} group={group} maxRows={MAX_ROWS} />)}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  section: { marginTop: 24 },
  groups: { paddingHorizontal: H_PADDING, gap: 28 },
});
