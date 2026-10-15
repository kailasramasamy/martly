import { useState } from "react";
import { StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { can } from "@martly/shared/permissions";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { useAction } from "../../../lib/manage/use-action";
import { useToast } from "../../../lib/toast-context";
import { ManageStackScreen } from "../ManageStackScreen";
import { SectionCard } from "../ui/SectionCard";
import { Button } from "../ui/Button";
import { DeleteAction } from "../delivery-config/DeleteAction";
import { ALL_ROLES, ORG_ADMIN_ASSIGNABLE_ROLES } from "./constants";
import { saveUser } from "./user-stores";
import { UserFields, type UserDraft } from "./UserFields";
import type { UserDetail } from "./types";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function problem(d: UserDraft, creating: boolean, isSuper: boolean): string | null {
  if (!d.name.trim()) return "Name is required";
  if (!EMAIL.test(d.email.trim())) return "Enter a valid email";
  if (!d.role) return "Choose a role";
  if (!isSuper && d.storeIds.length === 0) return "Assign at least one store; users without a store are hidden from your team list";
  if ((creating || d.password) && d.password.length < 8) return "Password must be at least 8 characters";
  return null;
}

export function UserForm({ user }: { user?: UserDetail }) {
  const router = useRouter();
  const toast = useToast();
  const { user: me } = useAuth();
  const { run, running } = useAction();
  const isSuper = me?.role === "SUPER_ADMIN";
  const creating = !user;
  const [draft, setDraft] = useState<UserDraft>({
    name: user?.name ?? "", email: user?.email ?? "", phone: user?.phone ?? "", password: "",
    role: user?.role ?? "", storeIds: user?.userStores.map((us) => us.store.id) ?? [],
  });
  const roles = [...new Set([...(user ? [user.role] : []), ...(isSuper ? ALL_ROLES : ORG_ADMIN_ASSIGNABLE_ROLES)])];

  const save = async () => {
    const invalid = problem(draft, creating, isSuper);
    if (invalid) return toast.show(invalid, "error");
    const result = await run(() => saveUser(user, { ...draft, isSuper }), creating ? "User created" : "User updated");
    if (!result) return;
    if (result.failed > 0) toast.show(`${result.failed} store change(s) failed. Check the assignments and retry.`, "error");
    if (creating && result.failed > 0) router.replace(`/manage/users/${result.id}`);
    else router.back();
  };

  const remove = async () => {
    if (!user) return;
    const done = await run(() => api.delete(`/api/v1/users/${user.id}`), "User deleted");
    if (done) router.back();
  };

  return (
    <ManageStackScreen
      title={user?.name ?? "New team member"}
      actions={<Button label={creating ? "Create user" : "Save changes"} onPress={save} loading={running} style={styles.flex} />}
    >
      <UserFields draft={draft} set={(patch) => setDraft((d) => ({ ...d, ...patch }))} roles={roles} creating={creating} isSuper={isSuper} />
      {user && can(me?.role ?? "", "users", "delete") && user.id !== me?.id && (
        <SectionCard title="Danger zone">
          <DeleteAction title="Delete this user?" message="This permanently removes the user along with their orders, reviews and store assignments." loading={running} onConfirm={remove} />
        </SectionCard>
      )}
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
