import { Pool } from 'pg'

function toJson(value) {
  return JSON.stringify(value ?? null)
}

async function replaceRows(client, table, keyColumn, rows, buildParams) {
  for (const row of rows) {
    const { columns, values, updateAssignments } = buildParams(row)
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ')
    await client.query(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT (${keyColumn}) DO UPDATE SET ${updateAssignments.join(', ')}`,
      values,
    )
  }

  const keyAliases = [
    keyColumn,
    keyColumn.replace(/_([a-z])/g, (_, char) => char.toUpperCase()),
    keyColumn.replace(/_id$/i, 'Id'),
  ]
  const keys = rows
    .map((row) => {
      for (const key of keyAliases) {
        const value = row?.[key]
        if (value !== undefined && value !== null && String(value).trim()) {
          return String(value).trim()
        }
      }
      return ''
    })
    .filter(Boolean)
  if (keys.length) {
    await client.query(`DELETE FROM ${table} WHERE NOT (${keyColumn} = ANY($1::text[]))`, [keys])
  }
  else {
    await client.query(`DELETE FROM ${table}`)
  }
}

export function getDatabaseConnectionString() {
  return String(
    process.env.DATABASE_URL
    || process.env.SUPABASE_DB_URL
    || process.env.POSTGRES_URL
    || '',
  ).trim()
}

export class PostgresPersistence {
  constructor(connectionString) {
    this.connectionString = connectionString
    this.pool = connectionString
      ? new Pool({
          connectionString,
          ssl: connectionString.includes('sslmode=')
            ? undefined
            : { rejectUnauthorized: false },
        })
      : null
  }

  get enabled() {
    return Boolean(this.pool)
  }

  async testConnection() {
    if (!this.pool) {
      return false
    }

    await this.pool.query('SELECT 1')
    return true
  }

  async hydrateSnapshot() {
    if (!this.pool) {
      return null
    }

    const [settingsResult, membersResult, ordersResult, songsResult, sessionsResult, jobsResult, lyricRequestsResult, sunoTasksResult] = await Promise.all([
      this.pool.query('SELECT key, value FROM app_settings'),
      this.pool.query('SELECT data FROM members ORDER BY updated_at DESC'),
      this.pool.query('SELECT data FROM orders ORDER BY updated_at DESC'),
      this.pool.query('SELECT data FROM songs ORDER BY updated_at DESC'),
      this.pool.query('SELECT data FROM member_sessions ORDER BY updated_at DESC'),
      this.pool.query('SELECT data FROM generation_jobs ORDER BY updated_at DESC'),
      this.pool.query('SELECT data FROM lyric_requests ORDER BY updated_at DESC'),
      this.pool.query('SELECT data FROM suno_tasks ORDER BY updated_at DESC'),
    ])

    return {
      settings: settingsResult.rows.map((row) => ({
        key: String(row.key || '').trim(),
        value: row.value ?? null,
      })),
      members: membersResult.rows.map((row) => row.data).filter(Boolean),
      orders: ordersResult.rows.map((row) => row.data).filter(Boolean),
      songs: songsResult.rows.map((row) => row.data).filter(Boolean),
      memberSessions: sessionsResult.rows.map((row) => row.data).filter(Boolean),
      jobs: jobsResult.rows.map((row) => row.data).filter(Boolean),
      lyricRequests: lyricRequestsResult.rows.map((row) => row.data).filter(Boolean),
      sunoTasks: sunoTasksResult.rows.map((row) => row.data).filter(Boolean),
    }
  }

  async persistSnapshot(snapshot) {
    if (!this.pool) {
      return
    }

    const client = await this.pool.connect()

    try {
      await client.query('BEGIN')

      await replaceRows(client, 'app_settings', 'key', snapshot.settings, (row) => ({
        columns: ['key', 'value', 'updated_at'],
        values: [row.key, toJson(row.value), row.updatedAt || new Date().toISOString()],
        updateAssignments: ['value = EXCLUDED.value', 'updated_at = EXCLUDED.updated_at'],
      }))

      await replaceRows(client, 'members', 'email', snapshot.members, (row) => ({
        columns: ['email', 'data', 'updated_at'],
        values: [String(row.email || '').trim().toLowerCase(), toJson(row), row.updatedAt || row.lastAuthAt || row.createdAt || new Date().toISOString()],
        updateAssignments: ['data = EXCLUDED.data', 'updated_at = EXCLUDED.updated_at'],
      }))

      await replaceRows(client, 'orders', 'id', snapshot.orders, (row) => ({
        columns: ['id', 'email', 'status', 'data', 'created_at', 'updated_at'],
        values: [
          String(row.id || '').trim(),
          String(row.email || '').trim().toLowerCase(),
          String(row.status || '').trim(),
          toJson(row),
          row.createdAt || new Date().toISOString(),
          row.updatedAt || row.createdAt || new Date().toISOString(),
        ],
        updateAssignments: ['email = EXCLUDED.email', 'status = EXCLUDED.status', 'data = EXCLUDED.data', 'created_at = EXCLUDED.created_at', 'updated_at = EXCLUDED.updated_at'],
      }))

      await replaceRows(client, 'songs', 'id', snapshot.songs, (row) => ({
        columns: ['id', 'email', 'job_id', 'status', 'data', 'created_at', 'updated_at'],
        values: [
          String(row.id || '').trim(),
          String(row.email || '').trim().toLowerCase(),
          String(row.jobId || '').trim(),
          String(row.status || '').trim(),
          toJson(row),
          row.createdAt || new Date().toISOString(),
          row.updatedAt || row.createdAt || new Date().toISOString(),
        ],
        updateAssignments: ['email = EXCLUDED.email', 'job_id = EXCLUDED.job_id', 'status = EXCLUDED.status', 'data = EXCLUDED.data', 'created_at = EXCLUDED.created_at', 'updated_at = EXCLUDED.updated_at'],
      }))

      await replaceRows(client, 'member_sessions', 'token', snapshot.memberSessions, (row) => ({
        columns: ['token', 'email', 'data', 'created_at', 'updated_at'],
        values: [
          String(row.token || '').trim(),
          String(row.email || '').trim().toLowerCase(),
          toJson(row),
          row.createdAt || new Date().toISOString(),
          row.updatedAt || row.createdAt || new Date().toISOString(),
        ],
        updateAssignments: ['email = EXCLUDED.email', 'data = EXCLUDED.data', 'created_at = EXCLUDED.created_at', 'updated_at = EXCLUDED.updated_at'],
      }))

      await replaceRows(client, 'generation_jobs', 'id', snapshot.jobs, (row) => ({
        columns: ['id', 'member_email', 'status', 'suno_task_id', 'data', 'created_at', 'updated_at'],
        values: [
          String(row.id || '').trim(),
          String(row?.input?.userEmail || '').trim().toLowerCase(),
          String(row.status || '').trim(),
          String(row.sunoTaskId || '').trim() || null,
          toJson(row),
          row.createdAt || new Date().toISOString(),
          row.updatedAt || row.createdAt || new Date().toISOString(),
        ],
        updateAssignments: ['member_email = EXCLUDED.member_email', 'status = EXCLUDED.status', 'suno_task_id = EXCLUDED.suno_task_id', 'data = EXCLUDED.data', 'created_at = EXCLUDED.created_at', 'updated_at = EXCLUDED.updated_at'],
      }))

      await replaceRows(client, 'lyric_requests', 'job_id', snapshot.lyricRequests, (row) => ({
        columns: ['job_id', 'status', 'request_payload', 'response_payload', 'parsed_payload', 'error', 'data', 'created_at', 'updated_at'],
        values: [
          String(row.jobId || '').trim(),
          String(row.status || '').trim(),
          toJson(row.requestPayload || null),
          toJson(row.responsePayload || null),
          toJson(row.parsedPayload || null),
          String(row.error || '').trim(),
          toJson(row),
          row.createdAt || new Date().toISOString(),
          row.updatedAt || row.createdAt || new Date().toISOString(),
        ],
        updateAssignments: ['status = EXCLUDED.status', 'request_payload = EXCLUDED.request_payload', 'response_payload = EXCLUDED.response_payload', 'parsed_payload = EXCLUDED.parsed_payload', 'error = EXCLUDED.error', 'data = EXCLUDED.data', 'created_at = EXCLUDED.created_at', 'updated_at = EXCLUDED.updated_at'],
      }))

      await replaceRows(client, 'suno_tasks', 'job_id', snapshot.sunoTasks, (row) => ({
        columns: ['job_id', 'task_id', 'status', 'request_payload', 'create_response_payload', 'callback_payload', 'latest_feed_payload', 'error', 'data', 'created_at', 'updated_at'],
        values: [
          String(row.jobId || '').trim(),
          String(row.taskId || '').trim() || null,
          String(row.status || '').trim(),
          toJson(row.requestPayload || null),
          toJson(row.createResponsePayload || null),
          toJson(row.callbackPayload || null),
          toJson(row.latestFeedPayload || null),
          String(row.error || '').trim(),
          toJson(row),
          row.createdAt || new Date().toISOString(),
          row.updatedAt || row.createdAt || new Date().toISOString(),
        ],
        updateAssignments: ['task_id = EXCLUDED.task_id', 'status = EXCLUDED.status', 'request_payload = EXCLUDED.request_payload', 'create_response_payload = EXCLUDED.create_response_payload', 'callback_payload = EXCLUDED.callback_payload', 'latest_feed_payload = EXCLUDED.latest_feed_payload', 'error = EXCLUDED.error', 'data = EXCLUDED.data', 'created_at = EXCLUDED.created_at', 'updated_at = EXCLUDED.updated_at'],
      }))

      await client.query('COMMIT')
    }
    catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
    finally {
      client.release()
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end()
    }
  }
}
