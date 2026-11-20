import fs from 'node:fs/promises';
import path from 'node:path';
import type { UpsertMetricsInput } from '../dal/runs.dal.js';

interface JsonRecord {
  [key: string]: unknown;
}

function getNestedNumber(obj: unknown, pathKeys: string[]): number | null {
  let current: unknown = obj;
  for (const key of pathKeys) {
    if (current && typeof current === 'object' && key in (current as JsonRecord)) {
      current = (current as JsonRecord)[key];
    } else {
      return null;
    }
  }
  return typeof current === 'number' && Number.isFinite(current) ? current : null;
}

async function readJsonSafe(filePath: string): Promise<JsonRecord | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as JsonRecord) : null;
  } catch {
    return null;
  }
}

/**
 * Recursively walks a run's output directory (bounded depth) to locate summary JSONs,
 * Browsertime MP4 video, and HAR files.
 */
async function walkFiles(dir: string, maxDepth = 6): Promise<string[]> {
  const results: string[] = [];
  async function recurse(current: string, depth: number) {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await recurse(fullPath, depth + 1);
      } else if (entry.isFile()) {
        results.push(fullPath);
      }
    }
  }
  await recurse(dir, 0);
  return results;
}

/**
 * Extracts Core Web Vitals, Browsertime timings, PageXray size/requests, and Coach score
 * from a completed Sitespeed.io output directory.
 */
export async function parseSitespeedResults(
  runId: number,
  url: string,
  runDir: string
): Promise<UpsertMetricsInput> {
  const files = await walkFiles(runDir);

  const browsertimeFile =
    files.find((f) => f.endsWith('browsertime.summary-total.json')) ??
    files.find((f) => f.endsWith('browsertime.pageSummary.json')) ??
    files.find((f) => path.basename(f) === 'browsertime.json');

  const pagexrayFile =
    files.find((f) => f.endsWith('pagexray.summary-total.json')) ??
    files.find((f) => f.endsWith('pagexray.pageSummary.json'));

  const coachFile =
    files.find((f) => f.endsWith('coach.summary-total.json')) ??
    files.find((f) => f.endsWith('coach.pageSummary.json'));

  const videoFile = files.find((f) => f.endsWith('.mp4'));
  const harFile = files.find((f) => f.endsWith('.har') || f.endsWith('.har.gz'));

  const bt = browsertimeFile ? await readJsonSafe(browsertimeFile) : null;
  const px = pagexrayFile ? await readJsonSafe(pagexrayFile) : null;
  const coach = coachFile ? await readJsonSafe(coachFile) : null;

  const fcpMs =
    getNestedNumber(bt, ['statistics', 'timings', 'paintTiming', 'first-contentful-paint', 'median']) ??
    getNestedNumber(bt, ['timings', 'paintTiming', 'first-contentful-paint', 'median']) ??
    getNestedNumber(bt, ['firstPaint', 'median']);

  const lcpMs =
    getNestedNumber(bt, ['statistics', 'timings', 'largestContentfulPaint', 'renderTime', 'median']) ??
    getNestedNumber(bt, ['timings', 'largestContentfulPaint', 'renderTime', 'median']);

  const cls =
    getNestedNumber(bt, ['statistics', 'pageinfo', 'cumulativeLayoutShift', 'median']) ??
    getNestedNumber(bt, ['pageinfo', 'cumulativeLayoutShift', 'median']);

  const tbtMs =
    getNestedNumber(bt, ['statistics', 'cpu', 'longTasks', 'totalBlockingTime', 'median']) ??
    getNestedNumber(bt, ['cpu', 'longTasks', 'totalBlockingTime', 'median']);

  const ttfbMs =
    getNestedNumber(bt, ['statistics', 'timings', 'ttfb', 'median']) ??
    getNestedNumber(bt, ['timings', 'ttfb', 'median']);

  const speedIndexMs =
    getNestedNumber(bt, ['statistics', 'visualMetrics', 'SpeedIndex', 'median']) ??
    getNestedNumber(bt, ['visualMetrics', 'SpeedIndex', 'median']);

  const fullyLoadedMs =
    getNestedNumber(bt, ['statistics', 'timings', 'fullyLoaded', 'median']) ??
    getNestedNumber(bt, ['timings', 'fullyLoaded', 'median']);

  const pageSizeBytes =
    getNestedNumber(px, ['transferSize', 'median']) ??
    getNestedNumber(px, ['statistics', 'transferSize', 'median']);

  const requestsCount =
    getNestedNumber(px, ['requests', 'median']) ??
    getNestedNumber(px, ['statistics', 'requests', 'median']);

  const coachScore =
    getNestedNumber(coach, ['advice', 'score', 'median']) ??
    getNestedNumber(coach, ['advice', 'performance', 'score', 'median']) ??
    getNestedNumber(coach, ['score', 'median']);

  return {
    runId,
    url,
    fcpMs,
    lcpMs,
    cls,
    tbtMs,
    ttfbMs,
    speedIndexMs,
    fullyLoadedMs,
    pageSizeBytes: pageSizeBytes !== null ? Math.round(pageSizeBytes) : null,
    requestsCount: requestsCount !== null ? Math.round(requestsCount) : null,
    coachScore,
    videoRelPath: videoFile ? path.relative(runDir, videoFile).replace(/\\/g, '/') : null,
    harRelPath: harFile ? path.relative(runDir, harFile).replace(/\\/g, '/') : null,
  };
}
