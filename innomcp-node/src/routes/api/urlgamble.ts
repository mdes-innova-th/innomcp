import express from "express";
import { sendResponse, sendErrorResponse } from "../../utils/response";
import {
  fetchGambleDomainGroup,
  mapCaselistUrlGroups,
  fetchGroupGambleReport,
  fetchGroupGambleDomains,
  batchImportGroupGamble,
} from "../../utils/urlgamble";

const urlGambleRouter = express.Router();

// Simple WS-adapter type (same pattern as urlstats.ts)
export type SimpleWS = {
  send: (payload: string) => void;
  readyState?: number;
};

const WS_OPEN = 1;

// SQL helpers live in `src/utils/url-gamble.ts` and are imported above

/**
 * Stream updates for url-gamble over a WS-like object.
 * Sends an object similar to urlstats stream but only for group_id = 2.
 */
export async function streamUrlGambleWS(
  ws: SimpleWS,
  filters?: Record<string, any>
) {
  try {
    const { startDate, endDate, sourceType, option, selectedGroups, groupId } =
      filters || {};
    const effectiveSourceType = (option as string) || (sourceType as string);
    const effectiveGroupId = (groupId as number) || 2;

    let selGroupsArr: Array<string | number> | undefined;
    if (selectedGroups) {
      if (Array.isArray(selectedGroups)) selGroupsArr = selectedGroups;
      else if (typeof selectedGroups === "string") {
        try {
          selGroupsArr = JSON.parse(selectedGroups);
        } catch {
          selGroupsArr = selectedGroups
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        }
      }
    }

    const [domainGroup] = await Promise.all([
      fetchGambleDomainGroup(
        effectiveGroupId,
        startDate,
        endDate,
        effectiveSourceType,
        selGroupsArr
      ),
    ]);
    const payload = {
      event: "url-gamble:update",
      data: {
        domainGroup,
      },
      generatedAt: new Date().toISOString(),
    };

    if (ws.readyState === undefined || ws.readyState === WS_OPEN) {
      ws.send(JSON.stringify(payload));
    }
    return payload;
  } catch (error) {
    console.log("[api-url-gamble] Error streaming url-gamble via WS:", error);
    const errPayload = {
      event: "url-gamble:error",
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

// GET gamble-domain group
urlGambleRouter.get(
  "/gamble-domain",
  function (req: express.Request, res: express.Response) {
    (async () => {
      try {
        const { startDate, endDate, sourceType, option, minCount, groupId } =
          req.query as any;
        const effectiveSourceType = option || sourceType;
        const effectiveGroupId = groupId ? parseInt(groupId) : 2;
        // selectedGroups can be a JSON array string or comma-separated list
        const rawSel = (req.query as any).selectedGroups;
        let selectedGroups: Array<string | number> | undefined;
        if (rawSel) {
          if (Array.isArray(rawSel)) selectedGroups = rawSel;
          else if (typeof rawSel === "string") {
            try {
              selectedGroups = JSON.parse(rawSel);
            } catch {
              selectedGroups = rawSel
                .split(",")
                .map((s: string) => s.trim())
                .filter(Boolean);
            }
          }
        }

        const results = await fetchGambleDomainGroup(
          effectiveGroupId,
          startDate,
          endDate,
          effectiveSourceType,
          selectedGroups,
          minCount ? parseInt(minCount) : undefined
        );

        if (!results || (Array.isArray(results) && results.length === 0)) {
          return sendErrorResponse(
            res,
            404,
            "no data found for this gamble-domain group"
          );
        }
        return sendResponse(res, 200, results);
      } catch (error) {
        console.log("[api-urlgamble] Error in /gamble-domain:", error);
        return sendErrorResponse(
          res,
          500,
          "Failed to fetch data for this gamble-domain group"
        );
      }
    })();
  }
);

// POST gamble-domain - accept filters in JSON body (mirrors other chart endpoints)
urlGambleRouter.post(
  "/gamble-domain",
  function (req: express.Request, res: express.Response) {
    (async () => {
      try {
        const { startDate, endDate, sourceType, option, minCount, groupId } =
          req.body || {};
        const effectiveSourceType = option || sourceType;
        const effectiveGroupId = groupId ? parseInt(groupId) : 2;
        let selectedGroups: Array<string | number> | undefined;
        const rawSel = (req.body && req.body.selectedGroups) || undefined;
        if (rawSel) {
          if (Array.isArray(rawSel)) selectedGroups = rawSel;
          else if (typeof rawSel === "string") {
            try {
              selectedGroups = JSON.parse(rawSel);
            } catch {
              selectedGroups = rawSel
                .split(",")
                .map((s: string) => s.trim())
                .filter(Boolean);
            }
          }
        }

        const results = await fetchGambleDomainGroup(
          effectiveGroupId,
          startDate,
          endDate,
          effectiveSourceType,
          selectedGroups,
          minCount
        );

        if (!results || (Array.isArray(results) && results.length === 0)) {
          return sendErrorResponse(
            res,
            404,
            "no data found for this gamble-domain group"
          );
        }
        return sendResponse(res, 200, results);
      } catch (error) {
        console.log("[api-urlgamble] Error in POST /gamble-domain:", error);
        return sendErrorResponse(
          res,
          500,
          "Failed to fetch data for this gamble-domain group"
        );
      }
    })();
  }
);

// GET map-url-groups
urlGambleRouter.get(
  "/map-url-groups",
  function (req: express.Request, res: express.Response) {
    (async () => {
      try {
        const { startDate, endDate, sourceType, option, groupId } =
          req.query as any;
        const effectiveSourceType = option || sourceType;
        const effectiveGroupId = groupId ? parseInt(groupId) : 2;
        // selectedGroups can be a JSON array string or comma-separated list
        const rawSel = (req.query as any).selectedGroups;
        let selectedGroups: Array<string | number> | undefined;
        if (rawSel) {
          if (Array.isArray(rawSel)) selectedGroups = rawSel;
          else if (typeof rawSel === "string") {
            try {
              selectedGroups = JSON.parse(rawSel);
            } catch {
              selectedGroups = rawSel
                .split(",")
                .map((s: string) => s.trim())
                .filter(Boolean);
            }
          }
        }

        const results = await mapCaselistUrlGroups(
          effectiveGroupId,
          startDate,
          endDate,
          effectiveSourceType,
          selectedGroups
        );

        if (!results || Object.keys(results).length === 0) {
          return sendErrorResponse(
            res,
            404,
            "no data found for this map-url-groups"
          );
        }
        return sendResponse(res, 200, results);
      } catch (error) {
        console.log("[api-urlgamble] Error in /map-url-groups:", error);
        return sendErrorResponse(
          res,
          500,
          "Failed to fetch data for this map-url-groups"
        );
      }
    })();
  }
);

// POST map-url-groups - accept filters in JSON body (mirrors other chart endpoints)
urlGambleRouter.post(
  "/map-url-groups",
  function (req: express.Request, res: express.Response) {
    (async () => {
      try {
        const { startDate, endDate, sourceType, option, groupId } =
          req.body || {};
        const effectiveSourceType = option || sourceType;
        const effectiveGroupId = groupId ? parseInt(groupId) : 2;
        let selectedGroups: Array<string | number> | undefined;
        const rawSel = (req.body && req.body.selectedGroups) || undefined;
        if (rawSel) {
          if (Array.isArray(rawSel)) selectedGroups = rawSel;
          else if (typeof rawSel === "string") {
            try {
              selectedGroups = JSON.parse(rawSel);
            } catch {
              selectedGroups = rawSel
                .split(",")
                .map((s: string) => s.trim())
                .filter(Boolean);
            }
          }
        }

        const results = await mapCaselistUrlGroups(
          effectiveGroupId,
          startDate,
          endDate,
          effectiveSourceType,
          selectedGroups
        );

        if (!results || Object.keys(results).length === 0) {
          return sendErrorResponse(
            res,
            404,
            "no data found for this map-url-groups"
          );
        }
        return sendResponse(res, 200, results);
      } catch (error) {
        console.log("[api-urlgamble] Error in POST /map-url-groups:", error);
        return sendErrorResponse(
          res,
          500,
          "Failed to fetch data for this map-url-groups"
        );
      }
    })();
  }
);

// GET group gamble domains for a specific group_id (filters via query string)
// GET /group-domains removed; use POST /group-domains instead (frontend uses POST)

// POST group gamble domains - accept filters in JSON body (mirrors other chart endpoints)
urlGambleRouter.post(
  "/group-domains",
  function (req: express.Request, res: express.Response) {
    (async () => {
      try {
        const { startDate, endDate, sourceType, groupId, selectedGroups } =
          req.body || {};
        const effectiveGroupId = groupId ? parseInt(groupId) : 2;
        let selectedGroupsArr: Array<string | number> | undefined;
        const rawSel = (req.body && req.body.selectedGroups) || undefined;
        if (rawSel) {
          if (Array.isArray(rawSel)) selectedGroupsArr = rawSel;
          else if (typeof rawSel === "string") {
            try {
              selectedGroupsArr = JSON.parse(rawSel);
            } catch {
              selectedGroupsArr = rawSel
                .split(",")
                .map((s: string) => s.trim())
                .filter(Boolean);
            }
          }
        }

        const results = await fetchGroupGambleDomains(
          effectiveGroupId,
          startDate,
          endDate,
          sourceType,
          selectedGroupsArr
        );

        if (!results || (Array.isArray(results) && results.length === 0)) {
          return sendErrorResponse(
            res,
            404,
            "no data found for this group gamble domains"
          );
        }
        return sendResponse(res, 200, results);
      } catch (error) {
        console.log("[api-urlgamble] Error in POST /group-domains:", error);
        return sendErrorResponse(
          res,
          500,
          "Failed to fetch data for this group gamble domains"
        );
      }
    })();
  }
);

// (POST /group-domains/report removed - use GET /group-domains/report)

// GET group gamble domains report - accept filters via query string (mirrors POST)
urlGambleRouter.get(
  "/group-domains/report",
  function (req: express.Request, res: express.Response) {
    (async () => {
      try {
        const { startDate, endDate, sourceType, groupId, selectedGroups } =
          req.query as any;
        const effectiveGroupId = groupId ? parseInt(groupId) : 2;
        let selectedGroupsArr: Array<string | number> | undefined;
        const rawSel = selectedGroups || undefined;
        if (rawSel) {
          if (Array.isArray(rawSel)) selectedGroupsArr = rawSel;
          else if (typeof rawSel === "string") {
            try {
              selectedGroupsArr = JSON.parse(rawSel);
            } catch {
              selectedGroupsArr = rawSel
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
            }
          }
        }

        const results = await fetchGroupGambleReport(
          effectiveGroupId,
          startDate,
          endDate,
          sourceType,
          selectedGroupsArr
        );

        if (!results || (Array.isArray(results) && results.length === 0)) {
          return sendErrorResponse(res, 404, "no data found for report");
        }
        return sendResponse(res, 200, results);
      } catch (error) {
        console.log(
          "[api-urlgamble] Error in GET /group-domains/report:",
          error
        );
        return sendErrorResponse(
          res,
          500,
          "Failed to fetch data for this group gamble report"
        );
      }
    })();
  }
);

// POST group gamble domains report - accept filters in JSON body (mirror GET)
urlGambleRouter.post(
  "/group-domains/report",
  function (req: express.Request, res: express.Response) {
    (async () => {
      try {
        const { startDate, endDate, sourceType, groupId, selectedGroups } =
          req.body || {};
        const effectiveGroupId = groupId ? parseInt(groupId) : 2;
        let selectedGroupsArr: Array<string | number> | undefined;
        const rawSel = selectedGroups || undefined;
        if (rawSel) {
          if (Array.isArray(rawSel)) selectedGroupsArr = rawSel;
          else if (typeof rawSel === "string") {
            try {
              selectedGroupsArr = JSON.parse(rawSel);
            } catch {
              selectedGroupsArr = rawSel
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
            }
          }
        }

        const results = await fetchGroupGambleReport(
          effectiveGroupId,
          startDate,
          endDate,
          sourceType,
          selectedGroupsArr
        );

        if (!results || (Array.isArray(results) && results.length === 0)) {
          return sendErrorResponse(res, 404, "no data found for report");
        }
        return sendResponse(res, 200, results);
      } catch (error) {
        console.log(
          "[api-urlgamble] Error in POST /group-domains/report:",
          error
        );
        return sendErrorResponse(
          res,
          500,
          "Failed to fetch data for this group gamble report"
        );
      }
    })();
  }
);

// POST import group gamble domains
urlGambleRouter.post(
  "/group-import",
  function (req: express.Request, res: express.Response) {
    (async () => {
      try {
        const { groupId } = req.body || {};
        const effectiveGroupId = groupId ? parseInt(groupId) : undefined;

        await batchImportGroupGamble(effectiveGroupId);
        return sendResponse(res, 200, {
          message: "Group gamble domains imported successfully",
        });
      } catch (error) {
        console.error("Error importing group gamble domains:", error);
        return sendErrorResponse(
          res,
          500,
          "Failed to import group gamble domains"
        );
      }
    })();
  }
);

export default urlGambleRouter;
