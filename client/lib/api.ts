export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message)
  }
}

type Options = { method?: string; json?: unknown; form?: FormData; signal?: AbortSignal }

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const init: RequestInit = { method: opts.method ?? (opts.json || opts.form ? 'POST' : 'GET'), credentials: 'same-origin', signal: opts.signal }
  if (opts.json !== undefined) {
    init.body = JSON.stringify(opts.json)
    init.headers = { 'Content-Type': 'application/json' }
  } else if (opts.form) {
    init.body = opts.form
  }

  let res: Response
  try {
    res = await fetch(`/api${path}`, init)
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ApiError('network', 'Could not reach the server. Check your internet connection and try again.', 0)
  }

  if (res.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/register') && !path.startsWith('/auth/delete')) {
    // Session expired. Clear the stale cookie first, otherwise the login page would bounce straight back.
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
    if (typeof window !== 'undefined') window.location.href = '/login?expired=1'
    throw new ApiError('unauthenticated', 'Please log in to continue.', 401)
  }

  const text = await res.text()
  let body: any = null
  try { body = text ? JSON.parse(text) : null } catch { /* not JSON */ }
  if (!res.ok) {
    const err = body?.error
    if (err?.message) throw new ApiError(err.code ?? 'error', err.message, res.status)
    if (res.status === 413) throw new ApiError('file_too_large', 'This file is too large to upload. The limit is about 4 MB.', 413)
    if (res.status >= 502) throw new ApiError('server_down', 'The server is not responding right now. Please try again in a moment.', res.status)
    throw new ApiError('error', 'Something went wrong. Please try again.', res.status)
  }
  return body as T
}

/** Upload a file with progress reporting (fetch cannot report upload progress). */
export function uploadCsv<T>(path: string, file: File, onProgress: (pct: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `/api${path}`)
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)) }
    xhr.onerror = () => reject(new ApiError('network', 'Could not reach the server. Check your internet connection and try again.', 0))
    xhr.onload = () => {
      let body: any = null
      try { body = JSON.parse(xhr.responseText) } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(body as T)
      if (xhr.status === 401) { window.location.href = '/login?expired=1'; return reject(new ApiError('unauthenticated', 'Please log in to continue.', 401)) }
      if (body?.error?.message) return reject(new ApiError(body.error.code ?? 'error', body.error.message, xhr.status))
      if (xhr.status === 413) return reject(new ApiError('file_too_large', 'This file is too large to upload. The limit is about 4 MB.', 413))
      reject(new ApiError('error', 'The upload failed. Please try again.', xhr.status))
    }
    const form = new FormData()
    form.append('file', file)
    xhr.send(form)
  })
}
