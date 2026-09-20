"use strict";

/* =========================================================
   TASKFLOW
   Features: priorities, due dates, categories, inline edit,
   drag & drop ordering, sorting, search highlight, undo,
   progress bar, light/dark theme, JSON export/import,
   keyboard shortcuts, toasts.
========================================================= */


/* =========================================================
   CONSTANTS + ELEMENTS
========================================================= */

const STORAGE_KEY = "taskflowTodos";
const SETTINGS_KEY = "taskflowSettings";
const PRIORITIES = ["low", "medium", "high"];
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

const $ = (id) => document.getElementById(id);

const addForm = $("addForm");
const todoInput = $("todoInput");
const prioritySelect = $("prioritySelect");
const dueInput = $("dueInput");    
const categoryInput = $("categoryInput");
const categoryList = $("categoryList");

const todoList = $("todoList");
const searchInput = $("searchInput");
const sortSelect = $("sortSelect");
const categoryFilters = $("categoryFilters");

const clearCompletedBtn = $("clearCompletedBtn");
const clearAllBtn = $("clearAllBtn");

const emptyState = $("emptyState");
const emptyTitle = $("emptyTitle");
const emptyText = $("emptyText");
const taskMessage = $("taskMessage");

const totalCount = $("totalCount");
const activeCount = $("activeCount");
const completedCount = $("completedCount");

const progressFill = $("progressFill");
const progressLabel = $("progressLabel");
const progressTrack = $("progressTrack");

const themeBtn = $("themeBtn");
const exportBtn = $("exportBtn");
const importBtn = $("importBtn");
const importFile = $("importFile");
const toastContainer = $("toastContainer");

const filterButtons = document.querySelectorAll(".filter");


/* =========================================================
   SMALL HELPERS
========================================================= */

// Create an element safely (textContent only - no XSS)
function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function safeParse(json, fallback) {
    try {
        const value = JSON.parse(json);
        return value ?? fallback;
    } catch {
        return fallback;
    }
}

function uid() {
    return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

function toISO(date) {
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${m}-${d}`;
}

function formatDate(date) {
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
}

function formatShort(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric"
    });
}

// Whole days from today until the due date (negative = overdue)
function daysUntil(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    const due = new Date(y, m - 1, d);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((due - today) / 86400000);
}

function plural(n, word) {
    return `${n} ${word}${n === 1 ? "" : "s"}`;
}

// Stable color per category name
function categoryHue(name) {
    let hash = 0;
    for (const ch of name.toLowerCase()) {
        hash = (hash * 31 + ch.charCodeAt(0)) % 360;
    }
    return hash;
}


/* =========================================================
   STATE
========================================================= */

// Makes old saved tasks (and imported ones) compatible with new fields
function normalizeTodo(t) {
    if (!t || typeof t.text !== "string") return null; // reject empty task

    const text = t.text.trim().slice(0, 100); // if  characters are more than 100 then it slice it
    if (!text) return null; // if tasks null then it returns 0

    const created = Number(t.createdAt) || (typeof t.id === "number" ? t.id : Date.now()); // taking creation time of task

    return {
        id: t.id ?? uid(),
        text,
        completed: Boolean(t.completed),
        date: typeof t.date === "string" && t.date ? t.date : formatDate(new Date(created)), // this is basically standard structure of my task
        createdAt: created,
        priority: PRIORITIES.includes(t.priority) ? t.priority : "medium",
        due: /^\d{4}-\d{2}-\d{2}$/.test(t.due || "") ? t.due : "",
        category: typeof t.category === "string" ? t.category.trim().slice(0, 20) : ""
    };
}

function loadTodos() {
    const raw = safeParse(localStorage.getItem(STORAGE_KEY), []); // get task from browser storage 
    return Array.isArray(raw) ? raw.map(normalizeTodo).filter(Boolean) : [];
}

let todos = loadTodos(); // all of the loaded tasks will pass to todos array

const settings = Object.assign(
    { theme: "dark", sort: "manual" }, // when i will open it first time ,the app will appear on dark mode
    safeParse(localStorage.getItem(SETTINGS_KEY), {})
);

let currentFilter = "all";
let currentCategory = "all";
let searchText = "";
let dragId = null;
let lastUndo = null;

function saveTodos() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(todos)); // as localstorage wants string 
    } catch {
        showToast("Could not save - browser storage is full or blocked.");
    }
}

function saveSettings() {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch { /* ignore */ }
}


/* =========================================================
   TOASTS + UNDO
========================================================= */

function showToast(message, options = {}) {
    const { actionLabel, onAction, duration = 5000 } = options;

    // Keep at most 3 toasts on screen
    while (toastContainer.children.length >= 3) {
        toastContainer.firstElementChild.remove();
    }

    const toast = el("div", "toast");
    toast.appendChild(el("span", "", message));

    const remove = () => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 250);
    };

    if (actionLabel && onAction) {
        const btn = el("button", "", actionLabel);
        btn.type = "button";
        btn.addEventListener("click", () => {
            onAction();
            remove();
        });
        toast.appendChild(btn);
    }

    toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show")); //  start css transition 
    setTimeout(remove, duration);
}

// Run a destructive change, then offer to undo it
function withUndo(message, change) {
    const snapshot = JSON.stringify(todos);

    change();
    saveTodos();
    render();

    const undo = () => {
        todos = safeParse(snapshot, []).map(normalizeTodo).filter(Boolean);
        saveTodos();
        render();
        showToast("Restored");
        lastUndo = null;
    };

    lastUndo = undo;

    showToast(message, {
        actionLabel: "Undo",
        onAction: undo,
        duration: 6000
    });
}


/* =========================================================
   FILTER / SORT PIPELINE
========================================================= */

function getVisibleTodos() {
    let list = todos.slice();

    if (currentFilter === "active") list = list.filter((t) => !t.completed);
    if (currentFilter === "completed") list = list.filter((t) => t.completed); // incompleted task will shown in ui

    if (currentCategory !== "all") {
        list = list.filter((t) => t.category === currentCategory);
    }

    if (searchText) {
        const q = searchText.toLowerCase();
        list = list.filter(
            (t) =>
                t.text.toLowerCase().includes(q) ||
                t.category.toLowerCase().includes(q)
        );
    }

    if (settings.sort !== "manual") {
        list.sort((a, b) => {
            // Finished tasks always sink to the bottom
            if (a.completed !== b.completed) return a.completed ? 1 : -1;

            switch (settings.sort) {
                case "newest":
                    return b.createdAt - a.createdAt;
                case "priority":
                    return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
                case "due":
                    if (!a.due && !b.due) return 0;
                    if (!a.due) return 1;
                    if (!b.due) return -1;
                    return a.due.localeCompare(b.due);
                case "az":
                    return a.text.localeCompare(b.text, undefined, { sensitivity: "base" });
                default:
                    return 0;
            }
        });
    }

    return list;
}


/* =========================================================
   RENDER
========================================================= */

// Puts text in a node and wraps search matches in <mark>
function setHighlightedText(node, text, query) {
    if (!query) {
        node.textContent = text;
        return;
    }

    const lower = text.toLowerCase();
    const q = query.toLowerCase();
    let i = 0;
    let idx;

    while ((idx = lower.indexOf(q, i)) !== -1) {
        if (idx > i) node.append(text.slice(i, idx));
        node.appendChild(el("mark", "", text.slice(idx, idx + q.length)));
        i = idx + q.length;
    }

    if (i < text.length) node.append(text.slice(i));
}

function getDueInfo(todo) {
    if (!todo.due) return null;

    const days = daysUntil(todo.due);

    if (todo.completed) {
        return { label: `Due ${formatShort(todo.due)}`, cls: "" };
    }
    if (days < 0) {
        return { label: `Overdue by ${plural(-days, "day")}`, cls: "due-overdue" };
    }
    if (days === 0) return { label: "Due today", cls: "due-today" };
    if (days === 1) return { label: "Due tomorrow", cls: "due-soon" };
    if (days <= 3) return { label: `Due in ${days} days`, cls: "due-soon" };

    return { label: `Due ${formatShort(todo.due)}`, cls: "" };
}

function createTodoElement(todo) {
    const li = el("li", "todo-item");
    li.dataset.id = todo.id;
    li.dataset.priority = todo.priority;
    if (todo.completed) li.classList.add("completed");

    // Drag handle (visible only in "My order" sort)
    const handle = el("span", "drag-handle", "⋮⋮");
    handle.setAttribute("aria-hidden", "true");

    // Checkbox
    const checkbox = el("input", "todo-checkbox");
    checkbox.type = "checkbox";
    checkbox.checked = todo.completed;
    checkbox.setAttribute("aria-label", `Mark "${todo.text}" as done`);
    checkbox.addEventListener("change", () => {
        todo.completed = checkbox.checked;
        saveTodos();
        render();

        if (todo.completed && todos.length > 0 && todos.every((t) => t.completed)) {
            showToast("All tasks done. Nice work! 🎉");
        }
    });

    // Body
    const body = el("div", "todo-body");

    const text = el("span", "todo-text");
    setHighlightedText(text, todo.text, searchText);
    text.title = "Double-click to edit";
    text.addEventListener("dblclick", () => startEdit(todo, text, li));

    const meta = el("div", "todo-meta");

    const priorityLabel = todo.priority[0].toUpperCase() + todo.priority.slice(1);
    meta.appendChild(el("span", `badge priority-${todo.priority}`, priorityLabel));

    const due = getDueInfo(todo);
    if (due) meta.appendChild(el("span", `badge ${due.cls}`.trim(), due.label));

    if (todo.category) {
        const cat = el("span", "badge category");
        cat.style.setProperty("--h", categoryHue(todo.category));
        setHighlightedText(cat, todo.category, searchText);
        meta.appendChild(cat);
    }

    meta.appendChild(el("span", "todo-date", `Added ${todo.date}`));

    body.appendChild(text);
    body.appendChild(meta);

    // Actions
    const actions = el("div", "task-actions");

    const editButton = el("button", "edit-btn", "✎");
    editButton.type = "button";
    editButton.title = "Edit task";
    editButton.setAttribute("aria-label", "Edit task");
    editButton.addEventListener("click", () => startEdit(todo, text, li));

    const deleteButton = el("button", "delete-btn", "×");
    deleteButton.type = "button";
    deleteButton.title = "Delete task";
    deleteButton.setAttribute("aria-label", "Delete task");
    deleteButton.addEventListener("click", () => deleteTodo(todo.id));

    actions.append(editButton, deleteButton);

    li.append(handle, checkbox, body, actions);

    if (settings.sort === "manual") attachDragHandlers(li, todo.id);

    return li;
}

function renderCategories() {
    // Count tasks per category
    const counts = new Map();
    todos.forEach((t) => {
        if (t.category) counts.set(t.category, (counts.get(t.category) || 0) + 1);
    });

    // Autocomplete suggestions in the Add form
    categoryList.innerHTML = "";
    [...counts.keys()].sort().forEach((name) => {
        const option = document.createElement("option");
        option.value = name;
        categoryList.appendChild(option);
    });

    // A removed category can't stay selected
    if (currentCategory !== "all" && !counts.has(currentCategory)) {
        currentCategory = "all";
    }

    categoryFilters.innerHTML = "";
    categoryFilters.hidden = counts.size === 0;
    if (counts.size === 0) return;

    const makeChip = (value, label, count) => {
        const chip = el("button", "cat-filter");
        chip.type = "button";
        chip.textContent = label;
        if (count !== undefined) chip.appendChild(el("span", "count", String(count)));
        if (value !== "all") chip.style.setProperty("--h", categoryHue(value));
        if (currentCategory === value) chip.classList.add("active");
        chip.addEventListener("click", () => {
            currentCategory = value;
            render();
        });
        return chip;
    };

    categoryFilters.appendChild(makeChip("all", "All categories"));
    [...counts.keys()].sort().forEach((name) => {
        categoryFilters.appendChild(makeChip(name, name, counts.get(name)));
    });
}

function updateStats() {
    const total = todos.length;
    const completed = todos.filter((t) => t.completed).length;
    const active = total - completed;
    const overdue = todos.filter(
        (t) => !t.completed && t.due && daysUntil(t.due) < 0
    ).length;

    totalCount.textContent = total;
    activeCount.textContent = active;
    completedCount.textContent = completed;

    // Progress
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
    progressFill.style.width = `${percent}%`;
    progressLabel.textContent = `${percent}%`;
    progressTrack.setAttribute("aria-valuenow", percent);

    // Footer message
    let message;
    if (active === 0) message = "No active tasks";
    else if (active === 1) message = "1 task left";
    else message = `${active} tasks left`;

    if (overdue > 0) message += `, ${overdue} overdue`;
    taskMessage.textContent = message;

    clearCompletedBtn.disabled = completed === 0;
    clearAllBtn.disabled = total === 0;
}

function render() {
    const visible = getVisibleTodos();

    todoList.innerHTML = "";
    todoList.classList.toggle("sortable", settings.sort === "manual");

    visible.forEach((todo) => todoList.appendChild(createTodoElement(todo)));

    // Empty state
    if (visible.length === 0) {
        if (todos.length === 0) {
            emptyTitle.textContent = "No tasks yet";
            emptyText.textContent = "Add your first task above and start getting things done.";
        } else {
            emptyTitle.textContent = "No matching tasks";
            emptyText.textContent = "Try a different filter, category or search.";
        }
        emptyState.style.display = "block";
    } else {
        emptyState.style.display = "none";
    }

    renderCategories();
    updateStats();
}


/* =========================================================
   ADD / EDIT / DELETE
========================================================= */

function addTodo() {
    const text = todoInput.value.trim();

    if (text === "") {
        todoInput.classList.remove("invalid");
        void todoInput.offsetWidth; // restart animation
        todoInput.classList.add("invalid");
        todoInput.focus();
        return;
    }

    todos.unshift({
        id: uid(),
        text,
        completed: false,
        date: formatDate(new Date()),
        createdAt: Date.now(),
        priority: prioritySelect.value,
        due: dueInput.value,
        category: categoryInput.value.trim().slice(0, 20)
    });

    saveTodos();

    // Reset form
    todoInput.value = "";
    prioritySelect.value = "medium";
    dueInput.value = "";
    categoryInput.value = "";

    // Make sure the new task is visible
    searchInput.value = "";
    searchText = "";
    currentFilter = "all";
    currentCategory = "all";
    filterButtons.forEach((b) => b.classList.toggle("active", b.dataset.filter === "all"));

    render();
    todoInput.focus();
}

function startEdit(todo, textEl, li) {
    if (li.classList.contains("editing")) return;

    li.classList.add("editing");
    li.draggable = false;

    const input = el("input", "edit-input");
    input.type = "text";
    input.value = todo.text;
    input.maxLength = 100;
    input.setAttribute("aria-label", "Edit task text");

    textEl.replaceWith(input);
    input.focus();
    input.select();

    let finished = false;

    const finish = (save) => {
        if (finished) return;
        finished = true;

        if (save) {
            const value = input.value.trim();
            if (value === "") {
                showToast("A task can't be empty. Original text kept.");
            } else if (value !== todo.text) {
                todo.text = value;
                saveTodos();
            }
        }

        render();
    };

    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            finish(true);
        } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            finish(false);
        }
    });

    input.addEventListener("blur", () => finish(true));
}

function deleteTodo(id) {
    withUndo("Task deleted", () => {
        todos = todos.filter((t) => t.id !== id);
    });
}


/* =========================================================
   DRAG & DROP REORDERING
========================================================= */

function clearDropMarks() {
    todoList
        .querySelectorAll(".drop-before, .drop-after")
        .forEach((n) => n.classList.remove("drop-before", "drop-after"));
}

function attachDragHandlers(li, id) {
    li.draggable = true;

    li.addEventListener("dragstart", (e) => {
        // Don't start a drag from inside a text field
        if (e.target.closest && e.target.closest("input[type='text']")) {
            e.preventDefault();
            return;
        }
        dragId = String(id);
        li.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", dragId); // required by Firefox
    });

    li.addEventListener("dragover", (e) => {
        if (dragId === null || dragId === String(id)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";

        const rect = li.getBoundingClientRect();
        const after = e.clientY > rect.top + rect.height / 2;

        clearDropMarks();
        li.classList.add(after ? "drop-after" : "drop-before");
    });

    li.addEventListener("dragleave", (e) => {
        if (!li.contains(e.relatedTarget)) {
            li.classList.remove("drop-before", "drop-after");
        }
    });

    li.addEventListener("drop", (e) => {
        e.preventDefault();
        if (dragId === null || dragId === String(id)) return;

        const rect = li.getBoundingClientRect();
        const after = e.clientY > rect.top + rect.height / 2;

        moveTodo(dragId, String(id), after);
        dragId = null;
    });

    li.addEventListener("dragend", () => {
        dragId = null;
        li.classList.remove("dragging");
        clearDropMarks();
    });
}

function moveTodo(fromId, toId, after) {
    const from = todos.findIndex((t) => String(t.id) === fromId);
    if (from === -1) return;

    const [item] = todos.splice(from, 1);

    let to = todos.findIndex((t) => String(t.id) === toId);
    if (to === -1) {
        todos.splice(from, 0, item);
        return;
    }
    if (after) to++;

    todos.splice(to, 0, item);
    saveTodos();
    render();
}


/* =========================================================
   FILTERS, SEARCH, SORT
========================================================= */

filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
        filterButtons.forEach((b) => b.classList.remove("active"));
        button.classList.add("active");
        currentFilter = button.dataset.filter;
        render();
    });
});

searchInput.addEventListener("input", () => {
    searchText = searchInput.value.trim();
    render();
});

sortSelect.addEventListener("change", () => {
    settings.sort = sortSelect.value;
    saveSettings();
    render();
});


/* =========================================================
   CLEAR ACTIONS (with undo instead of confirm popups)
========================================================= */

clearCompletedBtn.addEventListener("click", () => {
    const count = todos.filter((t) => t.completed).length;
    if (count === 0) return;

    withUndo(`Cleared ${plural(count, "completed task")}`, () => {
        todos = todos.filter((t) => !t.completed);
    });
});

clearAllBtn.addEventListener("click", () => {
    if (todos.length === 0) return;

    withUndo(`Deleted all ${plural(todos.length, "task")}`, () => {
        todos = [];
    });
});


/* =========================================================
   THEME
========================================================= */

function applyTheme() {
    document.documentElement.setAttribute("data-theme", settings.theme);

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", settings.theme === "light" ? "#f3f2fa" : "#08090f");
}

themeBtn.addEventListener("click", () => {
    settings.theme = settings.theme === "dark" ? "light" : "dark";
    saveSettings();
    applyTheme();
});


/* =========================================================
   EXPORT / IMPORT
========================================================= */

exportBtn.addEventListener("click", () => {
    if (todos.length === 0) {
        showToast("Nothing to export yet.");
        return;
    }

    const payload = JSON.stringify(
        { app: "TaskFlow", exportedAt: new Date().toISOString(), todos },
        null,
        2
    );

    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `taskflow-backup-${toISO(new Date())}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`Exported ${plural(todos.length, "task")}`);
});

importBtn.addEventListener("click", () => importFile.click());

importFile.addEventListener("change", () => {
    const file = importFile.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
        const data = safeParse(reader.result, null);
        const list = Array.isArray(data) ? data : data && data.todos;

        if (!Array.isArray(list)) {
            showToast("That file isn't a valid TaskFlow backup.");
            return;
        }

        const existing = new Set(todos.map((t) => String(t.id)));
        const incoming = list
            .map(normalizeTodo)
            .filter((t) => t && !existing.has(String(t.id)));

        if (incoming.length === 0) {
            showToast("No new tasks to import.");
            return;
        }

        withUndo(`Imported ${plural(incoming.length, "task")}`, () => {
            todos = todos.concat(incoming);
        });
    };

    reader.onerror = () => showToast("Could not read that file.");
    reader.readAsText(file);

    importFile.value = ""; // allow re-importing the same file
});


/* =========================================================
   FORM + KEYBOARD SHORTCUTS
========================================================= */

addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    addTodo();
});

todoInput.addEventListener("input", () => todoInput.classList.remove("invalid"));

document.addEventListener("keydown", (e) => {
    const tag = document.activeElement ? document.activeElement.tagName : "";
    const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

    // Ctrl/Cmd + Z = undo last delete
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !typing) {
        if (lastUndo) {
            e.preventDefault();
            lastUndo();
        }
        return;
    }

    // Escape = clear search / leave field
    if (e.key === "Escape") {
        if (document.activeElement === searchInput && searchInput.value) {
            searchInput.value = "";
            searchText = "";
            render();
        } else if (typing) {
            document.activeElement.blur();
        }
        return;
    }

    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === "/") {
        e.preventDefault();
        searchInput.focus();
    } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        todoInput.focus();
    }
});


/* =========================================================
   REFRESH DUE LABELS AT MIDNIGHT / WHEN TAB RETURNS
========================================================= */

document.addEventListener("visibilitychange", () => {
    if (!document.hidden) render();
});


/* =========================================================
   INITIAL LOAD
========================================================= */

sortSelect.value = settings.sort;
applyTheme();
dueInput.min = toISO(new Date());
saveTodos(); // persist any migrated (old-format) tasks
render();