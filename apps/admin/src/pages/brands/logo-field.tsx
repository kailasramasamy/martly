import { useState } from "react";
import { Space, Switch, Typography, message, type FormInstance } from "antd";
import { ImageUpload, postImage } from "../../components/ImageUpload";

interface BrandLogo {
  imageUrl: string;
  themeColor: string | null;
  themeColorSecondary: string | null;
  background: "removed" | "transparent" | "kept";
}

interface BrandLogoFieldProps {
  form?: FormInstance;
  value?: string;
  onChange?: (url: string) => void;
}

/** Logo upload that trims the logo, optionally removes its background, and fills the brand colours from it */
export function BrandLogoField({ form, value, onChange }: BrandLogoFieldProps) {
  const [removeBg, setRemoveBg] = useState(true);

  const upload = async (file: Blob) => {
    const logo = await postImage<BrandLogo>(`/api/v1/brands/logo?removeBackground=${removeBg}`, file);
    form?.setFieldsValue({ themeColor: logo.themeColor, themeColorSecondary: logo.themeColorSecondary });
    if (removeBg && logo.background === "kept") message.warning("Couldn't remove the background, kept the original");
    return logo.imageUrl;
  };

  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <Space>
        <Switch checked={removeBg} onChange={setRemoveBg} size="small" />
        <span>Remove background</span>
      </Space>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Turn off if the logo is already clean. Transparent logos are never changed. Brand colours are filled in from the logo.
      </Typography.Text>
      <ImageUpload value={value} onChange={onChange} upload={upload} />
    </Space>
  );
}
