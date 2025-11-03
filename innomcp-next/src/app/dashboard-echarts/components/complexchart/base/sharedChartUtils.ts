// Shared helpers used by multiple chart components
export function toDisplayDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function toIsoDate(display: string) {
  if (!display) return "";
  const [d, m, y] = display.split("/");
  if (!d || !m || !y) return "";
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export function validateDateRange(start: string, end: string): boolean {
  if (!start || !end) return true;
  const startDateTime = new Date(start);
  const endDateTime = new Date(end);
  return startDateTime <= endDateTime;
}

export function toDisplayMonth(iso: string) {
  if (!iso) return "";
  const [y, m] = iso.split("-");
  return `${m}/${y}`;
}

export function toIsoMonth(display: string) {
  if (!display) return "";
  const [m, y] = display.split("/");
  if (!m || !y) return "";
  return `${y}-${m.padStart(2, "0")}`;
}

export function validateMonthRange(start: string, end: string): boolean {
  if (!start || !end) return true;
  return new Date(start + "-01") <= new Date(end + "-01");
}

export function getDefaultDates(defaultDays = 30) {
  const today = new Date();
  const daysAgo = isNaN(defaultDays) ? 30 : defaultDays;
  const start = new Date();
  start.setDate(today.getDate() - daysAgo);
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: today.toISOString().split("T")[0],
  };
}

export function getDefaultMonths(defaultMonths = 6) {
  const thismonth = new Date();
  const monthsAgo = isNaN(defaultMonths) ? 6 : defaultMonths;
  const start = new Date(thismonth);
  start.setMonth(thismonth.getMonth() - monthsAgo);
  return {
    startMonth: start.toISOString().split("T")[0].slice(0, 7),
    endMonth: thismonth.toISOString().split("T")[0].slice(0, 7),
  };
}

export function mapChartType(chartType: string) {
  const mappedType:
    | "bar"
    | "line"
    | "pie"
    | "bubble"
    | "radar"
    | "area"
    | "scatter" =
    chartType === "area"
      ? "area"
      : chartType === "donut"
      ? "pie"
      : chartType === "radar"
      ? "radar"
      : (chartType as "bar" | "line" | "pie" | "bubble" | "scatter");
  const isArea = chartType === "area";
  return { mappedType, isArea };
}

export function getChartColorsFromCSS(): string[] {
  if (typeof window === "undefined") return [];
  const styles = getComputedStyle(document.documentElement);
  const colors: string[] = [];
  for (let i = 1; i <= 40; i++) {
    const color = styles.getPropertyValue(`--chart-color-${i}`).trim();
    if (color) colors.push(color);
  }
  return colors;
}
