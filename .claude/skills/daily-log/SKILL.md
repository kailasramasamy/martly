---
name: daily-log
description: Generate a daily summary of work accomplished and save it to the Obsidian vault
---

Generate a daily work summary and save it to the Obsidian vault.

## Steps

1. **Scan the conversation** — review the full conversation history including tool calls (Edit, Write, Bash, Read), task lists, and user requests. Identify all completed work items.

2. **Group completed work by feature/area** — e.g., "AI Ordering", "Bug Fixes", "Database", "Docs". Each item should be a concise description of what was done.

3. **List files changed** — extract file paths from Write and Edit tool calls in the session. Annotate each with `(new)` for created files or `(modified)` for edited files.

4. **Add notes** — include any key decisions, blockers, architectural choices, or context worth remembering from the session.

5. **Determine the output path**:
   - Directory: `/Users/vaidehi/Dropbox/Documents/Obsidian Vault/Martly/Daily Log/`
   - File: `YYYY-MM-DD.md` (today's date)
   - Create the `Daily Log/` directory if it doesn't exist (use `mkdir -p`)

6. **Handle multiple sessions per day**:
   - If the file does NOT exist, write it fresh using the template below
   - If the file ALREADY exists, read it, then append a `---` horizontal rule followed by a `## Session N` heading (determine N by counting existing Session headers + 1, or 2 if there are no Session headers yet). The appended section uses the same structure but without the top-level `# Daily Log` heading.

7. **Write the file** using the Write tool (for new files) or Edit tool (for appending to existing files).

## Output Template (new file)

```markdown
# Daily Log — {Month Day, Year}

## Completed
- [x] {Description of completed task 1}
- [x] {Description of completed task 2}

## Files Changed
- `{path/to/file}` — ({new|modified}) {brief description}

## Notes
- {Key decision, blocker, or context}
```

## Output Template (appending to existing file)

```markdown

---

## Session {N}

### Completed
- [x] {Description of completed task 1}

### Files Changed
- `{path/to/file}` — ({new|modified}) {brief description}

### Notes
- {Key decision or context}
```

## Rules

- Use Obsidian-compatible Markdown (checkboxes with `- [x]` and `- [ ]`)
- Keep descriptions concise — one line per item
- Do NOT add "Upcoming" or "Next" sections — open items are tracked separately in the AI Tracker
- If no notes are worth recording, omit the Notes section
- If no files were changed, omit the Files Changed section
- Always confirm to the user what was written and the file path
