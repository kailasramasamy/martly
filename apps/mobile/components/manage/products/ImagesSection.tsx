import { SectionCard } from "../ui/SectionCard";
import { ImageField } from "../ui/ImageField";
import { ImageGalleryField } from "./ImageGalleryField";
import type { SectionProps } from "./sections";

export function ImagesSection({ values, onChange }: SectionProps) {
  return (
    <SectionCard title="Images">
      <ImageField label="Main image" value={values.imageUrl} onChange={(imageUrl) => onChange({ imageUrl })} />
      <ImageGalleryField label="Additional images" value={values.images} onChange={(images) => onChange({ images })} />
    </SectionCard>
  );
}
