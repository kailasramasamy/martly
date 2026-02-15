import { AuthPage } from "@refinedev/antd";
import { ShopOutlined } from "@ant-design/icons";

export const LoginPage = () => {
  return (
    <AuthPage
      type="login"
      title={
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <ShopOutlined style={{ fontSize: 48, color: "#0d9488" }} />
          <span style={{ fontSize: 24, fontWeight: "bold", color: "#0d9488" }}>Martly Admin</span>
        </div>
      }
    />
  );
};
