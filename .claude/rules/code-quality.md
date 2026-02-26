---
globs: "**"
---

# Code Quality Standards

## Production-Ready Code

- Every fix must be production-ready. No workarounds, hacks, or temporary patches.
- If a problem requires API changes, schema changes, or restructuring across apps — do that. Don't paper over issues on the client when the proper fix belongs on the server (or vice versa).
- Free to change APIs, admin, and mobile app as needed. Cross-cutting changes are expected and preferred over fragile single-layer workarounds.

## Multi-Tenancy Safety

- Every query involving org-scoped data MUST filter by `organizationId`
- SUPER_ADMIN bypasses org filter; all other roles must be scoped
- Always use org-scope middleware helpers, never raw `request.user`

## Shared Package

- Zod validation schemas live in `packages/shared/src/schemas/index.ts`
- Constants and enums live in `packages/shared/src/constants/index.ts`
- Response types (`ApiResponse<T>`, `PaginatedResponse<T>`) in `packages/shared/src/types/index.ts`
- When adding new enums or types, add to shared package so all apps can use them

## Currency

- Display currency is INR (₹)
- Use `\u20B9` for rupee symbol in code
- Format: `₹1,234` (no decimals for display unless needed)

## Patterns to Avoid

- Don't add features, refactor code, or make "improvements" beyond what was asked
- Don't add error handling for scenarios that can't happen
- Don't create helpers or abstractions for one-time operations
- Don't add docstrings, comments, or type annotations to code you didn't change
- No backwards-compatibility hacks (unused vars, re-exports, removal comments)
