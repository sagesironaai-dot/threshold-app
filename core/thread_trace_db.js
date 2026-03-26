// ┌─────────────────────────────────────────────────────────────────────────────┐
// │  ⬡  GUARDIAN NOTE — thread_trace_db.js                                     │
// │  Role: IDB layer for Thread Trace. Owns saved_threads and                  │
// │  thread_annotations stores only. Does NOT own entry data (data.js).        │
// │                                                                             │
// │  DB VERSION COORDINATION:                                                   │
// │    REQUIRED_VERSION = 7 — must always match DB_VERSION in data.js.         │
// │    If data.js increments to v8, update REQUIRED_VERSION here too.          │
// │    Both files open the same DB (AelarianArchive). Mismatched versions      │
// │    will trigger onblocked, locking the tab.                                 │
// │                                                                             │
// │  STORES OWNED HERE:                                                         │
// │    saved_threads     — keyPath: 'id', indexes: thread_type,               │
// │                         last_accessed, is_deleted                           │
// │    thread_annotations — keyPath: 'id', indexes: thread_id, timestamp      │
// │    Both stores are created in data.js v7 migration AND mirrored            │
// │    in _ensureStores() here as a safety fallback.                            │
// │                                                                             │
// │  SOFT DELETE:                                                               │
// │    deleteThread() sets is_deleted = true. Does NOT remove entries.         │
// │    listThreads() filters is_deleted automatically.                          │
// │                                                                             │
// │  ANNOTATION MIRRORING:                                                      │
// │    saveAnnotation() writes to STORE_ANNOTATIONS AND mirrors into           │
// │    saved_threads.annotations array for fast load. Both must stay in sync.  │
// │    deleteAnnotation() removes from both stores.                             │
// │                                                                             │
// │  SESSION-ONLY STATE (in memory, no IDB write):                             │
// │    setSessionThread() / getSessionThread() / clearSessionThread()          │
// │    Clear on overlay close or new thread open.                              │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * thread-trace-db.js
 * Thread Trace IDB Layer — Aelarian Archive
 *
 * Responsibilities:
 *   · saved_threads IDB store — open, save, update, list, soft-delete
 *   · thread_annotations — save and load per thread
 *   · Routing snapshot persistence
 *   · Session-only thread state (in memory, no write until Save triggered)
 *
 * Does NOT own:
 *   · Thread building (thread-trace.js)
 *   · UI (thread-trace-ui.js)
 *   · Main IDB connection (data.js owns the DB — this module opens it by name)
 *
 * IDB store names:
 *   saved_threads       — added in the next openDB version increment
 *   thread_annotations  — optional separate store (see note below)
 *
 * IMPORTANT — version increment:
 *   The saved_threads store must be added in an onupgradeneeded block.
 *   Increment the DB version in data.js and add the store there, OR
 *   open a parallel upgrade here (see _ensureStores below).
 *   Coordinate with data.js before shipping.
 *
 * Revision: March 2026
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const DB_NAME    = 'AelarianArchive';  // must match data.js
const STORE_THREADS     = 'saved_threads';
const STORE_ANNOTATIONS = 'thread_annotations';

// Target version — increment data.js DB_VERSION to this when adding stores
// Co-ordinate: data.js owns the onupgradeneeded handler
const REQUIRED_VERSION = 7; // must match DB_VERSION in data.js


// ─────────────────────────────────────────────────────────────────────────────
// DB CONNECTION
// Piggybacks on the existing DB if already open; opens independently if not.
// ─────────────────────────────────────────────────────────────────────────────

let _db = null;

async function _getDB() {
  if (_db) return _db;

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, REQUIRED_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      _ensureStores(db);
    };

    req.onsuccess = (e) => {
      _db = e.target.result;
      resolve(_db);
    };

    req.onerror = (e) => {
      console.error('[ThreadTraceDB] IDB open failed:', e.target.error);
      reject(e.target.error);
    };

    req.onblocked = () => {
      console.warn('[ThreadTraceDB] IDB open blocked — another tab may have an older version open.');
    };
  });
}

/**
 * _ensureStores
 * Called in onupgradeneeded. Safe to call multiple times — checks existence first.
 * Coordinate with data.js onupgradeneeded handler.
 */
function _ensureStores(db) {
  if (!db.objectStoreNames.contains(STORE_THREADS)) {
    const store = db.createObjectStore(STORE_THREADS, { keyPath: 'id' });
    store.createIndex('thread_type',   'thread_type',   { unique: false });
    store.createIndex('last_accessed', 'last_accessed', { unique: false });
    store.createIndex('is_deleted',    'is_deleted',    { unique: false });
  }

  if (!db.objectStoreNames.contains(STORE_ANNOTATIONS)) {
    const ann = db.createObjectStore(STORE_ANNOTATIONS, { keyPath: 'id' });
    ann.createIndex('thread_id', 'thread_id', { unique: false });
    ann.createIndex('timestamp', 'timestamp', { unique: false });
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// SAVED THREADS — CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * saveThread
 * Creates or updates a saved thread record.
 * Called from ThreadTraceUI save dialog.
 *
 * @param {ThreadResult} threadResult   — output of buildThread()
 * @param {string}       name           — user-defined name
 * @param {Object}       routingSnapshot — output of buildRoutingSnapshot()
 * @param {Object}       filterState    — active filter state at time of save
 * @param {string}       [existingId]   — if updating an existing thread
 * @returns {Promise<string>}           — saved thread id
 */
export async function saveThread(threadResult, name, routingSnapshot, filterState = {}, existingId = null) {
  const db  = await _getDB();
  const now = new Date().toISOString();

  const record = existingId
    ? await _loadThreadRecord(db, existingId)
    : null;

  const id = existingId || _newThreadId();

  const thread = {
    id,
    name:             name.trim(),
    thread_type:      threadResult.threadType,
    seed:             _serialiseSeed(threadResult.seed),
    entry_ids:        (threadResult.entries || []).map(e => e.id),
    filter_state:     filterState,
    tag_routing_snapshot: routingSnapshot || null,
    annotations:      record?.annotations || [],  // preserve existing annotations
    created_at:       record?.created_at  || now,
    last_accessed:    now,
    is_deleted:       false,
  };

  await _put(db, STORE_THREADS, thread);
  return id;
}

/**
 * loadThread
 * Loads a saved thread record by id.
 * NOTE: Does not reconstruct full entries — caller fetches entries separately
 * using thread.entry_ids and passes them to buildThread() or renders directly.
 *
 * @param {string} id
 * @returns {Promise<SavedThread|null>}
 */
export async function loadThread(id) {
  const db = await _getDB();
  return _loadThreadRecord(db, id);
}

/**
 * listThreads
 * Returns all non-deleted saved threads, sorted by last_accessed desc.
 *
 * @returns {Promise<SavedThread[]>}
 */
export async function listThreads() {
  const db  = await _getDB();
  const all = await _getAll(db, STORE_THREADS);
  return all
    .filter(t => !t.is_deleted)
    .sort((a, b) => new Date(b.last_accessed) - new Date(a.last_accessed));
}

/**
 * deleteThread
 * Soft delete — sets is_deleted flag. Does not remove entries.
 *
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteThread(id) {
  const db     = await _getDB();
  const record = await _loadThreadRecord(db, id);
  if (!record) return;
  record.is_deleted   = true;
  record.last_accessed = new Date().toISOString();
  await _put(db, STORE_THREADS, record);
}

/**
 * touchThread
 * Updates last_accessed without modifying other fields.
 * Call when a saved thread is re-opened.
 *
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function touchThread(id) {
  const db     = await _getDB();
  const record = await _loadThreadRecord(db, id);
  if (!record || record.is_deleted) return;
  record.last_accessed = new Date().toISOString();
  await _put(db, STORE_THREADS, record);
}


// ─────────────────────────────────────────────────────────────────────────────
// THREAD ANNOTATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * saveAnnotation
 * Saves a thread annotation.
 * Stored in STORE_ANNOTATIONS (separate store) AND mirrored into
 * saved_threads.annotations array for convenience on load.
 *
 * @param {string} threadId
 * @param {string} text
 * @param {Object} filterSnapshot  — active filter + position at time of writing
 * @returns {Promise<string>}      — annotation id
 */
export async function saveAnnotation(threadId, text, filterSnapshot = {}) {
  const db  = await _getDB();
  const now = new Date().toISOString();
  const id  = _newAnnotationId();

  const annotation = {
    id,
    thread_id:       threadId,
    text:            text.trim(),
    timestamp:       now,
    filter_snapshot: filterSnapshot,
  };

  // Write to annotations store
  await _put(db, STORE_ANNOTATIONS, annotation);

  // Mirror into saved_threads.annotations array
  const thread = await _loadThreadRecord(db, threadId);
  if (thread) {
    thread.annotations = [...(thread.annotations || []), annotation];
    thread.last_accessed = now;
    await _put(db, STORE_THREADS, thread);
  }

  return id;
}

/**
 * loadAnnotations
 * Loads all annotations for a thread, sorted by timestamp asc.
 *
 * @param {string} threadId
 * @returns {Promise<Annotation[]>}
 */
export async function loadAnnotations(threadId) {
  // Fast path — read from saved_threads.annotations mirror if available
  const db     = await _getDB();
  const thread = await _loadThreadRecord(db, threadId);
  if (thread?.annotations?.length) {
    return thread.annotations.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  // Fallback — query annotations store directly
  const all = await _getAll(db, STORE_ANNOTATIONS);
  return all
    .filter(a => a.thread_id === threadId)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

/**
 * deleteAnnotation
 * Removes an annotation from both stores.
 *
 * @param {string} annotationId
 * @param {string} threadId
 * @returns {Promise<void>}
 */
export async function deleteAnnotation(annotationId, threadId) {
  const db = await _getDB();
  await _delete(db, STORE_ANNOTATIONS, annotationId);

  const thread = await _loadThreadRecord(db, threadId);
  if (thread) {
    thread.annotations = (thread.annotations || []).filter(a => a.id !== annotationId);
    await _put(db, STORE_THREADS, thread);
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// SESSION-ONLY STATE (no IDB write)
// Holds the current unsaved thread in memory.
// Cleared when overlay closes or a new thread opens.
// ─────────────────────────────────────────────────────────────────────────────

let _sessionThread = null;

export function setSessionThread(threadResult) {
  _sessionThread = threadResult;
}

export function getSessionThread() {
  return _sessionThread;
}

export function clearSessionThread() {
  _sessionThread = null;
}


// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE IDB HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function _loadThreadRecord(db, id) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_THREADS, 'readonly');
    const req = tx.objectStore(STORE_THREADS).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror   = () => reject(req.error);
  });
}

function _put(db, storeName, record) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function _getAll(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = () => reject(req.error);
  });
}

function _delete(db, storeName, id) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

function _newThreadId() {
  return `thr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function _newAnnotationId() {
  return `ann_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function _serialiseSeed(seed) {
  if (!seed) return null;
  // Finding objects may not be JSON-safe — extract key fields only
  if (seed.type === 'finding') {
    return {
      type:        'finding',
      findingType: seed.id?.findingType || null,
      patternType: seed.id?.patternType || null,
      description: seed.id?.description || null,
    };
  }
  return seed;
}