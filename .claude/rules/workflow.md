---
globs: "**"
---

# Workflow & Autonomy Rules

## Work Autonomously (No Approval Needed)

- File changes, creation, new directories
- Seeding data to the database (use square images from Unsplash for seed data)
- Running curl commands, scripts, seed files, any bash commands
- Any small implementation decisions
- When prompted "Do you want to proceed?" — always choose **Yes**
- When warned about newlines in commands — always proceed

## Requires User Approval

- Plan approval (via plan mode) before starting a feature
- Critical decisions: flow changes, architectural choices, which approach to take

## After Implementing a Feature

1. **Seed test data** so the feature is immediately testable
2. **Test thoroughly** — API endpoints via curl, verify data, check for errors
3. **Create docs** for big features in `docs/` with:
   - How the feature works (flow)
   - What was tested
   - What needs manual verification

## Screen Registration Checklist (Mobile)

Every new mobile screen needs:
1. Create the screen file in `apps/mobile/app/`
2. Add `<Stack.Screen name="screen" options={{ headerShown: true, title: "Title" }} />` in `_layout.tsx`
3. Without step 2, the screen will have no header and content overlaps the status bar

## Skill Preferences

- Use `frontend-design` skill for all mobile screens (not `new-mobile-screen`)
