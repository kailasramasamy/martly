import { Redirect } from "expo-router";

// OTP auth handles both login and registration — redirect to login
export default function RegisterScreen() {
  return <Redirect href="/(auth)/login" />;
}
