import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, type Href } from "expo-router";
import { canManage as memberCanManage } from "@martly/shared/permissions";
import { useAuth, type UserInfo } from "./auth-context";

export type Persona = "manage" | "shop";

// Saved per account, so one member's switch to shopping doesn't carry over to the next person who signs in
const personaKey = (userId: string) => `martly_persona:${userId}`;

interface PersonaState {
  persona: Persona;
  canManage: boolean;
  isReady: boolean;
  /** Route the signed-in user should land on for the current persona */
  home: Href;
  switchPersona: (next: Persona) => void;
}

const PersonaContext = createContext<PersonaState | null>(null);

/** Staff with nothing they can manage have no app home; shoppers and guests shop */
function homeFor(user: UserInfo | null, canManage: boolean, persona: Persona): Href {
  if (user && user.role !== "CUSTOMER" && !canManage) return "/unsupported-role";
  return persona === "manage" ? "/(manage)" : "/(tabs)";
}

export function PersonaProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const canManage = memberCanManage(user);
  // Persona is resolved per signed-in user; until it matches the current user it isn't ready
  const userKey = isLoading ? null : `${user?.id ?? "guest"}:${canManage}`;
  const [resolved, setResolved] = useState<{ key: string; persona: Persona } | null>(null);

  useEffect(() => {
    if (!userKey) return;
    if (!canManage) {
      setResolved({ key: userKey, persona: "shop" });
      return;
    }
    AsyncStorage.getItem(personaKey(user!.id)).then((saved) => {
      setResolved({ key: userKey, persona: saved === "shop" ? "shop" : "manage" });
    });
  }, [userKey, canManage, user]);

  const isReady = !!userKey && resolved?.key === userKey;
  const persona: Persona = isReady && resolved ? resolved.persona : "shop";

  const switchPersona = useCallback((next: Persona) => {
    if (!userKey) return;
    setResolved({ key: userKey, persona: next });
    if (user) AsyncStorage.setItem(personaKey(user.id), next);
    router.replace(homeFor(user, canManage, next));
  }, [userKey, user, canManage]);

  const home = homeFor(user, canManage, persona);

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
