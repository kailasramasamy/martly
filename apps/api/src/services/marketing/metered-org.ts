/** Whose AI images a request spends: the organisation's, except when Martly's own team asks, which is never charged */
export function meteredOrg(user: { role: string }, organizationId: string | null) {
  return user.role === "SUPER_ADMIN" ? null : organizationId;
}
