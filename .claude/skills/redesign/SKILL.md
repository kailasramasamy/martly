---
name: redesign
description: Redesign a screen or UI section for better UX, professional look, and industry-standard patterns
argument-hint: <app:screen-or-section> (e.g., "mobile:home", "admin:products list", "mobile:checkout header")
---

Redesign the specified screen or section for better UI/UX, a professional look, and industry-standard patterns.

**Target:** $ARGUMENTS

## Process

### 1. Identify the Target

Parse the argument to determine:
- **App**: `mobile` (React Native / Expo), `admin` (React / Ant Design), or infer from context
- **Screen/Section**: The specific screen or section within it (e.g., "home", "product card", "checkout header")

If the argument is ambiguous, ask the user to clarify which app and screen.

### 2. Read the Current Implementation

- Read the target screen file(s) and any components it imports
- Read the relevant layout file (`_layout.tsx` for mobile, `App.tsx` for admin)
- Read any shared types, styles, or constants used by the screen
- Understand the data being fetched and displayed

### 3. Research Best Practices

Before redesigning, consider industry-standard patterns for the type of screen:

**For mobile grocery/e-commerce apps** (reference: Instacart, Zepto, Blinkit, Swiggy Instamart):
- Card-based product layouts with prominent images, clear pricing, and quick-add buttons
- Sticky headers with search bar and store/location context
- Bottom sheets for filters and sorting
- Skeleton loading states instead of spinners
- Pull-to-refresh
- Visual hierarchy: hero banners, horizontal category scrollers, product grids
- Subtle shadows, rounded corners, consistent spacing (8px grid)
- Status-specific color coding (green=success, orange=pending, red=error)

**For admin dashboards** (reference: Shopify Admin, WooCommerce, modern SaaS dashboards):
- Clean data tables with proper column alignment and row hover states
- Card-based stat summaries at the top of list pages
- Consistent action button placement (top-right for primary, inline for row actions)
- Breadcrumbs for navigation context
- Empty states with illustrations/icons and call-to-action
- Proper use of whitespace and section grouping
- Filter bars with chips/tags for active filters

### 4. Design the Improvements

For the target screen/section, plan concrete improvements across these dimensions:

| Dimension | What to improve |
|-----------|----------------|
| **Layout** | Spacing, alignment, visual grouping, responsive behavior |
| **Typography** | Font sizes, weights, hierarchy (title > subtitle > body > caption) |
| **Color** | Brand consistency, contrast, semantic colors for status/actions |
| **Components** | Better component choices, consistent styling, polished details |
| **Interaction** | Loading states, empty states, error states, micro-interactions |
| **Information architecture** | What to show/hide, ordering, progressive disclosure |

### 5. Implement the Redesign

**For mobile (React Native / Expo):**
- Use `StyleSheet.create` with a consistent design system (spacing, colors, typography)
- Implement proper loading skeletons (not just a spinner)
- Use `LinearGradient` for hero sections where appropriate
- Ensure proper `SafeAreaView` usage
- Add subtle animations with `Animated` API where it enhances UX
- Use proper image aspect ratios and `resizeMode`
- Follow 8px spacing grid (4, 8, 12, 16, 20, 24, 32, 40, 48)
- Use consistent border radius (8 for cards, 12 for buttons, 20+ for pills)
- Apply platform-specific shadows (`shadowOffset`/`elevation`)
- Ensure touch targets are at least 44x44px
- Use `FlatList`/`SectionList` for performance over `ScrollView` with maps

**For admin (React / Ant Design):**
- Use Ant Design's component library effectively (no reinventing existing components)
- Apply the teal/emerald brand theme (`#0d9488`)
- Use `Card`, `Statistic`, `Descriptions`, `Tag`, `Badge` components for data display
- Add `Breadcrumb` for navigation context
- Use proper `Space` and `Row`/`Col` for layout
- Use `Segmented` or `Tabs` for view switching
- Add `Empty` states with custom descriptions
- Use `Skeleton` for loading states

### 6. Verify the Result

- Ensure no functionality was broken (all data fetching, navigation, and interactions still work)
- Verify the styling is consistent with the rest of the app
- Check that all states are handled (loading, empty, error, populated)

## Key Design Tokens

### Mobile
```
Colors:
  primary: #0d9488 (teal-600)
  primaryLight: #ccfbf1 (teal-100)
  background: #f8fafc (slate-50)
  surface: #ffffff
  text: #0f172a (slate-900)
  textSecondary: #64748b (slate-500)
  textTertiary: #94a3b8 (slate-400)
  border: #e2e8f0 (slate-200)
  success: #16a34a
  warning: #f59e0b
  error: #ef4444

Spacing: 4, 8, 12, 16, 20, 24, 32, 40, 48
Border Radius: 6 (small), 8 (medium), 12 (large), 20 (pill)
Font Sizes: 11 (caption), 13 (small), 15 (body), 17 (subtitle), 20 (title), 24 (heading), 28 (hero)
Font Weights: '400' (normal), '500' (medium), '600' (semibold), '700' (bold)
```

### Admin
```
Brand: #0d9488 (teal-600) - already set as Ant Design theme token
Use Ant Design's built-in token system for spacing, radius, and colors
```

## Reference Files

| App | Key Files |
|-----|-----------|
| Mobile screens | `apps/mobile/app/(tabs)/*.tsx`, `apps/mobile/app/*.tsx` |
| Mobile components | `apps/mobile/components/*.tsx` |
| Mobile types | `apps/mobile/lib/types.ts` |
| Mobile layout | `apps/mobile/app/_layout.tsx`, `apps/mobile/app/(tabs)/_layout.tsx` |
| Admin pages | `apps/admin/src/pages/*/` |
| Admin app | `apps/admin/src/App.tsx` |
| Admin styles | `apps/admin/src/overrides.css` |
