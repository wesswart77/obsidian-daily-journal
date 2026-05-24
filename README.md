# Daily Journal

A daily journaling system with mood tracking, habit logging, streak counters, and reflection prompts.

## Features

- **Open today's entry** — creates a daily note with pre-filled prompts and habit checkboxes
- **Mood tracker** — 1-5 scale with emoji (😞😕😐🙂😄)
- **Habit checkboxes** — configurable list; tick off directly in the note
- **Daily reflection prompts** — 3 rotating prompts (gratitude, challenge, intention)
- **Streak tracking** — counts consecutive days with journal entries
- **Sidebar view** — shows this week's entries with mood emoji and habit completion %, plus recent entry list
- **Quick entry modal** — set mood and tick habits without opening the full note

## Commands

| Command | Description |
|---|---|
| Open Daily Journal sidebar | Toggle the sidebar view |
| Open today's journal entry | Create/open today's note |
| Quick journal entry (mood + habits) | Modal to log mood and habits quickly |

## Note Format

Each daily note is named `YYYY-MM-DD.md` and contains:

```markdown
# Journal — 2026-05-24

**Mood**: 4 🙂 — Good

## Morning Intention
...

## Habits
- [x] Exercise
- [ ] Read
...

## Reflection
> What are three things you are grateful for today?
...

## Notes
```

## Settings

- **Journal folder** — vault path for all entries (default: `Journal`)
- **Habits** — comma-separated habit names (default: `Exercise,Read,Meditate,No sugar,8h sleep`)
