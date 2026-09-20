# TaskFlow

A fast, modern to-do app built with plain HTML, CSS and JavaScript. No frameworks, no build step, no dependencies. Your tasks are saved in your browser, so they're still there when you come back.

## LiveDemo: https://ttahsin124-wq.github.io/TODO-TASK/

## Features

**Task management**
- Add tasks with a **priority** (Low / Medium / High), an optional **due date** and an optional **category**
- **Inline editing**: double-click a task (or press ✎), then Enter to save or Esc to cancel
- **Complete, delete and clear** tasks, with an **Undo** toast instead of confirmation popups
- **Drag & drop** to reorder tasks (in "My order" sort)

**Organisation**
- **Filters**: All / Active / Completed
- **Category chips**: colour-coded, with counts, generated from your tasks
- **Search**: matches task text and categories, with highlighted results
- **Sorting**: my order, newest, due date, priority, or A → Z (finished tasks always sink to the bottom)
- **Due date status**: "Due today", "Due tomorrow", "Overdue by 2 days"

**Insights and polish**
- Live stats for total, active and completed tasks
- **Progress bar** showing overall completion
- **Light and dark theme**, remembered between visits
- **Export / Import** your tasks as a JSON backup
- **Keyboard shortcuts** and a responsive layout for phones and desktops

## Getting started

1. Put these files in the same folder:
   ```
   index.html
   style.css
   script.js
   ```
2. Open `index.html` in any modern browser.

That's it. If you prefer a local server (optional):

```bash
# Python
python3 -m http.server 8000

# or Node
npx serve
```

Then visit `http://localhost:8000`.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `/` | Focus the search box |
| `N` | Focus the new task input |
| `Enter` | Add task (in the form) / save edit (while editing) |
| `Esc` | Clear search, cancel an edit, or leave the current field |
| `Ctrl` / `Cmd` + `Z` | Undo the last delete, clear or import |

## How to use

| I want to... | Do this |
| --- | --- |
| Add a task | Type it, optionally set priority, due date and category, then press **Add Task** |
| Edit a task | Double-click the text or press **✎** |
| Reorder tasks | Set sort to **My order (drag)**, then drag the **⋮⋮** handle |
| Filter by category | Click a category chip under the filters |
| Back up my tasks | Click the download icon in the header |
| Restore tasks | Click the upload icon and choose a backup `.json` file |
| Switch theme | Click the moon or sun icon in the header |

Importing **merges** with your current tasks and skips duplicates. You can undo an import right after.

## Project structure

```
.
├── index.html   # Page structure and markup
├── style.css    # Styling, light/dark theme tokens, responsive rules
└── script.js    # App logic: state, rendering, events, storage
```

### How the code is organised (`script.js`)

| Section | Purpose |
| --- | --- |
| Constants + elements | DOM references and shared constants |
| Helpers | Safe element creation, date maths, category colours |
| State | Loading, migrating and saving tasks and settings |
| Toasts + undo | Notifications and snapshot-based undo |
| Filter / sort pipeline | Turns the task list into what's shown on screen |
| Render | Builds the list, category chips, stats and progress |
| Add / edit / delete | Task actions |
| Drag & drop | Reordering logic |
| Theme, export/import | Settings and backups |
| Keyboard shortcuts | Global key handling |

## Data and privacy

- Everything is stored in your browser's `localStorage` under the keys `taskflowTodos` and `taskflowSettings`.
- Nothing is sent to a server.
- Clearing your browser data removes your tasks, so use **Export** for backups.
- Tasks are different in each browser or device, because there is no account or sync.

### Task data format

```json
{
  "id": 1726800000000123,
  "text": "Write project report",
  "completed": false,
  "date": "Sep 20, 2026",
  "createdAt": 1726800000000,
  "priority": "high",
  "due": "2026-09-25",
  "category": "Work"
}
```

Tasks saved by the original version of the app (without priority, due date or category) are upgraded automatically on load.

## Browser support

Works in current versions of Chrome, Edge, Firefox and Safari.

Drag & drop reordering uses the HTML5 drag-and-drop API, which is not supported by most mobile browsers. On a phone, use the sort menu instead.

## Customising

- **Colours and theme:** edit the CSS variables at the top of `style.css` (`:root` for dark, `:root[data-theme="light"]` for light).
- **Priorities:** change `PRIORITIES` and `PRIORITY_RANK` in `script.js`, and the matching `<option>` values and `.priority-*` styles.
- **Text length limit:** change `maxlength="100"` in `index.html` and the `.slice(0, 100)` in `normalizeTodo` in `script.js`.
- **Undo duration:** change the `duration` value in `withUndo` (in milliseconds).

## Ideas for future improvements

- Subtasks and checklists
- Recurring tasks
- Browser notifications for due dates
- Touch-friendly reordering with up/down buttons
- Optional cloud sync

## License

Free to use, modify and share for personal or commercial projects. Add a license of your choice (for example MIT) if you plan to publish it.
