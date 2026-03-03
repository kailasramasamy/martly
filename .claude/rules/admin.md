---
globs: apps/admin/**
---

# Admin Panel Conventions (React 19 + Refine + Ant Design 5)

## Data Fetching

- **Refine hooks** for CRUD: `useTable`, `useForm`, `useShow`, `useList`, `useDelete`
- **axiosInstance** for custom pages: `import { axiosInstance } from "../../providers/data-provider"` — API wraps responses in `{ success, data }`
- Auth token auto-attached from `localStorage` key `martly_admin_token`

## Key Patterns

- Resources registered in `App.tsx` with route paths + sidebar metadata (`parent` for groups)
- Access control in `providers/access-control.ts` — permission checks per resource/role
- Status tags use configs from `constants/tag-colors.ts`: `ORDER_STATUS_CONFIG[status]` → `{ color, label }`
- Theme: teal brand (`#0d9488`), dark mode via `localStorage` key `martly_theme`
- Sidebar groups: Inventory, Marketing, Delivery
- Reference existing pages in `src/pages/*/` for patterns
