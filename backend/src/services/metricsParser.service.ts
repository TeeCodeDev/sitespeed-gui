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
  const inner =
    (coach.coach && typeof coach.coach === 'object' ? (coach.coach as JsonRecord) : null) ?? coach;
  const pageSummary =
    (inner.pageSummary && typeof inner.pageSummary === 'object'
      ? (inner.pageSummary as JsonRecord)
      : null) ?? inner;
  const adviceRoot =
    (pageSummary.advice && typeof pageSummary.advice === 'object'
      ? (pageSummary.advice as JsonRecord)
      : null) ?? pageSummary;

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
  status?: number | null;
  transferSizeBytes: number;
  contentSizeBytes?: number | null;
  expires?: string | null;
}

interface StatRow {
  label: string;
  min: number | null;
  median: number | null;
  p90: number | null;
  max: number | null;
  unit: string;
}

interface DomainBreakdown {
  domain: string;
  transferSizeBytes: number;
  requests: number;
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
  detailedStats: StatRow[];
  contentTypes: ContentTypeBreakdown[];
  heaviestAssets: HeavyAsset[];
  allAssets: HeavyAsset[];
  domains: DomainBreakdown[];
  firstPartyBytes: number | null;
  firstPartyRequests: number | null;
  thirdPartyBytes: number | null;
  thirdPartyRequests: number | null;
  responseCodes: Record<string, number>;
}

function extractRunDetails(
  bt: JsonRecord | null,
  pxSummary: JsonRecord | null,
  pxPage: JsonRecord | null,
  coach: JsonRecord | null
): RunDetails {
  const adviceRoot =
    (coach?.advice && typeof coach.advice === 'object' ? (coach.advice as JsonRecord) : null) ?? coach;

  const getScore = (cat: string) =>
    getNestedNumber(adviceRoot, [cat, 'score', 'median']) ??
    getNestedNumber(adviceRoot, [cat, 'score']);

  const px = pxSummary ?? pxPage;
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

  const assetSource = pxPage ?? pxSummary;
  const allAssets: HeavyAsset[] = [];
  const assetsArr = Array.isArray(assetSource?.assets) ? assetSource.assets : [];
  for (const raw of assetsArr) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as JsonRecord;
    const url = typeof item.url === 'string' ? item.url : '';
    const type = typeof item.type === 'string' ? item.type : 'other';
    const bytes = typeof item.transferSize === 'number' ? item.transferSize : 0;
    const contentBytes = typeof item.contentSize === 'number' ? Math.round(item.contentSize) : null;
    const status = typeof item.status === 'number' ? item.status : null;
    const expires = typeof item.expires === 'string' ? item.expires : null;
    if (url) {
      allAssets.push({
        url,
        type,
        status,
        transferSizeBytes: Math.round(bytes),
        contentSizeBytes: contentBytes,
        expires,
      });
    }
  }
  allAssets.sort((a, b) => b.transferSizeBytes - a.transferSizeBytes);
  const heaviestAssets = allAssets.slice(0, 15);

  const extractStat = (label: string, paths: string[][], unit = 'ms'): StatRow | null => {
    for (const p of paths) {
      const median = getNestedNumber(bt, [...p, 'median']);
      if (median !== null) {
        return {
          label,
          min: getNestedNumber(bt, [...p, 'min']),
          median,
          p90: getNestedNumber(bt, [...p, 'p90']),
          max: getNestedNumber(bt, [...p, 'max']),
          unit,
        };
      }
    }
    return null;
  };

  const detailedStats: StatRow[] = [
    extractStat('Largest Contentful Paint (LCP)', [
      ['googleWebVitals', 'largestContentfulPaint'],
      ['timings', 'largestContentfulPaint', 'renderTime'],
      ['statistics', 'googleWebVitals', 'largestContentfulPaint'],
    ]),
    extractStat('First Contentful Paint (FCP)', [
      ['googleWebVitals', 'firstContentfulPaint'],
      ['timings', 'paintTiming', 'first-contentful-paint'],
      ['statistics', 'googleWebVitals', 'firstContentfulPaint'],
    ]),
    extractStat('Cumulative Layout Shift (CLS)', [
      ['googleWebVitals', 'cumulativeLayoutShift'],
      ['pageinfo', 'cumulativeLayoutShift'],
    ], ''),
    extractStat('Total Blocking Time (TBT)', [
      ['googleWebVitals', 'totalBlockingTime'],
      ['cpu', 'longTasks', 'totalBlockingTime'],
    ]),
    extractStat('Time to First Byte (TTFB)', [
      ['googleWebVitals', 'ttfb'],
      ['timings', 'ttfb'],
    ]),
    extractStat('Speed Index', [
      ['visualMetrics', 'SpeedIndex'],
      ['statistics', 'visualMetrics', 'SpeedIndex'],
    ]),
    extractStat('First Visual Change', [
      ['visualMetrics', 'FirstVisualChange'],
      ['statistics', 'visualMetrics', 'FirstVisualChange'],
    ]),
    extractStat('Visual Complete 85%', [
      ['visualMetrics', 'VisualComplete85'],
      ['statistics', 'visualMetrics', 'VisualComplete85'],
    ]),
    extractStat('Last Visual Change', [
      ['visualMetrics', 'LastVisualChange'],
      ['statistics', 'visualMetrics', 'LastVisualChange'],
    ]),
    extractStat('DOM Content Loaded', [
      ['timings', 'pageTimings', 'domContentLoadedTime'],
      ['statistics', 'timings', 'pageTimings', 'domContentLoadedTime'],
    ]),
    extractStat('Fully Loaded', [
      ['timings', 'fullyLoaded'],
      ['statistics', 'timings', 'fullyLoaded'],
    ]),
  ].filter((s): s is StatRow => s !== null);

  const domains: DomainBreakdown[] = [];
  const domainsRoot =
    assetSource?.domains && typeof assetSource.domains === 'object'
      ? (assetSource.domains as JsonRecord)
      : null;
  if (domainsRoot) {
    for (const [domain, val] of Object.entries(domainsRoot)) {
      if (!val || typeof val !== 'object') continue;
      const obj = val as JsonRecord;
      const bytes =
        getNestedNumber(obj, ['transferSize', 'median']) ??
        (typeof obj.transferSize === 'number' ? obj.transferSize : 0);
      const reqs =
        getNestedNumber(obj, ['requests', 'median']) ??
        (typeof obj.requests === 'number' ? obj.requests : 0);
      domains.push({ domain, transferSizeBytes: Math.round(bytes), requests: Math.round(reqs) });
    }
    domains.sort((a, b) => b.transferSizeBytes - a.transferSizeBytes);
  }

  const responseCodes: Record<string, number> = {};
  const codesRoot =
    (px?.responseCodes && typeof px.responseCodes === 'object' ? (px.responseCodes as JsonRecord) : null) ??
    (assetSource?.responseCodes && typeof assetSource.responseCodes === 'object'
      ? (assetSource.responseCodes as JsonRecord)
      : null);
  if (codesRoot) {
    for (const [code, val] of Object.entries(codesRoot)) {
      const n = getNestedNumber(codesRoot, [code, 'median']) ?? (typeof val === 'number' ? val : null);
      if (n !== null && n > 0) responseCodes[code] = Math.round(n);
    }
  }

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
    detailedStats,
    contentTypes,
    heaviestAssets,
    allAssets: allAssets.slice(0, 250),
    domains: domains.slice(0, 25),
    firstPartyBytes:
      getNestedNumber(px, ['firstParty', 'transferSize', 'median']) ??
      getNestedNumber(assetSource, ['firstParty', 'transferSize']),
    firstPartyRequests:
      getNestedNumber(px, ['firstParty', 'requests', 'median']) ??
      getNestedNumber(assetSource, ['firstParty', 'requests']),
    thirdPartyBytes:
      getNestedNumber(px, ['thirdParty', 'transferSize', 'median']) ??
      getNestedNumber(assetSource, ['thirdParty', 'transferSize']),
    thirdPartyRequests:
      getNestedNumber(px, ['thirdParty', 'requests', 'median']) ??
      getNestedNumber(assetSource, ['thirdParty', 'requests']),
    responseCodes,
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

  const pagexraySummaryFile = files.find((f) => f.endsWith('pagexray.summary-total.json'));
  const pagexrayPageFile = files.find((f) => f.endsWith('pagexray.pageSummary.json'));

  const coachPageFile = files.find((f) => f.endsWith('coach.pageSummary.json'));
  const coachSummaryFile = files.find((f) => f.endsWith('coach.summary-total.json'));

  const videoFile = files.find((f) => f.endsWith('.mp4'));
  const harFile = files.find((f) => f.endsWith('.har') || f.endsWith('.har.gz'));

  const bt = browsertimeFile ? await readJsonSafe(browsertimeFile) : null;
  const pxSummary = pagexraySummaryFile ? await readJsonSafe(pagexraySummaryFile) : null;
  const pxPage = pagexrayPageFile ? await readJsonSafe(pagexrayPageFile) : null;
  const px = pxSummary ?? pxPage;
  const coach =
    (coachPageFile ? await readJsonSafe(coachPageFile) : null) ??
    (coachSummaryFile ? await readJsonSafe(coachSummaryFile) : null);

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
  const details = extractRunDetails(bt, pxSummary, pxPage, coach);

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
