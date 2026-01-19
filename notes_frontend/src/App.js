import React, { useEffect, useMemo, useState } from "react";
import "./App.css";

/**
 * Notes app main component.
 * - Shows a list of notes in card layout
 * - Allows adding/editing via a modal dialog
 * - Allows deleting notes (UI-only when backend doesn't support it)
 * - Persists via backend API (GET/POST) when reachable; uses localStorage as read-only fallback for listing only
 */

// PUBLIC_INTERFACE
function App() {
  const { notesUrl, apiConfigured } = useMemo(() => {
    // Build: {REACT_APP_BACKEND_URL}{REACT_APP_API_BASE}/notes
    // Examples:
    // - REACT_APP_BACKEND_URL="http://localhost:8000", REACT_APP_API_BASE="/api"
    // - REACT_APP_BACKEND_URL="https://example.com", REACT_APP_API_BASE="/api"
    const backend = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "");
    const apiBase = process.env.REACT_APP_API_BASE || "";

    const basePath = apiBase
      ? apiBase.startsWith("/") ? apiBase : `/${apiBase}`
      : "";

    const configured = Boolean(backend) && Boolean(basePath);

    return {
      apiConfigured: configured,
      notesUrl: configured ? `${backend}${basePath}/notes` : "",
    };
  }, []);

  const [notes, setNotes] = useState([]);
  const [status, setStatus] = useState({
    loading: true,
    error: "",
    usingFallback: false,
  });

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ title: "", content: "" });

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Load notes on first render
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus({ loading: true, error: "", usingFallback: false });
      try {
        const loaded = await loadNotesFromApiOrFallback({ notesUrl });
        if (!cancelled) {
          setNotes(loaded.notes);
          setStatus({
            loading: false,
            error: "",
            usingFallback: loaded.usingFallback,
          });
        }
      } catch (e) {
        if (!cancelled) {
          setNotes([]);
          setStatus({
            loading: false,
            error: e instanceof Error ? e.message : "Failed to load notes.",
            usingFallback: false,
          });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [notesUrl]);

  function openNewNote() {
    setEditingId(null);
    setDraft({ title: "", content: "" });
    setIsEditorOpen(true);
  }

  function openEdit(note) {
    // Backend for this subtask only supports GET/POST.
    // Keep editor UI for local-only / future extension, but block editing when API is configured.
    if (apiConfigured) {
      setStatus((s) => ({
        ...s,
        error: "Editing notes is not supported by the current backend API (GET/POST only).",
      }));
      return;
    }

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

    // For this subtask we only persist "create" to backend.
    if (editingId) {
      setStatus((s) => ({
        ...s,
        error: "Editing notes is not supported by the current backend API (GET/POST only).",
      }));
      return;
    }

    setStatus({ loading: true, error: "", usingFallback: status.usingFallback });

    try {
      const created = await createNoteViaApi({ notesUrl, note: { title: draft.title, content: draft.content } });
      setNotes((prev) => [created, ...prev]);
      setStatus({ loading: false, error: "", usingFallback: false });
      closeEditor();
    } catch (e2) {
      setStatus({
        loading: false,
        error: e2 instanceof Error ? e2.message : "Failed to save note.",
        usingFallback: status.usingFallback,
      });
    }
  }

  async function handleDeleteConfirmed() {
    // Backend for this subtask doesn't support delete; keep UI but report a friendly error.
    setStatus((s) => ({
      ...s,
      error: "Deleting notes is not supported by the current backend API (GET/POST only).",
    }));
    setConfirmDeleteId(null);
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
            <p className="TopBar-subtitle">Add simple notes.</p>
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
              {apiConfigured
                ? status.usingFallback
                  ? "Backend unreachable — showing local cached notes"
                  : "Backend API"
                : "Local storage (no API configured)"}
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
            <p className="EmptyState-body">Create your first note to get started.</p>
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
                      disabled={apiConfigured}
                      title={
                        apiConfigured
                          ? "Editing not supported by backend API (GET/POST only)"
                          : "Edit note"
                      }
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-dangerGhost"
                      onClick={() => setConfirmDeleteId(note.id)}
                      aria-label={`Delete note ${note.title || ""}`.trim()}
                      disabled={apiConfigured}
                      title={
                        apiConfigured
                          ? "Deleting not supported by backend API (GET/POST only)"
                          : "Delete note"
                      }
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <p className="NoteCard-content">
                  {note.content?.trim()
                    ? note.content
                    : "No content. Create a new note to add details."}
                </p>

                <div className="NoteCard-footer">
                  <span className="NoteCard-date" title="Created at">
                    {note.createdAt ? `Created ${formatRelativeDate(note.createdAt)}` : "—"}
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
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
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
                onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
                placeholder="Write something..."
                rows={8}
              />
            </label>

            <div className="Form-actions">
              <button type="button" className="btn btn-ghost" onClick={closeEditor}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={!apiConfigured}>
                Save
              </button>
            </div>

            {!apiConfigured ? (
              <p className="Confirm-text" style={{ marginTop: 10 }}>
                Backend API is not configured. Set <code>REACT_APP_BACKEND_URL</code> and{" "}
                <code>REACT_APP_API_BASE</code> to enable saving.
              </p>
            ) : null}
          </form>
        </Modal>
      ) : null}

      {selectedForDelete ? (
        <Modal onClose={() => setConfirmDeleteId(null)} title="Delete note?" tone="danger">
          <div className="Confirm">
            <p className="Confirm-text">
              This will permanently delete{" "}
              <strong>{selectedForDelete.title?.trim() || "Untitled"}</strong>.
            </p>
            <div className="Form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmDeleteId(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={handleDeleteConfirmed}>
                Delete
              </button>
            </div>
            {apiConfigured ? (
              <p className="Confirm-text" style={{ marginTop: 10 }}>
                Delete is currently disabled because the backend API only supports GET/POST.
              </p>
            ) : null}
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
 * Data layer (backend + fallback)
 * ---------------------------
 *
 * Requirements:
 * - Use env-driven URL: GET {REACT_APP_BACKEND_URL}{REACT_APP_API_BASE}/notes
 * - POST to the same path with JSON {title, content}
 * - localStorage is read-only fallback only when backend is unreachable
 */

const LS_KEY = "simple-notes-app.notes.v1";

function normalizeNote(raw) {
  return {
    id: String(raw.id),
    title: String(raw.title ?? ""),
    content: String(raw.content ?? ""),
    createdAt: String(raw.created_at ?? raw.createdAt ?? ""),
  };
}

function loadLocalNotesReadOnly() {
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Older local cache may have updatedAt/createdAt; accept and normalize.
    return parsed
      .map((n) => ({
        id: String(n.id),
        title: String(n.title ?? ""),
        content: String(n.content ?? ""),
        createdAt: String(n.createdAt ?? n.created_at ?? n.updatedAt ?? ""),
      }))
      .filter((n) => n.id);
  } catch {
    return [];
  }
}

function saveLocalNotesCache(notes) {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(notes));
  } catch {
    // Ignore cache write failures (private mode / quota).
  }
}

function isNetworkUnreachableError(err) {
  // fetch() throws TypeError on network failures
  return err instanceof TypeError;
}

// PUBLIC_INTERFACE
async function listNotesFromBackend(notesUrl) {
  /** List notes from backend Notes API. */
  const res = await fetch(notesUrl, { method: "GET" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to load notes (${res.status})${text ? `: ${text}` : ""}`);
  }
  const json = await res.json();
  if (!Array.isArray(json)) return [];
  return json.map(normalizeNote);
}

// PUBLIC_INTERFACE
async function createNoteOnBackend(notesUrl, note) {
  /** Create a note via backend Notes API. */
  const res = await fetch(notesUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: note.title, content: note.content }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to create note (${res.status})${text ? `: ${text}` : ""}`);
  }
  const json = await res.json();
  return normalizeNote(json);
}

async function loadNotesFromApiOrFallback({ notesUrl }) {
  if (!notesUrl) {
    return { notes: loadLocalNotesReadOnly(), usingFallback: true };
  }

  try {
    const backendNotes = await listNotesFromBackend(notesUrl);
    // Cache latest backend state for fallback display if backend goes down later.
    saveLocalNotesCache(backendNotes);
    return { notes: backendNotes, usingFallback: false };
  } catch (err) {
    // Only fallback when backend is unreachable (network error).
    if (isNetworkUnreachableError(err)) {
      return { notes: loadLocalNotesReadOnly(), usingFallback: true };
    }
    throw err;
  }
}

async function createNoteViaApi({ notesUrl, note }) {
  if (!notesUrl) {
    throw new Error("Backend API is not configured.");
  }

  try {
    const created = await createNoteOnBackend(notesUrl, note);
    // Update cache on success.
    const existing = loadLocalNotesReadOnly();
    const next = [created, ...existing.filter((n) => n.id !== created.id)];
    saveLocalNotesCache(next);
    return created;
  } catch (err) {
    if (isNetworkUnreachableError(err)) {
      // Per requirements: localStorage is read-only fallback; do not create locally if backend is down.
      throw new Error("Backend is unreachable. Cannot create notes while offline.");
    }
    throw err;
  }
}

export default App;
