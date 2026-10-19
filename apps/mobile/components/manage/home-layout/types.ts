export interface HomeSectionItem {
  label: string;
  translations: Record<string, { label: string }> | null;
  imageUrl: string | null;
  collectionId: string | null;
  subcategoryIds: string[];
  wide: boolean;
}

export interface HomeSectionRecord {
  id: string;
  type: string;
  title: string | null;
  subtitle: string | null;
  collectionId: string | null;
  config: Record<string, unknown>;
  isActive: boolean;
  items?: HomeSectionItem[];
}

export interface HomeLayoutData {
  isDefault: boolean;
  sections: HomeSectionRecord[];
}

export interface PreviewHint {
  id: string;
  resolves: boolean;
}
