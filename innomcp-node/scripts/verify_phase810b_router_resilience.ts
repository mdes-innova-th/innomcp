import fs from 'fs';
import path from 'path';

type Case = {
  name: string;
  query: string;
  expectCategory: string;
  expectKeywordSource: 'snapshot' | 'defaults';
  maxMs?: number;
};

function isoStampForFilename(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(`TIMEOUT ${label} after ${ms}ms`)), ms);
  });

  try {
    return await Promise.race([p, timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

async function main() {
  const startedAt = new Date();
  const evidenceDir = path.resolve(__dirname, '../evidence');
  ensureDir(evidenceDir);

  const evidenceFile = path.join(
    evidenceDir,
    `phase810b-router-resilience-${isoStampForFilename(startedAt)}.log`
  );

  const out: string[] = [];
  const log = (line: string) => {
    out.push(line);
    // keep console minimal; evidence is the main artifact
    console.log(line);
  };

  // Force deterministic environment before importing router (CONFIG reads env at import time).
  process.env.TS_NODE_CACHE = 'false';
  process.env.LOG_MODE = 'prod';
  process.env.CHAT_TRACE_QA = '0';
  process.env.LOG_DEBUG = '0';

  const cases: Case[] = [
    {
      name: 'snapshot-weather-strong',
      query: 'พยากรณ์ อากาศ ฝน อุณหภูมิ กรมอุตุนิยมวิทยา',
      expectCategory: 'weather',
      expectKeywordSource: 'snapshot',
      maxMs: 2000,
    },
    {
      name: 'snapshot-calculator-strong',
      query: 'คำนวณ sin(1) sqrt 2+2=',
      expectCategory: 'calculator',
      expectKeywordSource: 'snapshot',
      maxMs: 2000,
    },
    {
      name: 'snapshot-datetime-strong',
      query: 'วันนี้ เวลา timezone date time utc timestamp',
      expectCategory: 'datetime',
      expectKeywordSource: 'snapshot',
      maxMs: 2000,
    },
    {
      name: 'snapshot-worldbank-strong',
      query: 'worldbank gdp economic inflation per capita ประชากร',
      expectCategory: 'worldbank',
      expectKeywordSource: 'snapshot',
      maxMs: 2000,
    },
    {
      name: 'snapshot-evidence-strong',
      query: 'ตรวจสอบหลักฐาน หลักฐานค้าง evidence threat online offline',
      expectCategory: 'evidence',
      expectKeywordSource: 'snapshot',
      maxMs: 2000,
    },
    {
      name: 'defaults-weather',
      query: 'พยากรณ์ อากาศ ฝน อุณหภูมิ',
      expectCategory: 'weather',
      expectKeywordSource: 'defaults',
      maxMs: 2000,
    },
  ];

  let pass = 0;
  let fail = 0;

  log(`PHASE=8.10B`);
  log(`START=${startedAt.toISOString()}`);
  log(`CASES=${cases.length}`);

  for (const c of cases) {
    const perCaseStart = Date.now();

    // Create an isolated router instance per case to avoid cross-case state.
    const keywordMode = c.expectKeywordSource;
    process.env.GODTIER_KEYWORDS_SOURCE = keywordMode;

    const { GodTierRouter } = await import('../src/utils/mcp/godTierRouter');
    const router = new GodTierRouter();

    try {
      const result = await withTimeout(
        router.route(c.query, [], 'remote'),
        c.maxMs ?? 2000,
        c.name
      );

      const okCategory = result.category === c.expectCategory;
      const okSource = (result as any).keywordSource === c.expectKeywordSource;
      const okNoFallback = result.usedFallback === false;

      const ms = Date.now() - perCaseStart;
      const status = okCategory && okSource && okNoFallback ? 'PASS' : 'FAIL';

      if (status === 'PASS') pass += 1;
      else fail += 1;

      log(
        [
          `CASE=${c.name}`,
          `STATUS=${status}`,
          `ms=${ms}`,
          `category=${result.category}`,
          `keywordSource=${(result as any).keywordSource}`,
          `usedFallback=${String(result.usedFallback)}`,
          `confidence=${Number(result.confidence).toFixed(3)}`,
        ].join(' | ')
      );

      if (status !== 'PASS') {
        log(
          `DETAIL expectedCategory=${c.expectCategory} expectedKeywordSource=${c.expectKeywordSource} expectedUsedFallback=false`
        );
        log(`DETAIL reasoning=${String(result.reasoning || '').slice(0, 200)}`);
      }
    } catch (err) {
      fail += 1;
      log(`CASE=${c.name} | STATUS=FAIL | err=${String(err)}`);
    }
  }

  const finishedAt = new Date();
  log(`END=${finishedAt.toISOString()}`);
  log(`PASS_COUNT=${pass}/${cases.length}`);
  log(`RESULT=${fail === 0 ? 'PASS' : 'FAIL'}`);
  log(`EVIDENCE=${evidenceFile}`);

  fs.writeFileSync(evidenceFile, out.join('\n') + '\n', { encoding: 'utf8' });

  if (fail !== 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
