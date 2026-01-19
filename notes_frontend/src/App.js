import React, { useEffect, useMemo, useState } from "react";
import "./App.css";

/**
 * Notes app main component.
 * - Shows a list of notes in card layout
 * - Allows adding/editing via a modal dialog
 * - Allows deleting notes
 * - Persists via API when available, else falls back to localStorage
 */

// PUBLIC_INTERFACE
function App() {
  const apiBase = useMemo(() => {
    // Prefer REACT_APP_API_BASE, fallback to REACT_APP_BACKEND_URL.
    // Do not hardcode URLs; keep env-driven.
    const base =
      process.env.REACT_APP_API_BASE ||
      process.env.REACT_APP_BACKEND_URL ||
      "";
    return (base || "").replace(/\/$/, "");
  }, []);

  const [notes, setNotes] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: "" });

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ title: "", content: "" });

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Load notes on first render
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus({ loading: true, error: "" });
      try {
        const loaded = await loadNotes({ apiBase });
        if (!cancelled) {
          setNotes(loaded);
          setStatus({ loading: false, error: "" });
        }
      } catch (e) {
        if (!cancelled) {
          setNotes([]);
          setStatus({
            loading: false,
            error:
              e instanceof Error ? e.message : "Failed to load notes.",
          });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  function openNewNote() {
    setEditingId(null);
    setDraft({ title: "", content: "" });
    setIsEditorOpen(true);
  }

  function openEdit(note) {
    setEditingId(note.id);
    setDraft({ title: note.title ?? "", content: note.content ?? "" });
    setIsEditorOpen(true);
  }

  function closeEditor() {
    setIsEditorOpen(false);
    setEditingId(null);
    setDraft({ title: "", content: "" });
  }

  function validateDraft(nextDraft) {
    const title = (nextDraft.title || "").trim();
    const content = (nextDraft.content || "").trim();
    if (!title && !content) {
      return "Please add a title or some content.";
    }
    if (title.length > 120) {
      return "Title is too long (max 120 characters).";
    }
    return "";
  }

  async function handleSave(e) {
    e.preventDefault();
    const validationError = validateDraft(draft);
    if (validationError) {
      setStatus((s) => ({ ...s, error: validationError }));
      return;
    }

    setStatus({ loading: true, error: "" });

    try {
      if (editingId) {
        const updated = await updateNote({
          apiBase,
          id: editingId,
          patch: { title: draft.title, content: draft.content },
        });
        setNotes((prev) =>
          prev.map((n) => (n.id === updated.id ? updated : n))
        );
      } else {
        const created = await createNote({
          apiBase,
          note: { title: draft.title, content: draft.content },
        });
        setNotes((prev) => [created, ...prev]);
      }
      setStatus({ loading: false, error: "" });
      closeEditor();
    } catch (e2) {
      setStatus({
        loading: false,
        error:
          e2 instanceof Error ? e2.message : "Failed to save note.",
      });
    }
  }

  async function handleDeleteConfirmed(id) {
    setStatus({ loading: true, error: "" });
    try {
      await deleteNote({ apiBase, id });
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setStatus({ loading: false, error: "" });
      setConfirmDeleteId(null);
    } catch (e) {
      setStatus({
        loading: false,
        error:
          e instanceof Error ? e.message : "Failed to delete note.",
      });
    }
  }

  const selectedForDelete =
    confirmDeleteId ? notes.find((n) => n.id === confirmDeleteId) : null;

  return (
    <div className="NotesApp">
      <header className="TopBar">
        <div className="TopBar-left">
          <div className="BrandMark" aria-hidden="true" />
          <div>
            <h1 className="TopBar-title">Notes</h1>
            <p className="TopBar-subtitle">
              Add, edit, and delete simple notes.
            </p>
          </div>
        </div>

        <div className="TopBar-actions">
          <button className="btn btn-primary" onClick={openNewNote}>
            New note
          </button>
        </div>
      </header>

      <main className="Main">
        {status.error ? (
          <div className="Alert" role="alert">
            <div className="Alert-title">Something went wrong</div>
            <div className="Alert-body">{status.error}</div>
          </div>
        ) : null}

        <div className="MainHeaderRow">
          <div className="MetaPill" title="Storage mode">
            <span className="MetaPill-dot" aria-hidden="true" />
            <span className="MetaPill-text">
              {apiBase ? "API-first (fallback to local)" : "Local storage"}
            </span>
          </div>

          <div className="CountText" aria-live="polite">
            {notes.length} note{notes.length === 1 ? "" : "s"}
          </div>
        </div>

        {status.loading ? (
          <div className="SkeletonGrid" aria-label="Loading notes">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="SkeletonCard" />
            ))}
          </div>
        ) : notes.length === 0 ? (
          <div className="EmptyState">
            <h2 className="EmptyState-title">No notes yet</h2>
            <p className="EmptyState-body">
              Create your first note to get started.
            </p>
            <button className="btn btn-primary" onClick={openNewNote}>
              Create a note
            </button>
          </div>
        ) : (
          <section className="Grid" aria-label="Notes list">
            {notes.map((note) => (
              <article key={note.id} className="NoteCard">
                <div className="NoteCard-header">
                  <h3 className="NoteCard-title">
                    {note.title?.trim() ? note.title : "Untitled"}
                  </h3>
                  <div className="NoteCard-actions">
                    <button
                      className="btn btn-ghost"
                      onClick={() => openEdit(note)}
                      aria-label={`Edit note ${note.title || ""}`.trim()}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-dangerGhost"
                      onClick={() => setConfirmDeleteId(note.id)}
                      aria-label={`Delete note ${note.title || ""}`.trim()}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <p className="NoteCard-content">
                  {note.content?.trim()
                    ? note.content
                    : "No content. Click edit to add details."}
                </p>

                <div className="NoteCard-footer">
                  <span className="NoteCard-date" title="Last updated">
                    Updated {formatRelativeDate(note.updatedAt)}
                  </span>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>

      {isEditorOpen ? (
        <Modal onClose={closeEditor} title={editingId ? "Edit note" : "New note"}>
          <form className="Form" onSubmit={handleSave}>
            <label className="Field">
              <span className="Field-label">Title</span>
              <input
                className="Input"
                value={draft.title}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, title: e.target.value }))
                }
                placeholder="e.g., Shopping list"
                maxLength={120}
                autoFocus
              />
            </label>

            <label className="Field">
              <span className="Field-label">Content</span>
              <textarea
                className="Textarea"
                value={draft.content}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, content: e.target.value }))
                }
                placeholder="Write something..."
                rows={8}
              />
            </label>

            <div className="Form-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={closeEditor}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {selectedForDelete ? (
        <Modal
          onClose={() => setConfirmDeleteId(null)}
          title="Delete note?"
          tone="danger"
        >
          <div className="Confirm">
            <p className="Confirm-text">
              This will permanently delete{" "}
              <strong>{selectedForDelete.title?.trim() || "Untitled"}</strong>.
            </p>
            <div className="Form-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => handleDeleteConfirmed(selectedForDelete.id)}
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

/**
 * Simple modal dialog with accessible semantics.
 */
function Modal({ title, onClose, children, tone = "default" }) {
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="ModalBackdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="Modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-tone={tone}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="Modal-header">
          <h2 className="Modal-title">{title}</h2>
          <button className="IconButton" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="Modal-body">{children}</div>
      </div>
    </div>
  );
}

function formatRelativeDate(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    const diffMs = Date.now() - d.getTime();
    const min = Math.round(diffMs / 60000);
    if (min < 1) return "just now";
    if (min < 60) return `${min}m ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const days = Math.round(hr / 24);
    return `${days}d ago`;
  } catch {
    return "—";
  }
}

/**
 * ---------------------------
 * Data layer (API -> fallback)
 * ---------------------------
 *
 * The backend container is not currently part of this workspace.
 * We attempt API calls using env base URL, and if they fail, we
 * transparently fall back to localStorage.
 */

const LS_KEY = "simple-notes-app.notes.v1";

function generateId() {
  // Good enough for local-only IDs (no auth, no multi-user constraints).
  return `note_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeNote(raw) {
  return {
    id: String(raw.id),
    title: String(raw.title ?? ""),
    content: String(raw.content ?? ""),
    updatedAt: String(raw.updatedAt ?? raw.updated_at ?? nowIso()),
    createdAt: String(raw.createdAt ?? raw.created_at ?? nowIso()),
  };
}

function loadLocalNotes() {
  const raw = window.localStorage.getItem(LS_KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.map(normalizeNote).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

function saveLocalNotes(nextNotes) {
  window.localStorage.setItem(LS_KEY, JSON.stringify(nextNotes));
}

async function tryApiFetch(url, options) {
  const res = await fetch(url, options);
  // Treat non-2xx as errors to allow fallback.
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `API error (${res.status})${text ? `: ${text}` : ""}`.trim()
    );
  }
  // 204 no content
  if (res.status === 204) return null;
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    // Backend might not exist / unexpected content; treat as failure to enable fallback.
    const text = await res.text().catch(() => "");
    throw new Error(`API returned non-JSON response.${text ? ` ${text}` : ""}`);
  }
  return res.json();
}

async function apiListNotes(apiBase) {
  // Expected endpoints (conventional):
  // GET {apiBase}/notes -> [{id,title,content,createdAt,updatedAt}]
  return tryApiFetch(`${apiBase}/notes`, { method: "GET" });
}

async function apiCreateNote(apiBase, note) {
  // POST {apiBase}/notes {title,content}
  return tryApiFetch(`${apiBase}/notes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(note),
  });
}

async function apiUpdateNote(apiBase, id, patch) {
  // PUT/PATCH {apiBase}/notes/:id
  // We'll try PATCH first.
  try {
    return await tryApiFetch(`${apiBase}/notes/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
  } catch {
    return tryApiFetch(`${apiBase}/notes/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
  }
}

async function apiDeleteNote(apiBase, id) {
  // DELETE {apiBase}/notes/:id
  return tryApiFetch(`${apiBase}/notes/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

async function loadNotes({ apiBase }) {
  if (apiBase) {
    try {
      const apiNotes = await apiListNotes(apiBase);
      const normalized = Array.isArray(apiNotes)
        ? apiNotes.map(normalizeNote)
        : [];
      // Keep a local cache so if API goes down later we still have data.
      saveLocalNotes(normalized);
      return normalized.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    } catch {
      // Fallback
      return loadLocalNotes();
    }
  }
  return loadLocalNotes();
}

async function createNote({ apiBase, note }) {
  if (apiBase) {
    try {
      const created = await apiCreateNote(apiBase, note);
      const normalized = normalizeNote(created);
      // Update local cache
      const existing = loadLocalNotes();
      const next = [normalized, ...existing.filter((n) => n.id !== normalized.id)];
      saveLocalNotes(next);
      return normalized;
    } catch {
      // fallback
    }
  }

  const newNote = normalizeNote({
    id: generateId(),
    title: note.title ?? "",
    content: note.content ?? "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  const existing = loadLocalNotes();
  const next = [newNote, ...existing];
  saveLocalNotes(next);
  return newNote;
}

async function updateNote({ apiBase, id, patch }) {
  if (apiBase) {
    try {
      const updated = await apiUpdateNote(apiBase, id, patch);
      const normalized = normalizeNote(updated);
      const existing = loadLocalNotes();
      const next = existing.map((n) => (n.id === id ? normalized : n));
      saveLocalNotes(next);
      return normalized;
    } catch {
      // fallback
    }
  }

  const existing = loadLocalNotes();
  const found = existing.find((n) => n.id === id);
  if (!found) throw new Error("Note not found.");
  const updatedLocal = normalizeNote({
    ...found,
    ...patch,
    updatedAt: nowIso(),
  });
  const next = existing.map((n) => (n.id === id ? updatedLocal : n));
  saveLocalNotes(next);
  return updatedLocal;
}

async function deleteNote({ apiBase, id }) {
  if (apiBase) {
    try {
      await apiDeleteNote(apiBase, id);
      const existing = loadLocalNotes();
      const next = existing.filter((n) => n.id !== id);
      saveLocalNotes(next);
      return;
    } catch {
      // fallback
    }
  }

  const existing = loadLocalNotes();
  const next = existing.filter((n) => n.id !== id);
  saveLocalNotes(next);
}

export default App;
