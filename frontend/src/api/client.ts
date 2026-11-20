export type BrowserType = 'chrome' | 'firefox';
export type ConnectivityType = 'native' | 'cable' | '4g' | '3g';
export type RunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface Client {
  id: number;
  name: string;
  slug: string;
  contact_email: string | null;
  notes: string | null;
  created_at: string;
}

export interface Project {
  id: number;
  client_id: number;
  name: string;
  base_url: string;
  default_tags: string;
  created_at: string;
}

export interface TestRun {
  id: number;
  client_id: number;
  project_id: number | null;
  client_name: string;
  project_name: string | null;
  url: string;
  browser: BrowserType;
  connectivity: ConnectivityType;
  iterations: number;
  mobile: number;
  tags: string;
  status: RunStatus;
  report_dir: string | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  fcp_ms: number | null;
  lcp_ms: number | null;
  cls: number | null;
  tbt_ms: number | null;
  ttfb_ms: number | null;
  speed_index_ms: number | null;
  fully_loaded_ms: number | null;
  page_size_bytes: number | null;
  requests_count: number | null;
  coach_score: number | null;
  video_rel_path: string | null;
  har_rel_path: string | null;
}

export interface Schedule {
  id: number;
  client_id: number;
  project_id: number | null;
  name: string;
  url: string;
  cron_expression: string;
  browser: BrowserType;
  connectivity: ConnectivityType;
  iterations: number;
  mobile: number;
  tags: string;
  enabled: number;
  last_run_at: string | null;
  created_at: string;
}

export interface SharedReportPayload {
  title: string;
  clientName: string;
  createdAt: string;
  expiresAt: string | null;
  runs: TestRun[];
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (options?.body !== undefined && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, {
    ...options,
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  getClients: () => request<{ clients: Client[] }>('/api/clients'),
  createClient: (body: { name: string; contactEmail?: string; notes?: string }) =>
    request<{ client: Client }>('/api/clients', { method: 'POST', body: JSON.stringify(body) }),
  deleteClient: (id: number) => request<{ ok: boolean }>(`/api/clients/${id}`, { method: 'DELETE' }),

  getProjects: (clientId?: number) =>
    request<{ projects: Project[] }>(
      clientId ? `/api/projects?clientId=${clientId}` : '/api/projects'
    ),
  createProject: (clientId: number, body: { name: string; baseUrl: string; defaultTags?: string[] }) =>
    request<{ project: Project }>(`/api/clients/${clientId}/projects`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteProject: (id: number) =>
    request<{ ok: boolean }>(`/api/projects/${id}`, { method: 'DELETE' }),

  getRuns: (params: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') qs.set(k, String(v));
    }
    return request<{ runs: TestRun[] }>(`/api/runs?${qs.toString()}`);
  },
  createRun: (body: {
    clientId: number;
    projectId?: number | null;
    url: string;
    browser: BrowserType;
    connectivity: ConnectivityType;
    iterations: number;
    mobile: boolean;
    tags: string[];
  }) => request<{ run: TestRun }>('/api/runs', { method: 'POST', body: JSON.stringify(body) }),
  cancelRun: (id: number) => request<{ ok: boolean }>(`/api/runs/${id}/cancel`, { method: 'POST' }),
  deleteRun: (id: number) => request<{ ok: boolean }>(`/api/runs/${id}`, { method: 'DELETE' }),
  getRunLogs: (id: number) => request<{ logs: string }>(`/api/runs/${id}/logs`),

  getSchedules: () => request<{ schedules: Schedule[] }>('/api/schedules'),
  createSchedule: (body: {
    clientId: number;
    projectId?: number | null;
    name: string;
    url: string;
    cronExpression: string;
    browser: BrowserType;
    connectivity: ConnectivityType;
    iterations: number;
    mobile: boolean;
    tags: string[];
  }) => request<{ schedule: Schedule }>('/api/schedules', { method: 'POST', body: JSON.stringify(body) }),
  toggleSchedule: (id: number) =>
    request<{ schedule: Schedule }>(`/api/schedules/${id}/toggle`, { method: 'PATCH' }),
  deleteSchedule: (id: number) =>
    request<{ ok: boolean }>(`/api/schedules/${id}`, { method: 'DELETE' }),

  createShareLink: (body: {
    clientId: number;
    title: string;
    filters: Record<string, unknown>;
    expiresInDays?: number;
  }) =>
    request<{ share: { id: number; token: string } }>('/api/shares', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getSharedReport: (token: string) =>
    request<{ report: SharedReportPayload }>(`/api/shared/${encodeURIComponent(token)}`),
};
