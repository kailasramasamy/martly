import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, type Href } from "expo-router";
import { canManage as roleCanManage } from "@martly/shared/permissions";
import { useAuth } from "./auth-context";

export type Persona = "manage" | "shop";

const PERSONA_KEY = "martly_persona";
const UNSUPPORTED_ROLES = ["STAFF", "RIDER"];

interface PersonaState {
  persona: Persona;
  canManage: boolean;
  isReady: boolean;
  /** Route the signed-in user should land on for the current persona */
  home: Href;
  switchPersona: (next: Persona) => void;
}

const PersonaContext = createContext<PersonaState | null>(null);

function homeFor(role: string | undefined, persona: Persona): Href {
  if (role && UNSUPPORTED_ROLES.includes(role)) return "/unsupported-role";
  return persona === "manage" ? "/(manage)" : "/(tabs)";
}

export function PersonaProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const canManage = roleCanManage(user?.role);
  // Persona is resolved per signed-in user; until it matches the current user it isn't ready
  const userKey = isLoading ? null : `${user?.id ?? "guest"}:${canManage}`;
  const [resolved, setResolved] = useState<{ key: string; persona: Persona } | null>(null);

  useEffect(() => {
    if (!userKey) return;
    if (!canManage) {
      setResolved({ key: userKey, persona: "shop" });
      return;
    }
    AsyncStorage.getItem(PERSONA_KEY).then((saved) => {
      setResolved({ key: userKey, persona: saved === "shop" ? "shop" : "manage" });
    });
  }, [userKey, canManage]);

  const isReady = !!userKey && resolved?.key === userKey;
  const persona: Persona = isReady && resolved ? resolved.persona : "shop";

  const switchPersona = useCallback((next: Persona) => {
    if (!userKey) return;
    setResolved({ key: userKey, persona: next });
    AsyncStorage.setItem(PERSONA_KEY, next);
    router.replace(homeFor(user?.role, next));
  }, [userKey, user?.role]);

  const home = homeFor(user?.role, persona);

  return (
    <PersonaContext.Provider value={{ persona, canManage, isReady, home, switchPersona }}>
      {children}
    </PersonaContext.Provider>
  );
}

export function usePersona() {
  const context = useContext(PersonaContext);
  if (!context) throw new Error("usePersona must be used within a PersonaProvider");
  return context;
}
