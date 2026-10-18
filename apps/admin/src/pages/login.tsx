import { AuthPage } from "@refinedev/antd";
import { theme } from "antd";

export const LoginPage = () => {
  const { token } = theme.useToken();
  const isDark = token.colorBgContainer !== "#ffffff";

  return (
    <AuthPage
      type="login"
      title={
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <img
            src={isDark ? "/martly-wordmark-dark.svg" : "/martly-wordmark.svg"}
            alt="Martly"
            style={{ width: 200, height: "auto" }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: "#ffffff",
              background: "#0f766e",
              borderRadius: 999,
              padding: "4px 14px",
            }}
          >
            Admin
          </span>
        </div>
      }
    />
  );
};
