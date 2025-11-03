import express from "express";
import {
  fetchGroupsNames,
  fetchUrlsByViolationGroup,
  fetchUrlsByDateAndGroup,
  fetchUrlsByMonthAndGroup,
  fetchUrlProcessingTimes,
  fetchUrlsByDateAI,
  fetchUrlsByMonthAI,
  fetchTotalUrlCount,
  fetchPetitionUrlCount,
  fetchCourtUrlCount,
  fetchAIUrlCount,
  fetchTopOffice,
  fetchTopCategory,
  fetchTopCourt,
  fetchYearlyTrends,
  fetchMonthlyTrends,
  fetchProcessTimes,
  fetchTodayByOffice,
  fetchUrlStatsByPlatform,
  fetchUrlStatsByRegisterCountry,
} from "../../utils/urlstats";
import { sendResponse, sendErrorResponse } from "../../utils/response";

const urlStatsRouter = express.Router();

// Simple WS-adapter type so we don't have to import ws into each file that needs to send
export type SimpleWS = {
  send: (payload: string) => void;
  readyState?: number;
};

const WS_OPEN = 1;

/**
 * Stream dashboard/chart updates over a WebSocket-like object.
 * The function accepts an object with optional filters; clients may send
 * messages of shape { type: 'update', payload: { ...filters } } to request
 * immediate refresh. The server will also periodically send updates.
 */
export async function streamUrlStatsWS(
  ws: SimpleWS,
  filters?: Record<string, any>
) {
  try {
    // Determine which datasets to send based on filters; by default send all
    const {
      startDate,
      endDate,
      startMonth,
      endMonth,
      sourceType,
      selectedGroups,
      durationType,
    } = filters || {};

    // Fetch datasets in parallel
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
      fetchUrlsByViolationGroup(startDate, endDate, sourceType, selectedGroups),
      fetchUrlsByDateAndGroup(startDate, endDate, sourceType, selectedGroups),
      fetchUrlsByMonthAndGroup(
        startMonth,
        endMonth,
        sourceType,
        selectedGroups
      ),
      fetchUrlProcessingTimes(startDate, endDate, sourceType, durationType),
      fetchUrlsByDateAI(startDate, endDate, sourceType),
      fetchUrlsByMonthAI(startMonth, endMonth, sourceType, selectedGroups),
    ]);

    const payload = {
      event: "urlstats:update",
      data: {
        groups,
        violationGroupsCount,
        byDateCount,
        byMonthCount,
        processingTime,
        byDateAI,
        byMonthAI,
      },
      generatedAt: new Date().toISOString(),
    };

    if (ws.readyState === undefined || ws.readyState === WS_OPEN) {
      ws.send(JSON.stringify(payload));
    }
    return payload;
  } catch (error) {
    console.log("[api-urlstats] Error streaming URL stats via WS:", error);
    const errPayload = {
      event: "urlstats:error",
      error: true,
      message: error instanceof Error ? error.message : String(error),
    };
    try {
      if (ws.readyState === undefined || ws.readyState === WS_OPEN) {
        ws.send(JSON.stringify(errPayload));
      }
    } catch (e) {
      // ignore
    }
    return errPayload;
  }
}

// API endpoint to get only violation group names (ประเภทความผิด)
urlStatsRouter.get("/violation-groups", function (req, res) {
  (async () => {
    try {
      const groups = await fetchGroupsNames();
      if (!groups || groups.length === 0) {
        return sendErrorResponse(res, 404, "No violation groups found");
      }
      return sendResponse(res, 200, groups);
    } catch (error) {
      console.log(
        "[api-urlstats] catch-Error fetching violation groups:",
        error
      );
      return sendErrorResponse(res, 500, "Failed to fetch violation groups");
    }
  })();
});

// API endpoint to get URL counts by violation group
urlStatsRouter.post("/violation-groups-count", function (req, res) {
  (async () => {
    try {
      const { startDate, endDate, sourceType, selectedGroups } = req.body;

      // Validate date formats if provided
      if (
        (startDate &&
          !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(startDate as string)) ||
        (endDate && !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(endDate as string))
      ) {
        return sendErrorResponse(
          res,
          400,
          "Invalid date format. Use YYYY-MM-DD format."
        );
      }

      // Validate date range if both dates are provided
      if (startDate && endDate) {
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);
        if (start > end) {
          return sendErrorResponse(
            res,
            400,
            "Start date must not be later than end date."
          );
        }
      }

      const stats = await fetchUrlsByViolationGroup(
        startDate as string | undefined,
        endDate as string | undefined,
        sourceType as string | undefined,
        selectedGroups as string[] | undefined
      );

      return sendResponse(res, 200, stats);
    } catch (error) {
      console.log(
        "[api-urlstats] catch-Error fetching URL violation group statistics:",
        error
      );
      return sendErrorResponse(res, 500, "Failed to fetch URL statistics");
    }
  })();
});

// API endpoint to get total URL count for donut chart
urlStatsRouter.get("/total-count", function (req, res) {
  (async () => {
    try {
      const stats = await fetchTotalUrlCount();
      if (!stats || stats.length === 0) {
        return sendErrorResponse(res, 404, "No URL count data found");
      }
      return sendResponse(res, 200, stats);
    } catch (error) {
      console.log(
        "[api-urlstats] catch-Error fetching total URL count:",
        error
      );
      return sendErrorResponse(res, 500, "Failed to fetch total URL count");
    }
  })();
});

// API endpoint to get petition URL count
urlStatsRouter.get("/petition-count", function (req, res) {
  (async () => {
    try {
      const stats = await fetchPetitionUrlCount();
      if (!stats || stats.length === 0) {
        return sendErrorResponse(res, 404, "No petition URL count data found");
      }
      return sendResponse(res, 200, stats);
    } catch (error) {
      console.log(
        "[api-urlstats] catch-Error fetching petition URL count:",
        error
      );
      return sendErrorResponse(res, 500, "Failed to fetch petition URL count");
    }
  })();
});

// API endpoint to get court URL count
urlStatsRouter.get("/court-count", function (req, res) {
  (async () => {
    try {
      const stats = await fetchCourtUrlCount();
      if (!stats || stats.length === 0) {
        return sendErrorResponse(res, 404, "No court URL count data found");
      }
      return sendResponse(res, 200, stats);
    } catch (error) {
      console.log(
        "[api-urlstats] catch-Error fetching court URL count:",
        error
      );
      return sendErrorResponse(res, 500, "Failed to fetch court URL count");
    }
  })();
});

// API endpoint to get monthly trends with top categories per month
urlStatsRouter.get("/monthly-trends", function (req, res) {
  (async () => {
    try {
      const monthsBack = parseInt(req.query.monthsBack as string) || 5;
      const toprank = parseInt(req.query.toprank as string) || 2;

      const stats = await fetchMonthlyTrends(monthsBack, toprank);
      if (!stats || stats.length === 0) {
        return sendErrorResponse(res, 404, "No monthly trends data found");
      }
      return sendResponse(res, 200, stats);
    } catch (error) {
      console.log("[api-urlstats] catch-Error fetching monthly trends:", error);
      return sendErrorResponse(res, 500, "Failed to fetch monthly trends");
    }
  })();
});

// API endpoint to get AI imported URL count
urlStatsRouter.get("/ai-count", function (req, res) {
  (async () => {
    try {
      const stats = await fetchAIUrlCount();
      if (!stats || stats.length === 0) {
        return sendErrorResponse(res, 404, "No AI URL count data found");
      }
      return sendResponse(res, 200, stats);
    } catch (error) {
      console.log("[api-urlstats] catch-Error fetching AI URL count:", error);
      return sendErrorResponse(res, 500, "Failed to fetch AI URL count");
    }
  })();
});

// API endpoint to get URL counts by date and violation group
urlStatsRouter.post("/by-date-count", function (req, res) {
  (async () => {
    try {
      const { startDate, endDate, sourceType, selectedGroups } = req.body;

      // Validate date formats if provided
      if (
        (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate as string)) ||
        (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate as string))
      ) {
        return sendErrorResponse(
          res,
          400,
          "Invalid date format. Use YYYY-MM-DD format."
        );
      }

      // Validate date range if both dates are provided
      if (startDate && endDate) {
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);
        if (start > end) {
          return sendErrorResponse(
            res,
            400,
            "Start date must not be later than end date."
          );
        }
      }

      const stats = await fetchUrlsByDateAndGroup(
        startDate as string | undefined,
        endDate as string | undefined,
        sourceType as string | undefined,
        selectedGroups as string[] | undefined
      );

      return sendResponse(res, 200, stats);
    } catch (error) {
      console.log(
        "[api-urlstats] catch-Error fetching URL date statistics:",
        error
      );
      return sendErrorResponse(res, 500, "Failed to fetch URL statistics");
    }
  })();
});

// API endpoint to get URL counts by month and violation group
urlStatsRouter.post("/by-month-count", function (req, res) {
  (async () => {
    try {
      const { startMonth, endMonth, sourceType, selectedGroups } = req.body;

      // Validate month formats if provided
      if (
        (startMonth && !/^\d{4}-\d{2}$/.test(startMonth as string)) ||
        (endMonth && !/^\d{4}-\d{2}$/.test(endMonth as string))
      ) {
        return sendErrorResponse(
          res,
          400,
          "Invalid month format. Use YYYY-MM format."
        );
      }

      // Validate month range if both provided
      if (startMonth && endMonth && startMonth > endMonth) {
        return sendErrorResponse(
          res,
          400,
          "Start month must not be later than end month."
        );
      }

      const stats = await fetchUrlsByMonthAndGroup(
        startMonth as string | undefined,
        endMonth as string | undefined,
        sourceType as string | undefined,
        selectedGroups as string[] | undefined
      );

      return sendResponse(res, 200, stats);
    } catch (error) {
      console.log(
        "[api-urlstats] catch-Error fetching URL monthly statistics:",
        error
      );
      return sendErrorResponse(
        res,
        500,
        "Failed to fetch URL monthly statistics"
      );
    }
  })();
});

// New API endpoint to get URL processing times with sourceType and durationType
urlStatsRouter.post("/processing-time", function (req, res) {
  (async () => {
    try {
      const { startDate, endDate, sourceType, durationType } = req.body;

      // Validate date formats if provided
      if (
        (startDate &&
          !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(startDate as string)) ||
        (endDate && !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(endDate as string))
      ) {
        return sendErrorResponse(
          res,
          400,
          "Invalid date format. Use YYYY-MM-DD format."
        );
      }

      // Validate date range if both dates are provided
      if (startDate && endDate) {
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);
        if (start > end) {
          return sendErrorResponse(
            res,
            400,
            "Start date must not be later than end date."
          );
        }
      }

      // Always return processing time in hours (no day calculation)
      const stats = await fetchUrlProcessingTimes(
        startDate as string | undefined,
        endDate as string | undefined,
        sourceType as string | undefined,
        durationType as string | undefined
      );

      // Filter out any NaN or null values in the result to prevent frontend chart errors
      const safeStats = (Array.isArray(stats) ? stats : []).map((item) => {
        const safeItem = { ...item };
        Object.keys(safeItem).forEach((key) => {
          if (
            typeof safeItem[key] === "number" &&
            (isNaN(safeItem[key]) || safeItem[key] == null)
          ) {
            safeItem[key] = 0;
          }
        });
        return safeItem;
      });

      return sendResponse(res, 200, safeStats);
    } catch (error) {
      console.log(
        "[api-urlstats] catch-Error fetching URL processing time statistics:",
        error
      );
      return sendErrorResponse(
        res,
        500,
        "Failed to fetch URL processing time statistics"
      );
    }
  })();
});

// API endpoint: เว็บไซต์ผิดกฎหมายที่นำเข้าโดยโครงการ AI (แยกตามวันที่)
urlStatsRouter.post("/by-date-ai-count", function (req, res) {
  (async () => {
    try {
      const { startDate, endDate, sourceType } = req.body;
      // Validate date formats if provided
      if (
        (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate as string)) ||
        (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate as string))
      ) {
        return sendErrorResponse(
          res,
          400,
          "Invalid date format. Use YYYY-MM-DD format."
        );
      }
      // Validate date range if both dates are provided
      if (startDate && endDate) {
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);
        if (start > end) {
          return sendErrorResponse(
            res,
            400,
            "Start date must not be later than end date."
          );
        }
      }
      const results = await fetchUrlsByDateAI(
        startDate as string | undefined,
        endDate as string | undefined,
        sourceType as string | undefined
      );
      return sendResponse(res, 200, results);
    } catch (error) {
      console.log(
        "[api-urlstats] catch-Error fetching AI daily violation data:",
        error,
        error instanceof Error ? error.stack : undefined
      ); // เพิ่ม log stack
      return sendErrorResponse(
        res,
        500,
        "Failed to fetch AI daily violation data"
      );
    }
  })();
});

// API endpoint: เว็บไซต์ผิดกฎหมายที่นำเข้าโดยโครงการ AI (แยกตามเดือน)
urlStatsRouter.post("/by-month-ai-count", function (req, res) {
  (async () => {
    try {
      const { startMonth, endMonth, sourceType, selectedGroups } = req.body;
      // Validate month formats if provided
      if (
        (startMonth && !/^\d{4}-\d{2}$/.test(startMonth as string)) ||
        (endMonth && !/^\d{4}-\d{2}$/.test(endMonth as string))
      ) {
        return sendErrorResponse(
          res,
          400,
          "Invalid month format. Use YYYY-MM format."
        );
      }
      // Validate month range if both provided
      if (startMonth && endMonth && startMonth > endMonth) {
        return sendErrorResponse(
          res,
          400,
          "Start month must not be later than end month."
        );
      }
      const results = await fetchUrlsByMonthAI(
        startMonth as string | undefined,
        endMonth as string | undefined,
        sourceType as string | undefined,
        selectedGroups as string[] | undefined
      );
      return sendResponse(res, 200, results);
    } catch (error) {
      console.log(
        "[api-urlstats] catch-Error fetching AI monthly violation data:",
        error,
        error instanceof Error ? error.stack : undefined
      );
      return sendErrorResponse(
        res,
        500,
        "Failed to fetch AI monthly violation data"
      );
    }
  })();
});

// API endpoint to get top organizations by URL count
urlStatsRouter.get("/topoffice", function (req, res) {
  (async () => {
    try {
      const stats = await fetchTopOffice();
      if (!stats || stats.length === 0) {
        return sendErrorResponse(res, 404, "No top organizations data found");
      }
      return sendResponse(res, 200, stats);
    } catch (error) {
      console.log(
        "[api-urlstats] catch-Error fetching top organizations:",
        error
      );
      return sendErrorResponse(res, 500, "Failed to fetch top organizations");
    }
  })();
});

// API endpoint to get top categories by contract compliance rate
urlStatsRouter.get("/topcategory", function (req, res) {
  (async () => {
    try {
      const stats = await fetchTopCategory();
      if (!stats || stats.length === 0) {
        return sendErrorResponse(res, 404, "No top categories data found");
      }
      return sendResponse(res, 200, stats);
    } catch (error) {
      console.log("[api-urlstats] catch-Error fetching top categories:", error);
      return sendErrorResponse(res, 500, "Failed to fetch top categories");
    }
  })();
});

// API endpoint to get top court categories by case_order count
urlStatsRouter.get("/topcourt", function (req, res) {
  (async () => {
    try {
      const stats = await fetchTopCourt();
      if (!stats || stats.length === 0) {
        return sendErrorResponse(res, 404, "No top court data found");
      }
      return sendResponse(res, 200, stats);
    } catch (error) {
      console.log("[api-urlstats] catch-Error fetching top court data:", error);
      return sendErrorResponse(res, 500, "Failed to fetch top court data");
    }
  })();
});

// API endpoint to get yearly trends with top categories per year
urlStatsRouter.get("/yearly-trends", function (req, res) {
  (async () => {
    try {
      const yearsBack = parseInt(req.query.yearsBack as string) || 5;
      const toprank = parseInt(req.query.toprank as string) || 2;

      const stats = await fetchYearlyTrends(yearsBack, toprank);
      if (!stats || stats.length === 0) {
        return sendErrorResponse(res, 404, "No yearly trends data found");
      }
      return sendResponse(res, 200, stats);
    } catch (error) {
      console.log("[api-urlstats] catch-Error fetching yearly trends:", error);
      return sendErrorResponse(res, 500, "Failed to fetch yearly trends");
    }
  })();
});

// API endpoint to get process times by year
urlStatsRouter.get("/yearly-process-times", function (req, res) {
  (async () => {
    try {
      const yearsBack = parseInt(req.query.yearsBack as string) || 3;

      const stats = await fetchProcessTimes(yearsBack);
      if (!stats || stats.length === 0) {
        return sendErrorResponse(res, 404, "No process times data found");
      }
      return sendResponse(res, 200, stats);
    } catch (error) {
      console.log("[api-urlstats] catch-Error fetching process times:", error);
      return sendErrorResponse(res, 500, "Failed to fetch process times");
    }
  })();
});

// API endpoint to get today-by-office stats
urlStatsRouter.get("/today-by-office", function (req, res) {
  (async () => {
    try {
      const stats = await fetchTodayByOffice();
      if (!stats || stats.length === 0) {
        console.log(
          "[api-urlstats] today-by-office: no data found for today, returning empty array"
        );
        // Return 200 with empty array so frontend can render an empty chart instead of treating this as an error
        return sendResponse(res, 200, []);
      }
      return sendResponse(res, 200, stats);
    } catch (error) {
      console.log(
        "[api-urlstats] catch-Error fetching today-by-office:",
        error
      );
      return sendErrorResponse(
        res,
        500,
        "Failed to fetch today-by-office stats"
      );
    }
  })();
});

// API endpoint to get url stats by platforms
urlStatsRouter.get("/platforms", function (req, res) {
  (async () => {
    try {
      const stats = await fetchUrlStatsByPlatform();
      if (!stats || stats.length === 0) {
        return sendErrorResponse(res, 404, "No platform data found");
      }
      return sendResponse(res, 200, stats);
    } catch (error) {
      console.log("[api-urlstats] catch-Error fetching platform data:", error);
      return sendErrorResponse(res, 500, "Failed to fetch platform data");
    }
  })();
});

// API endpoint to get url stats by register country
urlStatsRouter.get("/register-country", function (req, res) {
  (async () => {
    try {
      const stats = await fetchUrlStatsByRegisterCountry();
      if (!stats || stats.length === 0) {
        return sendErrorResponse(res, 404, "No register country data found");
      }
      return sendResponse(res, 200, stats);
    } catch (error) {
      console.log(
        "[api-urlstats] catch-Error fetching register country data:",
        error
      );
      return sendErrorResponse(
        res,
        500,
        "Failed to fetch register country data"
      );
    }
  })();
});

export default urlStatsRouter;
