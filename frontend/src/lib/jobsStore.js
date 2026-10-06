/**
 * Job list storage, kept in the browser instead of a database.
 *
 * Every account gets its own key, so signing in as someone else shows an empty
 * table rather than the previous person's applications. The flip side is
 * deliberate: nothing is sent to the server, and clearing site data (or
 * switching browser or device) starts you fresh.
 */

const KEY_PREFIX = 'jobtracker:jobs:'
const VALID_STATUSES = ['Applied', 'Interview', 'Offer', 'Rejected']

function storageKey(userId) {
  return `${KEY_PREFIX}${userId}`
}

function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/** Coerce anything read from storage into a shape the UI can rely on. */
function normalize(job) {
  if (!job || typeof job !== 'object') return null
  const company = typeof job.company === 'string' ? job.company.trim() : ''
  const role = typeof job.role === 'string' ? job.role.trim() : ''
  if (!company && !role) return null

  return {
    id: typeof job.id === 'string' && job.id ? job.id : newId(),
    company,
    role,
    status: VALID_STATUSES.includes(job.status) ? job.status : 'Applied',
    date: typeof job.date === 'string' ? job.date : new Date().toISOString().slice(0, 10),
  }
}

/** Two entries are the same application if the company and role match. */
function dedupeKey(job) {
  return `${job.company.toLowerCase().trim()}|${job.role.toLowerCase().trim()}`
}

export function loadJobs(userId) {
  if (!userId) return []
  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    // Rebuild the list to drop duplicates and repair anything malformed, so a
    // corrupted entry can never break the table.
    const seen = new Set()
    const jobs = []
    for (const entry of parsed) {
      const job = normalize(entry)
      if (!job) continue
      const key = dedupeKey(job)
      if (seen.has(key)) continue
      seen.add(key)
      jobs.push(job)
    }
    return jobs
  } catch {
    return []
  }
}

function saveJobs(userId, jobs) {
  if (!userId) return
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(jobs))
  } catch {
    // Private browsing or a full quota: the app keeps working in memory.
  }
}

export function addJob(userId, jobs, { company, role, status = 'Applied' }) {
  const job = normalize({ id: newId(), company, role, status })
  if (!job) return jobs

  if (jobs.some((existing) => dedupeKey(existing) === dedupeKey(job))) return jobs

  const next = [job, ...jobs]
  saveJobs(userId, next)
  return next
}

export function updateJob(userId, jobs, id, patch) {
  const next = jobs.map((job) => (job.id === id ? { ...job, ...patch } : job))
  saveJobs(userId, next)
  return next
}

export function deleteJob(userId, jobs, id) {
  const next = jobs.filter((job) => job.id !== id)
  saveJobs(userId, next)
  return next
}

/**
 * Fold freshly synced Gmail rows into the existing list.
 *
 * A company/role pair that is already on the list is left alone, so a status you
 * set by hand is never reset to "Applied" by a later sync.
 */
export function mergeSyncedJobs(userId, jobs, incoming) {
  const existingKeys = new Set(jobs.map(dedupeKey))
  const additions = []
  const batchKeys = new Set()

  for (const entry of incoming) {
    const job = normalize(entry)
    if (!job) continue
    const key = dedupeKey(job)
    if (existingKeys.has(key) || batchKeys.has(key)) continue
    batchKeys.add(key)
    additions.push(job)
  }

  if (additions.length === 0) return { jobs, added: 0 }

  const next = [...additions, ...jobs]
  saveJobs(userId, next)
  return { jobs: next, added: additions.length }
}
