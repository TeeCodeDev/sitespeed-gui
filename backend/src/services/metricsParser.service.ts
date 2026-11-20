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

interface CoachAdviceItem {
  category: 'performance' | 'bestpractice' | 'accessibility' | 'privacy';
  id: string;
  title: string;
  description: string;
  advice: string;
  score: number;
  offending: string[];
}

function extractCoachAdvice(coach: JsonRecord | null): CoachAdviceItem[] {
  if (!coach) return [];
  const adviceRoot =
    (coach.advice && typeof coach.advice === 'object' ? (coach.advice as JsonRecord) : null) ?? coach;

  const categories: Array<'performance' | 'bestpractice' | 'accessibility' | 'privacy'> = [
    'performance',
    'bestpractice',
    'accessibility',
    'privacy',
  ];

  const items: CoachAdviceItem[] = [];
  for (const category of categories) {
    const catObj = adviceRoot[category];
    if (!catObj || typeof catObj !== 'object') continue;
    const adviceList = (catObj as JsonRecord).adviceList;
    if (!adviceList || typeof adviceList !== 'object') continue;

    for (const [id, rawItem] of Object.entries(adviceList as JsonRecord)) {
      if (!rawItem || typeof rawItem !== 'object') continue;
      const item = rawItem as JsonRecord;
      const score = typeof item.score === 'number' ? item.score : 100;
      if (score >= 100) continue;

      const offending = Array.isArray(item.offending)
        ? item.offending.filter((u): u is string => typeof u === 'string').slice(0, 10)
        : [];

      items.push({
        category,
        id,
        title: typeof item.title === 'string' ? item.title : id,
        description: typeof item.description === 'string' ? item.description : '',
        advice: typeof item.advice === 'string' ? item.advice : '',
        score,
        offending,
      });
    }
  }

  return items.sort((a, b) => a.score - b.score).slice(0, 40);
}

interface ContentTypeBreakdown {
  type: string;
  transferSizeBytes: number;
  requests: number;
}

interface HeavyAsset {
  url: string;
  type: string;
  transferSizeBytes: number;
}

interface RunDetails {
  categoryScores: {
    performance: number | null;
    bestpractice: number | null;
    accessibility: number | null;
    privacy: number | null;
  };
  milestones: {
    firstVisualChangeMs: number | null;
    domContentLoadedMs: number | null;
    visualComplete85Ms: number | null;
    lastVisualChangeMs: number | null;
  };
  contentTypes: ContentTypeBreakdown[];
  heaviestAssets: HeavyAsset[];
}

function extractRunDetails(bt: JsonRecord | null, px: JsonRecord | null, coach: JsonRecord | null): RunDetails {
  const adviceRoot =
    (coach?.advice && typeof coach.advice === 'object' ? (coach.advice as JsonRecord) : null) ?? coach;

  const getScore = (cat: string) =>
    getNestedNumber(adviceRoot, [cat, 'score', 'median']) ??
    getNestedNumber(adviceRoot, [cat, 'score']);

  const contentTypes: ContentTypeBreakdown[] = [];
  const ctRoot =
    (px?.contentTypes && typeof px.contentTypes === 'object' ? (px.contentTypes as JsonRecord) : null) ??
    (px?.statistics && typeof (px.statistics as JsonRecord).contentTypes === 'object'
      ? ((px.statistics as JsonRecord).contentTypes as JsonRecord)
      : null);

  if (ctRoot) {
    for (const [type, val] of Object.entries(ctRoot)) {
      if (!val || typeof val !== 'object') continue;
      const obj = val as JsonRecord;
      const bytes =
        getNestedNumber(obj, ['transferSize', 'median']) ??
        (typeof obj.transferSize === 'number' ? obj.transferSize : 0);
      const reqs =
        getNestedNumber(obj, ['requests', 'median']) ??
        (typeof obj.requests === 'number' ? obj.requests : 0);
      if (bytes > 0 || reqs > 0) {
        contentTypes.push({ type, transferSizeBytes: Math.round(bytes), requests: Math.round(reqs) });
      }
    }
    contentTypes.sort((a, b) => b.transferSizeBytes - a.transferSizeBytes);
  }

  const heaviestAssets: HeavyAsset[] = [];
  const assetsArr = Array.isArray(px?.assets) ? px.assets : [];
  for (const raw of assetsArr) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as JsonRecord;
    const url = typeof item.url === 'string' ? item.url : '';
    const type = typeof item.type === 'string' ? item.type : 'other';
    const bytes = typeof item.transferSize === 'number' ? item.transferSize : 0;
    if (url && bytes > 0) {
      heaviestAssets.push({ url, type, transferSizeBytes: Math.round(bytes) });
    }
  }
  heaviestAssets.sort((a, b) => b.transferSizeBytes - a.transferSizeBytes);

  return {
    categoryScores: {
      performance: getScore('performance'),
      bestpractice: getScore('bestpractice'),
      accessibility: getScore('accessibility'),
      privacy: getScore('privacy'),
    },
    milestones: {
      firstVisualChangeMs:
        getNestedNumber(bt, ['visualMetrics', 'FirstVisualChange', 'median']) ??
        getNestedNumber(bt, ['statistics', 'visualMetrics', 'FirstVisualChange', 'median']),
      domContentLoadedMs:
        getNestedNumber(bt, ['timings', 'pageTimings', 'domContentLoadedTime', 'median']) ??
        getNestedNumber(bt, ['statistics', 'timings', 'pageTimings', 'domContentLoadedTime', 'median']),
      visualComplete85Ms:
        getNestedNumber(bt, ['visualMetrics', 'VisualComplete85', 'median']) ??
        getNestedNumber(bt, ['statistics', 'visualMetrics', 'VisualComplete85', 'median']),
      lastVisualChangeMs:
        getNestedNumber(bt, ['visualMetrics', 'LastVisualChange', 'median']) ??
        getNestedNumber(bt, ['statistics', 'visualMetrics', 'LastVisualChange', 'median']),
    },
    contentTypes,
    heaviestAssets: heaviestAssets.slice(0, 10),
  };
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
    getNestedNumber(bt, ['googleWebVitals', 'firstContentfulPaint', 'median']) ??
    getNestedNumber(bt, ['timings', 'paintTiming', 'first-contentful-paint', 'median']) ??
    getNestedNumber(bt, ['statistics', 'googleWebVitals', 'firstContentfulPaint', 'median']) ??
    getNestedNumber(bt, ['statistics', 'timings', 'paintTiming', 'first-contentful-paint', 'median']) ??
    getNestedNumber(bt, ['firstPaint', 'median']);

  const lcpMs =
    getNestedNumber(bt, ['googleWebVitals', 'largestContentfulPaint', 'median']) ??
    getNestedNumber(bt, ['timings', 'largestContentfulPaint', 'renderTime', 'median']) ??
    getNestedNumber(bt, ['statistics', 'googleWebVitals', 'largestContentfulPaint', 'median']) ??
    getNestedNumber(bt, ['statistics', 'timings', 'largestContentfulPaint', 'renderTime', 'median']);

  const cls =
    getNestedNumber(bt, ['googleWebVitals', 'cumulativeLayoutShift', 'median']) ??
    getNestedNumber(bt, ['pageinfo', 'cumulativeLayoutShift', 'median']) ??
    getNestedNumber(bt, ['statistics', 'googleWebVitals', 'cumulativeLayoutShift', 'median']) ??
    getNestedNumber(bt, ['statistics', 'pageinfo', 'cumulativeLayoutShift', 'median']);

  const tbtMs =
    getNestedNumber(bt, ['googleWebVitals', 'totalBlockingTime', 'median']) ??
    getNestedNumber(bt, ['cpu', 'longTasks', 'totalBlockingTime', 'median']) ??
    getNestedNumber(bt, ['statistics', 'googleWebVitals', 'totalBlockingTime', 'median']) ??
    getNestedNumber(bt, ['statistics', 'cpu', 'longTasks', 'totalBlockingTime', 'median']);

  const ttfbMs =
    getNestedNumber(bt, ['googleWebVitals', 'ttfb', 'median']) ??
    getNestedNumber(bt, ['timings', 'ttfb', 'median']) ??
    getNestedNumber(bt, ['statistics', 'googleWebVitals', 'ttfb', 'median']) ??
    getNestedNumber(bt, ['statistics', 'timings', 'ttfb', 'median']);

  const speedIndexMs =
    getNestedNumber(bt, ['visualMetrics', 'SpeedIndex', 'median']) ??
    getNestedNumber(bt, ['statistics', 'visualMetrics', 'SpeedIndex', 'median']);

  const fullyLoadedMs =
    getNestedNumber(bt, ['timings', 'fullyLoaded', 'median']) ??
    getNestedNumber(bt, ['statistics', 'timings', 'fullyLoaded', 'median']);

  const pageSizeBytes =
    getNestedNumber(px, ['transferSize', 'median']) ??
    getNestedNumber(px, ['statistics', 'transferSize', 'median']) ??
    getNestedNumber(px, ['total', 'transferSize', 'median']) ??
    getNestedNumber(px, ['transferSize']);

  const requestsCount =
    getNestedNumber(px, ['requests', 'median']) ??
    getNestedNumber(px, ['statistics', 'requests', 'median']) ??
    getNestedNumber(px, ['total', 'requests', 'median']) ??
    getNestedNumber(px, ['requests']);

  const coachScore =
    getNestedNumber(coach, ['advice', 'score', 'median']) ??
    getNestedNumber(coach, ['advice', 'performance', 'score', 'median']) ??
    getNestedNumber(coach, ['advice', 'score']) ??
    getNestedNumber(coach, ['score', 'median']) ??
    (typeof coach?.score === 'number' ? coach.score : null);

  const adviceItems = extractCoachAdvice(coach);
  const details = extractRunDetails(bt, px, coach);

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
    adviceJson: adviceItems.length > 0 ? JSON.stringify(adviceItems) : null,
    detailsJson: JSON.stringify(details),
  };
}
