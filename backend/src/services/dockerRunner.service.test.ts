import assert from 'node:assert/strict';
import test from 'node:test';
import type { TestRunRecord } from '../db/types.js';
import { buildSitespeedArgs } from './dockerRunner.service.js';

test('buildSitespeedArgs produces strict allowlisted CLI array', () => {
  const run: TestRunRecord = {
    id: 42,
    client_id: 1,
    project_id: null,
    url: 'https://example.com',
    browser: 'chrome',
    connectivity: '4g',
    iterations: 3,
    mobile: 1,
    tags: '["prod"]',
    status: 'queued',
    container_id: null,
    report_dir: null,
    error_message: null,
    started_at: null,
    finished_at: null,
    created_at: '2026-11-20T00:00:00Z',
  };

  const args = buildSitespeedArgs(run, '/sitespeed.io/run-42');
  assert.deepEqual(args, [
    'https://example.com',
    '--outputFolder',
    '/sitespeed.io/run-42',
    '--browsertime.iterations',
    '3',
    '--browsertime.browser',
    'chrome',
    '--browsertime.connectivity.profile',
    '4g',
    '--browsertime.video',
    'true',
    '--browsertime.visualMetrics',
    'true',
    '--copyLatestFilesToBase',
    'false',
    '--mobile',
    'true',
  ]);
});
