export type BrowserType = 'chrome' | 'firefox';
export type ConnectivityType = 'native' | 'cable' | '4g' | '3g';
export type RunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface ClientRecord {
  id: number;
  name: string;
  slug: string;
  contact_email: string | null;
  notes: string | null;
  created_at: string;
}

export interface ProjectRecord {
  id: number;
  client_id: number;
  name: string;
  base_url: string;
  default_tags: string; // JSON array string
  created_at: string;
}

export interface TestRunRecord {
  id: number;
  client_id: number;
  project_id: number | null;
  url: string;
  browser: BrowserType;
  connectivity: ConnectivityType;
  iterations: number;
  mobile: number; // 0 | 1 in SQLite
  tags: string; // JSON array string
  status: RunStatus;
  container_id: string | null;
  report_dir: string | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface RunMetricsRecord {
  id: number;
  run_id: number;
  url: string;
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
  advice_json: string | null;
  created_at: string;
}

export interface ScheduleRecord {
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

export interface SharedReportRecord {
  id: number;
  token: string;
  client_id: number;
  title: string;
  filters_json: string;
  expires_at: string | null;
  created_at: string;
}
