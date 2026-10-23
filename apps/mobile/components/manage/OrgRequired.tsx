import { ManageStackScreen } from "./ManageStackScreen";
import { EmptyState } from "./ui/EmptyState";

/**
 * Shown instead of a screen that works on one organisation while a super admin is looking at "All stores": picking a
 * store in the switcher sets its organisation.
 */
export function OrgRequired({ title, what }: { title: string; what: string }) {
  return (
    <ManageStackScreen title={title}>
      <EmptyState icon="storefront-outline" title="Pick a store" message={`Choose a store from the switcher on a tab to ${what} for its organization.`} />
    </ManageStackScreen>
  );
}
