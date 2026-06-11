// metricsCollector.ts
// Prometheus-compatible metrics for INNOMCP Node.js
// TypeScript strict, no external dependencies

type LabelValues = Record<string, string>;

function formatLabels(labels: LabelValues): string {
  const entries = Object.entries(labels)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return '';
  const parts = entries.map(([k, v]) => `${k}="${v}"`);
  return `{${parts.join(',')}}`;
}

abstract class Metric<T> {
  protected readonly labelNames: string[];
  protected readonly labelMap: Map<string, T>;

  constructor(labelNames: string[] = []) {
    this.labelNames = labelNames;
    this.labelMap = new Map();
  }

  protected key(labels: LabelValues): string {
    // Validates that label keys match declared names
    const keys = Object.keys(labels);
    if (keys.length !== this.labelNames.length) {
      throw new Error(`Expected labels ${this.labelNames}, got ${keys}`);
    }
    for (const k of keys) {
      if (!this.labelNames.includes(k)) {
        throw new Error(`Unexpected label '${k}'`);
      }
    }
    const sorted = this.labelNames.map((name) => labels[name] ?? '');
    return JSON.stringify(sorted);
  }

  protected getOrCreate(labels: LabelValues, createFn: () => T): T {
    const k = this.key(labels);
    if (!this.labelMap.has(k)) {
      this.labelMap.set(k, createFn());
    }
    return this.labelMap.get(k)!;
  }

  abstract help: string;
  abstract type: 'counter' | 'gauge' | 'histogram';

  abstract exportLines(name: string): string;
}

class Counter extends Metric<number> {
  public help: string;
  public readonly type = 'counter';

  constructor(help: string, labelNames: string[] = []) {
    super(labelNames);
    this.help = help;
  }

  inc(labels: LabelValues = {}, value = 1): void {
    const prev = this.getOrCreate(labels, () => 0);
    const k = this.key(labels);
    this.labelMap.set(k, prev + value);
  }

  get(labels: LabelValues = {}): number {
    const k = this.key(labels);
    return this.labelMap.get(k) ?? 0;
  }

  exportLines(name: string): string {
    let out = '';
    for (const [key, value] of this.labelMap.entries()) {
      const labels = JSON.parse(key) as string[];
      const labelObj: LabelValues = {};
      this.labelNames.forEach((name, i) => {
        labelObj[name] = labels[i];
      });
      out += `${name}${formatLabels(labelObj)} ${value}\n`;
    }
    return out;
  }
}

class Gauge extends Metric<number> {
  public help: string;
  public readonly type = 'gauge';

  constructor(help: string, labelNames: string[] = []) {
    super(labelNames);
    this.help = help;
  }

  set(labels: LabelValues = {}, value: number): void {
    const k = this.key(labels);
    this.labelMap.set(k, value);
  }

  inc(labels: LabelValues = {}, value = 1): void {
    const newVal = this.getOrCreate(labels, () => 0) + value;
    const k = this.key(labels);
    this.labelMap.set(k, newVal);
  }

  dec(labels: LabelValues = {}, value = 1): void {
    this.inc(labels, -value);
  }

  get(labels: LabelValues = {}): number {
    const k = this.key(labels);
    return this.labelMap.get(k) ?? 0;
  }

  exportLines(name: string): string {
    let out = '';
    for (const [key, value] of this.labelMap.entries()) {
      const labels = JSON.parse(key) as string[];
      const labelObj: LabelValues = {};
      this.labelNames.forEach((name, i) => {
        labelObj[name] = labels[i];
      });
      out += `${name}${formatLabels(labelObj)} ${value}\n`;
    }
    return out;
  }
}

class Histogram extends Metric<{
  buckets: number[];
  count: number;
  sum: number;
  bucketCounts: number[]; // aligned with buckets + Inf
}> {
  public help: string;
  public readonly type = 'histogram';
  public readonly buckets: number[];

  constructor(help: string, buckets: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10], labelNames: string[] = []) {
    super(labelNames);
    this.help = help;
    this.buckets = [...buckets].sort((a, b) => a - b); // ensure sorted
  }

  observe(labels: LabelValues = {}, value: number): void {
    const data = this.getOrCreate(labels, () => ({
      buckets: [...this.buckets],
      count: 0,
      sum: 0,
      bucketCounts: new Array(this.buckets.length + 1).fill(0), // last is +Inf
    }));
    const idx = this.buckets.findIndex((b) => value <= b);
    const bucketIdx = idx === -1 ? this.buckets.length : idx; // +Inf bucket if not matched
    data.bucketCounts[bucketIdx]++;
    data.count++;
    data.sum += value;
  }

  getCount(labels: LabelValues = {}): number {
    const k = this.key(labels);
    return this.labelMap.get(k)?.count ?? 0;
  }

  getSum(labels: LabelValues = {}): number {
    const k = this.key(labels);
    return this.labelMap.get(k)?.sum ?? 0;
  }

  exportLines(name: string): string {
    let out = '';
    for (const [key, data] of this.labelMap.entries()) {
      const labels = JSON.parse(key) as string[];
      const labelObj: LabelValues = {};
      this.labelNames.forEach((name, i) => {
        labelObj[name] = labels[i];
      });
      const labelsStr = formatLabels(labelObj);

      // Bucket lines
      let cumulative = 0;
      for (let i = 0; i < this.buckets.length; i++) {
        cumulative += data.bucketCounts[i];
        const leLabel = { ...labelObj, le: String(this.buckets[i]) };
        out += `${name}_bucket${formatLabels(leLabel)} ${cumulative}\n`;
      }
      // +Inf bucket
      cumulative += data.bucketCounts[this.buckets.length];
      const infLabel = { ...labelObj, le: '+Inf' };
      out += `${name}_bucket${formatLabels(infLabel)} ${cumulative}\n`;

      // sum and count
      out += `${name}_sum${labelsStr} ${data.sum}\n`;
      out += `${name}_count${labelsStr} ${data.count}\n`;
    }
    return out;
  }
}

export class MetricsCollector {
  private metrics: Array<{ name: string; metric: Metric<any> }> = [];

  // Built-in metrics (readonly)
  public readonly http_requests_total: Counter;
  public readonly http_request_duration_ms: Histogram;
  public readonly ai_requests_total: Counter;
  public readonly ai_tokens_used: Counter;
  public readonly active_sessions: Gauge;
  public readonly mdes_latency_ms: Histogram;

  constructor() {
    // Initialize built-in metrics and register them automatically
    this.http_requests_total = this.counter('http_requests_total', 'Total HTTP requests handled');
    this.http_request_duration_ms = this.histogram('http_request_duration_ms', 'HTTP request duration in milliseconds');
    this.ai_requests_total = this.counter('ai_requests_total', 'Total AI API requests');
    this.ai_tokens_used = this.counter('ai_tokens_used', 'Total AI tokens consumed');
    this.active_sessions = this.gauge('active_sessions', 'Number of active client sessions');
    this.mdes_latency_ms = this.histogram('mdes_latency_ms', 'Ministry of DE latency in milliseconds');
  }

  counter(name: string, help: string, labels?: string[]): Counter {
    this.validateMetricName(name);
    const c = new Counter(help, labels ?? []);
    this.metrics.push({ name, metric: c });
    return c;
  }

  gauge(name: string, help: string, labels?: string[]): Gauge {
    this.validateMetricName(name);
    const g = new Gauge(help, labels ?? []);
    this.metrics.push({ name, metric: g });
    return g;
  }

  histogram(name: string, help: string, buckets?: number[]): Histogram {
    this.validateMetricName(name);
    const h = new Histogram(help, buckets);
    this.metrics.push({ name, metric: h });
    return h;
  }

  export(): string {
    const lines: string[] = [];
    for (const { name, metric } of this.metrics) {
      lines.push(`# HELP ${name} ${metric.help}`);
      lines.push(`# TYPE ${name} ${metric.type}`);
      lines.push(metric.exportLines(name));
    }
    return lines.join('\n') + (lines.length > 0 ? '\n' : '');
  }

  private validateMetricName(name: string): void {
    if (!/^[a-zA-Z_:][a-zA-Z0-9_:]*$/.test(name)) {
      throw new Error(`Invalid metric name: ${name}`);
    }
    if (this.metrics.some((m) => m.name === name)) {
      throw new Error(`Metric ${name} already registered`);
    }
  }
}

// Singleton instance for the application
export const metrics = new MetricsCollector();