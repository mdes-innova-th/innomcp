import express from "express";
import { withDashbDbConnection } from "../../utils/dbdashb";
import { sendResponse, sendErrorResponse } from "../../utils/response";

const router = express.Router();

router.post("/", async (req, res) => {
  (async () => {
    try {
      // detect client disconnects and set a flag to stop long-running work
      let clientAborted = false;
      req.on &&
        req.on("close", () => {
          clientAborted = true;
          console.warn("[api-urlsearch] client connection closed (close)");
        });
      req.on &&
        req.on("aborted", () => {
          clientAborted = true;
          console.warn("[api-urlsearch] client connection aborted (aborted)");
        });

      const urls: string[] = (req.body && req.body.urls) || [];
      // Optional: array of violation group ids to filter by. If empty or not
      // provided, we must NOT add a WHERE clause for group - treat as "All".
      const selectedGroups: string[] =
        (req.body && req.body.violationGroups) || [];
      // Optional match mode: 'detailed' (default) or 'exact'. When 'exact',
      // backend will only check the exact provided value and will not
      // generate protocol/variant forms.
      const matchMode: string = (req.body && req.body.matchMode) || "detailed";
      if (!Array.isArray(urls) || urls.length === 0) {
        return sendErrorResponse(
          res,
          400,
          "Request body must include an array of urls"
        );
      }

      // Normalize inputs (trim strings)
      const normalized = urls.map((u) =>
        typeof u === "string" ? u.trim() : ""
      );

      // Helper to check DB for existence of one or more URL variants.
      const checkVariant = async (
        connection: any,
        variantOrVariants: string | string[]
      ) => {
        try {
          const candidates = Array.isArray(variantOrVariants)
            ? variantOrVariants
            : [variantOrVariants];

          // Use a single query with IN (?) when multiple candidates are provided.
          if (candidates.length === 1) {
            // Build base query and params
            let q = `
              SELECT 
                  cl.caselist_url, 
                  cl.creatdate,
                  co.orderred_no,
                  co.orderred_date,
                  cg.group_name
                FROM case_listdata cl
                LEFT JOIN case_order co ON cl.order_id = co.order_id 
                  AND cl.order_id IS NOT NULL 
                  AND cl.order_id != 0
                LEFT JOIN case_category cc ON cc.category_id = cl.category_id
                LEFT JOIN case_group cg ON cg.group_id = cc.group_id
            `;
            const params: any[] = [candidates[0]];

            // If selectedGroups provided (not empty) add WHERE to restrict by group
            if (selectedGroups && selectedGroups.length > 0) {
              q += `\nWHERE cl.caselist_url = ? AND cg.group_id IN (${selectedGroups
                .map(() => "?")
                .join(",")}) LIMIT 1`;
              params.push(...selectedGroups);
            } else {
              q += `\nWHERE cl.caselist_url = ? LIMIT 1`;
            }

            const [rows]: any = await connection.query(q, params);
            if (rows && rows.length > 0 && rows[0].caselist_url) {
              return {
                found: true,
                matched: rows[0].caselist_url,
                createDate: rows[0].creatdate || null,
                orderNo: rows[0].orderred_no || null,
                orderedDate: rows[0].orderred_date || null,
                type: rows[0].group_name || null,
              };
            }
            return { found: false };
          } else {
            // Multiple candidate variants - use IN (...) for URLs
            const placeholders = candidates.map(() => "?").join(",");
            let q = `
              SELECT 
                  cl.caselist_url, 
                  cl.creatdate,
                  co.orderred_no,
                  co.orderred_date,
                  cg.group_name
                FROM case_listdata cl
                LEFT JOIN case_order co ON cl.order_id = co.order_id 
                  AND cl.order_id IS NOT NULL 
                  AND cl.order_id != 0
                LEFT JOIN case_category cc ON cc.category_id = cl.category_id
                LEFT JOIN case_group cg ON cg.group_id = cc.group_id
            `;
            const params: any[] = [...candidates];

            if (selectedGroups && selectedGroups.length > 0) {
              q += `\nWHERE cl.caselist_url IN (${placeholders}) AND cg.group_id IN (${selectedGroups
                .map(() => "?")
                .join(",")}) LIMIT 1`;
              params.push(...selectedGroups);
            } else {
              q += `\nWHERE cl.caselist_url IN (${placeholders}) LIMIT 1`;
            }

            const [rows]: any = await connection.query(q, params);
            if (rows && rows.length > 0 && rows[0].caselist_url) {
              return {
                found: true,
                matched: rows[0].caselist_url,
                createDate: rows[0].creatdate || null,
                orderNo: rows[0].orderred_no || null,
                orderedDate: rows[0].orderred_date || null,
                type: rows[0].group_name || null,
              };
            }
            return { found: false };
          }
        } catch (e) {
          // On DB error treat as not found (keeps behavior conservative)
          return { found: false };
        }
      };

      // Validate hostname (domain or IPv4). Returns true if hostname looks valid.
      const isValidHostname = (host: string) => {
        if (!host || typeof host !== "string") return false;
        const h = host.trim();
        // localhost allowed
        if (h === "localhost") return true;

        // IPv4 check
        const ipv4 =
          /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/;
        if (ipv4.test(h)) return true;

        // Domain name check: labels 1-63 chars, total <=253, TLD at least 2 letters
        if (h.length > 253) return false;
        const labels = h.split(".");
        if (labels.length < 2) return false; // require at least one dot (e.g., example.com)
        const labelRe = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
        for (const lbl of labels) {
          if (!labelRe.test(lbl)) return false;
        }
        const tld = labels[labels.length - 1];
        if (!/^[a-zA-Z]{2,63}$/.test(tld)) return false;
        return true;
      };

      // Build results with multiple variants for inputs without protocol
      const results = await withDashbDbConnection(async (connection) => {
        const out: {
          input: string;
          outputs: Array<{
            variant: string;
            note: string;
            createDate?: string;
            orderNo?: string;
            orderedDate?: string;
            type?: string;
          }>;
        }[] = [];

        for (const input of normalized) {
          if (clientAborted) {
            console.warn(
              "[api-urlsearch] stopping processing because client aborted"
            );
            return out;
          }
          if (!input) {
            out.push({
              input,
              outputs: [{ variant: input, note: "[รูปแบบไม่ถูกต้อง]" }],
            });
            continue;
          }

          // If caller requested partial match, skip URL/domain validation
          // and perform a LIKE search against stored URLs using parameterized
          // query to avoid SQL injection. This returns the first matching
          // row (if any) or marks as not found.
          if (matchMode === "partial") {
            try {
              if (clientAborted) {
                console.warn(
                  "[api-urlsearch] client aborted before partial query"
                );
                return out;
              }
              // Use %input% to match anywhere in the stored caselist_url
              const likePattern = `%${input}%`;
              let q = `
                SELECT
                  cl.caselist_url,
                  cl.creatdate,
                  co.orderred_no,
                  co.orderred_date,
                  cg.group_name
                FROM case_listdata cl
                LEFT JOIN case_order co ON cl.order_id = co.order_id
                  AND cl.order_id IS NOT NULL
                  AND cl.order_id != 0
                LEFT JOIN case_category cc ON cc.category_id = cl.category_id
                LEFT JOIN case_group cg ON cg.group_id = cc.group_id
              `;
              const params: any[] = [likePattern];
              if (selectedGroups && selectedGroups.length > 0) {
                q += `\nWHERE cl.caselist_url LIKE ? AND cg.group_id IN (${selectedGroups
                  .map(() => "?")
                  .join(",")})`;
                params.push(...selectedGroups);
              } else {
                q += `\nWHERE cl.caselist_url LIKE ?`;
              }

              // Fetch all matching rows (no LIMIT) so we can return every match
              const [rows]: any = await connection.query(q, params);
              if (clientAborted) {
                console.warn(
                  "[api-urlsearch] client aborted after partial query"
                );
                return out;
              }
              if (rows && rows.length > 0) {
                const outputs = rows
                  .filter((r: any) => r && r.caselist_url)
                  .map((r: any) => ({
                    variant: r.caselist_url,
                    note: "[มีอยู่แล้ว]",
                    createDate: r.creatdate || null,
                    orderNo: r.orderred_no || null,
                    orderedDate: r.orderred_date || null,
                    type: r.group_name || null,
                  }));

                if (outputs.length > 0) {
                  out.push({ input, outputs });
                } else {
                  out.push({
                    input,
                    outputs: [{ variant: input, note: "[ไม่มี]" }],
                  });
                }
              } else {
                out.push({
                  input,
                  outputs: [{ variant: input, note: "[ไม่มี]" }],
                });
              }
            } catch (e) {
              // On DB error treat as not found to keep behavior conservative
              out.push({
                input,
                outputs: [{ variant: input, note: "[ไม่มี]" }],
              });
            }
            continue;
          }

          // If input includes a protocol, validate it's http/https and perform single lookup
          let hasProtocol = false;
          try {
            const p = new URL(input);
            hasProtocol = !!p.protocol;
            if (p.protocol !== "http:" && p.protocol !== "https:") {
              // unsupported protocol
              out.push({
                input,
                outputs: [{ variant: input, note: "[รูปแบบไม่ถูกต้อง]" }],
              });
              continue;
            }
          } catch (e) {
            hasProtocol = false;
          }

          // Normalize a 'no-protocol' form by stripping protocol if present
          let raw = input.replace(/^https?:\/\//i, "");

          // Remove trailing slashes from the raw form (e.g. example.com/ -> example.com)
          // Also collapse repeated trailing slashes.
          const cleanedRaw = raw.replace(/\/+$/g, "");

          // Validate hostname by parsing with http:// prefix to extract hostname
          let hostValid = true;
          try {
            const p = new URL(`http://${cleanedRaw}`);
            if (!isValidHostname(p.hostname)) hostValid = false;
          } catch (e) {
            hostValid = false;
          }

          if (!hostValid) {
            out.push({
              input,
              outputs: [{ variant: cleanedRaw, note: "[รูปแบบไม่ถูกต้อง]" }],
            });
            continue;
          }

          const rawNoSlash = cleanedRaw.replace(/\/+$/g, "");
          const rawWithSlash = rawNoSlash === "" ? "/" : `${rawNoSlash}/`;

          // Prepare outputs array for this input
          const outputs: Array<{
            variant: string;
            note: string;
            createDate?: string;
            orderNo?: string;
            orderedDate?: string;
            type?: string;
          }> = [];

          // If caller requested exact match mode, only check the exact
          // provided input string and skip generating protocol/variant
          // candidates. This makes the behavior: "ค้นหาเฉพาะตรงค่าที่ป้อน".
          if (matchMode === "exact") {
            if (clientAborted) {
              console.warn("[api-urlsearch] client aborted before exact check");
              return out;
            }
            const res = await checkVariant(connection, input);
            if (clientAborted) {
              console.warn("[api-urlsearch] client aborted after exact check");
              return out;
            }
            if (res && res.found) {
              outputs.push({
                variant: res.matched || input,
                note: "[มีอยู่แล้ว]",
                createDate: res.createDate,
                orderNo: res.orderNo,
                orderedDate: res.orderedDate,
                type: res.type,
              });
            } else {
              outputs.push({ variant: input, note: "[ไม่มี]" });
            }
            out.push({ input, outputs });
            continue;
          }

          const variants = [
            // For the first variant we will check both slash/no-slash forms
            rawNoSlash,
            `http://${rawNoSlash}`,
            `https://${rawNoSlash}`,
          ];

          // Check the raw (no-protocol) variant considering trailing slash equality
          const rawCandidates =
            rawNoSlash === "/" ? ["/"] : [rawNoSlash, rawWithSlash];
          if (clientAborted) {
            console.warn(
              "[api-urlsearch] client aborted before raw variant check"
            );
            return out;
          }
          const rawRes = await checkVariant(connection, rawCandidates);
          if (clientAborted) {
            console.warn(
              "[api-urlsearch] client aborted after raw variant check"
            );
            return out;
          }
          if (rawRes && rawRes.found) {
            outputs.push({
              variant: rawRes.matched || rawNoSlash,
              note: "[มีอยู่แล้ว]",
              createDate: rawRes.createDate,
              orderNo: rawRes.orderNo,
              orderedDate: rawRes.orderedDate,
              type: rawRes.type,
            });
          } else {
            outputs.push({ variant: rawNoSlash, note: "[ไม่มี]" });
          }

          // Check http and https variants (no trailing-slash variants)
          for (const scheme of ["http://", "https://"]) {
            const v = `${scheme}${rawNoSlash}`;
            // Also consider scheme + trailing slash stored variants
            const vWithSlash = `${v}/`;
            if (clientAborted) {
              console.warn(
                "[api-urlsearch] client aborted before scheme check"
              );
              return out;
            }
            const res = await checkVariant(connection, [v, vWithSlash]);
            if (clientAborted) {
              console.warn("[api-urlsearch] client aborted after scheme check");
              return out;
            }
            if (res && res.found) {
              outputs.push({
                variant: res.matched || v,
                note: "[มีอยู่แล้ว]",
                createDate: res.createDate,
                orderNo: res.orderNo,
                orderedDate: res.orderedDate,
                type: res.type,
              });
            } else {
              outputs.push({ variant: v, note: "[ไม่มี]" });
            }
          }
          out.push({ input, outputs });
        }

        return out;
      });

      return sendResponse(res, 200, results);
    } catch (error) {
      console.error("[api-urlsearch] catch-Error:", error);
      return sendErrorResponse(res, 500, "Failed to perform URL search");
    }
  })();
});

export default router;
