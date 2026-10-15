import { router } from "expo-router";
import type { AuthTokens, LoginResponse } from "@martly/shared/types";

/** Finish a login: multi-org staff go to the org picker, everyone else is signed in directly */
export async function completeLogin(result: LoginResponse, login: (tokens: AuthTokens) => Promise<void>) {
  if (result.requiresOrgSelection) {
    router.push({
      pathname: "/(auth)/select-org",
      params: { token: result.temporaryToken, orgs: JSON.stringify(result.organizations) },
    });
    return;
  }
  await login({ accessToken: result.accessToken, refreshToken: result.refreshToken });
}
