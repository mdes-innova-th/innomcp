import {
  fetchGroupsNames,
  fetchUrlsByViolationGroup,
  fetchUrlsByDateAndGroup,
  fetchUrlsByMonthAndGroup,
  fetchUrlProcessingTimes,
  fetchUrlsByDateAI,
  fetchUrlsByMonthAI,
} from "./urlstats";

/**
 * Helper to format dates.
 */
function formatDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatMonth(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

export async function fetchDashboardStats() {
  try {
    // Prepare date ranges
    const today = new Date();
    const endDate = formatDate(today);

    const d7 = new Date(today);
    d7.setDate(d7.getDate() - 6); // last 7 days including today
    const startDate7 = formatDate(d7);

    const d30 = new Date(today);
    d30.setDate(d30.getDate() - 29); // last 30 days including today
    const startDate30 = formatDate(d30);

    // Months: last 6 months
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const m = new Date(today.getFullYear(), today.getMonth() - i, 1);
      months.push(formatMonth(m));
    }
    const startMonth = months[0];
    const endMonth = months[months.length - 1];

    // Run queries in parallel
    const [
      groups,
      violationGroupsCount,
      byDateCount,
      byMonthCount,
      processingTime,
      byDateAI,
      byMonthAI,
    ] = await Promise.all([
      fetchGroupsNames(),
      fetchUrlsByViolationGroup(undefined, undefined, undefined, undefined),
      fetchUrlsByDateAndGroup(startDate7, endDate, undefined, undefined),
      fetchUrlsByMonthAndGroup(startMonth, endMonth, undefined, undefined),
      fetchUrlProcessingTimes(startDate30, endDate, undefined, undefined),
      fetchUrlsByDateAI(startDate7, endDate, undefined),
      fetchUrlsByMonthAI(startMonth, endMonth, undefined, undefined),
    ]);

    return {
      groups,
      violationGroupsCount,
      byDateCount,
      byMonthCount,
      processingTime,
      byDateAI,
      byMonthAI,
      meta: {
        generatedAt: new Date().toISOString(),
        range: {
          byDate: { start: startDate7, end: endDate },
          byMonth: { start: startMonth, end: endMonth },
          processingTime: { start: startDate30, end: endDate },
        },
      },
    };
  } catch (error) {
    console.log("[wsurlstats] Error fetching dashboard stats:", error);
    console.error("Error fetching dashboard stats:", error);
    // Return a minimal error object so the WebSocket sender can forward it
    return {
      error: true,
      message: "Failed to fetch dashboard stats",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export default fetchDashboardStats;
