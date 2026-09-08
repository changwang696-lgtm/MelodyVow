export async function readJsonSafe<T = any>(response: Response): Promise<T & { message?: string; raw?: string }> {
  const contentType = (response.headers.get('content-type') || '').toLowerCase()
  const raw = await response.text()
  const trimmed = raw.trim()

  const looksLikeHtml = /^<!doctype\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)
  const isHtml = looksLikeHtml || contentType.includes('text/html')

  if (isHtml) {
    return {
      message:
        '后端接口返回了网页内容，请确认 API 服务已启动并重启（http://127.0.0.1:8787），以及 VITE_API_BASE_URL 没有指向前端地址。',
      raw: trimmed.slice(0, 300),
    } as T & { message?: string; raw?: string }
  }

  if (!trimmed) {
    return {} as T & { message?: string; raw?: string }
  }

  try {
    return JSON.parse(raw) as T & { message?: string; raw?: string }
  } catch {
    return {
      message: trimmed.slice(0, 300) || '接口返回内容无法解析。',
      raw: trimmed.slice(0, 300),
    } as T & { message?: string; raw?: string }
  }
}
