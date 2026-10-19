export interface HomeSectionItem {
  label: string;
  imageUrl: string | null;
  collectionId: string | null;
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
