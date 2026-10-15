import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#f8fafc" } }}>
      <Stack.Screen name="login" options={{ title: "Sign In" }} />
      <Stack.Screen name="register" options={{ title: "Sign Up" }} />
      <Stack.Screen name="staff-login" options={{ title: "Staff Sign In" }} />
      <Stack.Screen name="select-org" options={{ title: "Choose Organization" }} />
    </Stack>
  );
}
