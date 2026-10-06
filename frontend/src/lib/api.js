const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

/** Thrown for any non-2xx response, carrying the backend's message. */
export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request(path, { method = 'GET', body } = {}) {
  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      // The session cookie is HttpOnly, so it has to ride along explicitly.
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('Cannot reach the server. Is the backend running?', 0)
  }

  if (response.status === 204) return null

  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    // Fall through to the generic message below.
  }

  if (!response.ok) {
    const detail = data?.detail
    const message =
      typeof detail === 'string' ? detail : 'Something went wrong. Please try again.'
    throw new ApiError(message, response.status)
  }

  return data
}

/** The signed-in user, or null when nobody is signed in. */
export async function fetchMe() {
  try {
    return await request('/api/me')
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

/** Kick off Google sign-in by sending the browser to Google's consent page. */
export async function startGoogleLogin() {
  const { url } = await request('/auth/login')
  window.location.href = url
}

export async function logout() {
  return request('/auth/logout', { method: 'POST' })
}

export async function disconnectGmail() {
  return request('/auth/disconnect-gmail', { method: 'POST' })
}

/** Read this user's inbox. Returns the applications; nothing is stored server-side. */
export async function syncGmail() {
  const data = await request('/api/sync-gmail', { method: 'POST' })
  return data.jobs || []
}
