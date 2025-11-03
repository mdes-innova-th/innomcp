import { Connection } from "mysql2/promise";
import { withDbConnection } from "./db";
import { withDashbDbConnection } from "./dbdashb";
import { domainToUnicode } from "url";

// List of known third-level TLDs
const thirdLevelTlds = new Set([
  "co.in",
  "co.th",
  "co.uk",
  "co.jp",
  "co.kr",
  "co.za",
  "co.nz",
  "co.au",
  "co.ca",
  "co.mx",
  "co.br",
  "co.ar",
  "co.cl",
  "co.pe",
  "co.ve",
  "co.ec",
  "co.bo",
  "co.py",
  "co.uy",
  "co.gt",
  "co.hn",
  "co.ni",
  "co.cr",
  "co.pa",
  "co.sv",
  "co.do",
  "co.pr",
  "co.cu",
  "co.tt",
  "co.jm",
  "co.bb",
  "co.gd",
  "co.vc",
  "co.ag",
  "co.dm",
  "co.kn",
  "co.lc",
  "co.ms",
  "co.vc",
  "co.ai",
  "co.bm",
  "co.bs",
  "co.bz",
  "co.ky",
  "co.tc",
  "co.vg",
  "co.gg",
  "co.je",
  "co.im",
  "co.me",
  "co.sh",
  "co.ac",
  "co.io",
  "co.gg",
  "co.je",
  "co.im",
  "co.me",
  "co.sh",
  "co.ac",
  "co.io",
  "co.asia",
  "co.cat",
  "co.pro",
  "co.tel",
  "co.travel",
  "co.xxx",
  "co.jobs",
  "co.mobi",
  "co.name",
  "co.aero",
  "co.arpa",
  "co.biz",
  "co.cat",
  "co.com",
  "co.coop",
  "co.edu",
  "co.gov",
  "co.info",
  "co.int",
  "co.jobs",
  "co.mil",
  "co.mobi",
  "co.name",
  "co.net",
  "co.org",
  "co.pro",
  "co.tel",
  "co.travel",
  "co.xxx",
  // Add more as needed
]);

// Extract domain from URL
const extractDomain = (url: string): string => {
  try {
    // Take only the part before any space
    url = url.split(" ")[0].trim();

    // If URL doesn't have protocol, add https://
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    let hostname: string;
    try {
      hostname = new URL(url).hostname;
      // Convert Punycode back to Unicode for Thai domains
      hostname = domainToUnicode(hostname);
    } catch (urlError) {
      // If URL parsing fails, try to extract domain manually
      console.warn(`URL parsing failed for: ${url}, trying manual extraction`);
      const urlPart = url.replace(/^https?:\/\//, "");
      hostname = urlPart.split("/")[0].split("?")[0].split("#")[0];
    }

    const parts = hostname.replace("www.", "").split(".");
    if (parts.length >= 3) {
      const potentialTld = parts.slice(-2).join(".");
      if (thirdLevelTlds.has(potentialTld)) {
        // For third-level TLDs like co.in, return the part before it
        return parts.length > 3 ? parts.slice(-3, -2)[0] : parts[0];
      } else {
        // For regular domains, return the second-level domain
        return parts.slice(-2, -1)[0];
      }
    } else {
      // For simple domains like example.com
      return parts[0];
    }
  } catch (error) {
    console.error(`Invalid URL: ${url}`, error);
    return "";
  }
};

// Fetch domain groups within a given case_group
export async function fetchGambleDomainGroup(
  groupId: number,
  startDate?: string,
  endDate?: string,
  sourceType?: string,
  selectedGroups?: Array<number | string>,
  minCount?: number
): Promise<any[]> {
  const groups = await mapCaselistUrlGroups(
    groupId,
    startDate,
    endDate,
    sourceType,
    selectedGroups
  );

  // Convert to array format expected by frontend
  let result = Object.entries(groups).map(([groupName, data]) => ({
    group_name: groupName,
    url_count: data.count,
  }));

  // Sort by count descending
  result.sort((a, b) => b.url_count - a.url_count);

  return result;
}
// (Removed unused helper functions: fetchTopCourtForGroup, fetchListForGroup)

// Helper function to extract base name from URL
function extractBaseName(url: string): string {
  // Remove protocol
  url = url.replace(/^https?:\/\//, "");
  // Remove path
  url = url.split("/")[0];
  // Convert to Unicode if it's Punycode
  try {
    const parsed = new URL("https://" + url);
    url = domainToUnicode(parsed.hostname);
  } catch {
    // If parsing fails, use as is
  }
  // Remove subdomain if more than 2 parts
  const parts = url.split(".");
  if (parts.length > 2) {
    parts.shift();
  }
  // Return name before TLD
  return parts[0];
}

// Helper function to find group key based on base name
function findGroupKey(baseName: string): string {
  // Use the full domain name as group key
  return baseName;
}

// Map caselist_url to groups and count URLs in each group
export async function mapCaselistUrlGroups(
  groupId: number,
  startDate?: string,
  endDate?: string,
  sourceType?: string,
  selectedGroups?: Array<number | string>
): Promise<{ [key: string]: { urls: string[]; count: number } }> {
  return withDashbDbConnection(async (connection: Connection) => {
    let query = `
      SELECT DISTINCT cl.caselist_id, cl.caselist_url, cl.creatdate, co.order_date, co.orderred_date
      FROM case_listdata cl
      JOIN case_category cc ON cc.category_id = cl.category_id
      JOIN case_group cg ON cg.group_id = cc.group_id
      LEFT JOIN case_order co ON co.order_id = cl.order_id
      WHERE cg.group_id = ?
    `;
    const params: any[] = [groupId];

    if (sourceType === "court") {
      // For court orders, include rows where either order_date or orderred_date
      // falls within the selected range. Use DATE(...) so comparisons work when
      // the DB column is DATE (no time) or DATETIME. This also avoids excluding
      // rows where one of the two date columns is NULL.
      query = `
        SELECT DISTINCT cl.caselist_id, cl.caselist_url, cl.creatdate, co.order_date, co.orderred_date
        FROM case_listdata cl
        JOIN case_category cc ON cc.category_id = cl.category_id
        JOIN case_group cg ON cg.group_id = cc.group_id
        JOIN case_order co ON co.order_id = cl.order_id
        WHERE cg.group_id = ?
          AND cl.order_id IS NOT NULL AND cl.order_id <> 0
      `;
      // Build OR-based date checks using DATE(co.order_date) and DATE(co.orderred_date)
      if (startDate && endDate) {
        query +=
          " AND ((DATE(co.order_date) BETWEEN ? AND ?) OR (DATE(co.orderred_date) BETWEEN ? AND ?))";
        params.push(startDate, endDate, startDate, endDate);
      } else if (startDate) {
        query +=
          " AND (DATE(co.order_date) >= ? OR DATE(co.orderred_date) >= ?)";
        params.push(startDate, startDate);
      } else if (endDate) {
        query +=
          " AND (DATE(co.order_date) <= ? OR DATE(co.orderred_date) <= ?)";
        params.push(endDate, endDate);
      }
    } else {
      // For other source types, filter by creatdate from case_listdata
      if (startDate) {
        query += " AND cl.creatdate >= ?";
        params.push(startDate + " 00:00:00");
      }
      if (endDate) {
        query += " AND cl.creatdate <= ?";
        params.push(endDate + " 23:59:59");
      }
      // apply sourceType filter
      if (sourceType === "petition") {
        // Ensure petition_id is present and not zero
        query += " AND cl.petition_id IS NOT NULL AND cl.petition_id <> 0";
      } else if (sourceType === "court") {
        query += " AND cl.order_id IS NOT NULL AND cl.order_id <> 0";
      }
    }
    // apply selectedGroups filter (category ids)
    if (selectedGroups && selectedGroups.length > 0) {
      const placeholders = selectedGroups.map(() => "?").join(",");
      query += ` AND cc.category_id IN (${placeholders})`;
      params.push(...selectedGroups);
    }

    const [rows] = await connection.query(query, params);

    // Build a mapping of URL -> best available date (prefer order_date, then orderred_date, then creatdate)
    const urlDateMap = new Map<string, string | null>();
    (rows as any[]).forEach((row) => {
      const url = row.caselist_url;
      let dateVal: string | null = null;
      if (row.order_date) dateVal = row.order_date;
      else if (row.orderred_date) dateVal = row.orderred_date;
      else if (row.creatdate) dateVal = row.creatdate;

      const existing = urlDateMap.get(url);
      if (!existing) {
        urlDateMap.set(url, dateVal);
      } else if (dateVal && existing) {
        // keep earliest date if both exist
        try {
          const dNew = new Date(dateVal);
          const dExist = new Date(existing);
          if (!isNaN(dNew.getTime()) && !isNaN(dExist.getTime())) {
            if (dNew.getTime() < dExist.getTime()) {
              urlDateMap.set(url, dateVal);
            }
          }
        } catch {
          // ignore parse errors
        }
      } else if (dateVal && !existing) {
        urlDateMap.set(url, dateVal);
      }
    });

    // Process to group
    const groups: { [key: string]: { urls: Set<string>; count: number } } = {};
    (rows as any[]).forEach((row) => {
      const url = row.caselist_url;
      const baseName = extractBaseName(url);
      const groupKey = findGroupKey(baseName);
      if (!groups[groupKey]) {
        groups[groupKey] = { urls: new Set(), count: 0 };
      }
      groups[groupKey].urls.add(url);
      groups[groupKey].count = groups[groupKey].urls.size;
    });

    // Convert Sets back to arrays, sort urls inside each group by date (earliest first),
    // and build result object with insertion order matching descending count.
    const groupEntries = Object.entries(groups).map(([key, value]) => {
      const urlsArr = Array.from(value.urls);
      urlsArr.sort((a, b) => {
        const da = urlDateMap.get(a);
        const db = urlDateMap.get(b);
        if (da && db) {
          const ta = new Date(da).getTime();
          const tb = new Date(db).getTime();
          if (!isNaN(ta) && !isNaN(tb)) return ta - tb;
        }
        if (da && !db) return -1;
        if (!da && db) return 1;
        return a.localeCompare(b);
      });
      return [key, { urls: urlsArr, count: value.count }] as [
        string,
        { urls: string[]; count: number }
      ];
    });

    // Sort groups by count descending
    groupEntries.sort((a, b) => b[1].count - a[1].count);

    const result: { [key: string]: { urls: string[]; count: number } } = {};
    for (const [k, v] of groupEntries) {
      result[k] = v;
    }

    return result;
  });
}

// Batch process to import data
export const batchImportGroupGamble = async (
  groupId?: number
): Promise<void> => {
  const batchSize = 50000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    console.log(`Processing batch with offset: ${offset}`);

    // Fetch rows from dashboard DB (case_listdata lives in dashboard DB)
    const rows: any[] = await withDashbDbConnection(async (dashConn) => {
      let query =
        "SELECT caselist_id, caselist_url FROM case_listdata cl JOIN case_category cc ON cc.category_id = cl.category_id JOIN case_group cg ON cg.group_id = cc.group_id";
      const params: any[] = [];
      if (groupId) {
        query += " WHERE cg.group_id = ?";
        params.push(groupId);
      }
      query += " LIMIT ? OFFSET ?";
      params.push(batchSize, offset);

      const [rows]: any = await dashConn.execute(query, params);
      return rows;
    });

    if (!rows || rows.length === 0) {
      hasMore = false;
      break;
    }

    // Process writes to main DB in a transaction
    await withDbConnection(async (connection) => {
      await connection.beginTransaction();
      try {
        // Group URLs by domain
        const domainMap = new Map<string, number[]>();
        for (const row of rows) {
          const domain = extractDomain(row.caselist_url);
          if (domain) {
            if (!domainMap.has(domain)) {
              domainMap.set(domain, []);
            }
            domainMap.get(domain)!.push(row.caselist_id);
          }
        }

        // Insert into wddsb_groupgamble
        const domains = Array.from(domainMap.keys());
        if (domains.length > 0) {
          const placeholders = domains.map(() => "(?)").join(", ");
          await connection.execute(
            `INSERT IGNORE INTO wddsb_groupgamble (groupgamble_name) VALUES ${placeholders}`,
            domains
          );
        }

        // Get groupgamble_id for domains
        let groupRows: any[] = [];
        if (domains.length > 0) {
          const placeholders = domains.map(() => "?").join(", ");
          const [grows]: any = await connection.execute(
            `SELECT groupgamble_id, groupgamble_name FROM wddsb_groupgamble WHERE groupgamble_name IN (${placeholders})`,
            domains
          );
          groupRows = grows;
        }

        const groupMap = new Map<string, number>();
        for (const row of groupRows) {
          groupMap.set(row.groupgamble_name, row.groupgamble_id);
        }

        // Bulk insert into wddsb_url_groupgamble in chunks to avoid too many placeholders
        const urlGroupValues: [number, number][] = [];
        for (const [domain, caselistIds] of domainMap) {
          const ggId = groupMap.get(domain);
          if (ggId) {
            for (const caselistId of caselistIds) {
              urlGroupValues.push([caselistId, ggId]);
            }
          }
        }

        if (urlGroupValues.length > 0) {
          const chunkSize = 1000; // Insert in chunks of 1000 records (2000 placeholders)
          for (let i = 0; i < urlGroupValues.length; i += chunkSize) {
            const chunk = urlGroupValues.slice(i, i + chunkSize);
            const placeholders = chunk.map(() => "(?, ?)").join(", ");
            const values = chunk.flat();
            await connection.execute(
              `INSERT IGNORE INTO wddsb_url_groupgamble (caselist_id, groupgamble_id) VALUES ${placeholders}`,
              values
            );
          }
        }

        await connection.commit();
        console.log(
          `Batch ${offset / batchSize + 1} completed. Processed ${
            rows.length
          } records.`
        );
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    });

    offset += batchSize;
  }

  console.log("Batch import completed.");
};

// Function to handle new data insertion
export const insertGroupGambleForNewUrl = async (
  caselistId: number,
  caselistUrl: string,
  groupId?: number
): Promise<void> => {
  return withDbConnection(async (connection) => {
    await connection.beginTransaction();

    try {
      const domain = extractDomain(caselistUrl);
      if (!domain) {
        console.warn(`Could not extract domain from URL: ${caselistUrl}`);
        return;
      }

      // Insert into wddsb_groupgamble if not exists
      await connection.execute(
        "INSERT IGNORE INTO wddsb_groupgamble (groupgamble_name) VALUES (?)",
        [domain]
      );

      // Get groupgamble_id
      const [rows]: any = await connection.execute(
        "SELECT groupgamble_id FROM wddsb_groupgamble WHERE groupgamble_name = ?",
        [domain]
      );

      if (rows.length > 0) {
        const groupId = rows[0].groupgamble_id;

        // Insert into wddsb_url_groupgamble
        await connection.execute(
          "INSERT IGNORE INTO wddsb_url_groupgamble (caselist_id, groupgamble_id) VALUES (?, ?)",
          [caselistId, groupId]
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      console.error("Error inserting group gamble for new URL:", error);
      throw error;
    }
  });
};

// Fetch group gamble domains for a specific group_id
export const fetchGroupGambleDomains = async (
  groupId: number,
  startDate?: string,
  endDate?: string,
  sourceType?: string,
  selectedGroups?: Array<number | string>
) => {
  // Step 1: get matching caselist rows (id + url) from the dashboard DB
  const caselistRows: Array<{ caselist_id: number; caselist_url: string }> =
    await withDashbDbConnection(async (dashConn) => {
      let q = `
      SELECT DISTINCT cl.caselist_id, cl.caselist_url
      FROM case_listdata cl
      JOIN case_category cc ON cc.category_id = cl.category_id
      JOIN case_group cg ON cg.group_id = cc.group_id
      WHERE cg.group_id = ?
    `;
      const params: any[] = [groupId];

      if (sourceType === "court") {
        q = `
        SELECT DISTINCT cl.caselist_id, cl.caselist_url
        FROM case_listdata cl
        JOIN case_category cc ON cc.category_id = cl.category_id
        JOIN case_group cg ON cg.group_id = cc.group_id
        JOIN case_order co ON co.order_id = cl.order_id
        WHERE cg.group_id = ?
          AND cl.order_id IS NOT NULL AND cl.order_id <> 0
      `;
        if (startDate && endDate) {
          q +=
            " AND ((DATE(co.order_date) BETWEEN ? AND ?) OR (DATE(co.orderred_date) BETWEEN ? AND ?))";
          params.push(startDate, endDate, startDate, endDate);
        } else if (startDate) {
          q += " AND (DATE(co.order_date) >= ? OR DATE(co.orderred_date) >= ?)";
          params.push(startDate, startDate);
        } else if (endDate) {
          q += " AND (DATE(co.order_date) <= ? OR DATE(co.orderred_date) <= ?)";
          params.push(endDate, endDate);
        }
      } else {
        if (startDate) {
          q += " AND cl.creatdate >= ?";
          params.push(startDate + " 00:00:00");
        }
        if (endDate) {
          q += " AND cl.creatdate <= ?";
          params.push(endDate + " 23:59:59");
        }
        if (sourceType === "petition") {
          q += " AND cl.petition_id IS NOT NULL AND cl.petition_id <> 0";
        } else if (sourceType === "court") {
          q += " AND cl.order_id IS NOT NULL AND cl.order_id <> 0";
        }
      }
      if (selectedGroups && selectedGroups.length > 0) {
        const placeholders = selectedGroups.map(() => "?").join(",");
        q += ` AND cc.category_id IN (${placeholders})`;
        params.push(...selectedGroups);
      }

      const [rows]: any = await dashConn.execute(q, params);
      return (rows as any[]).map((r) => ({
        caselist_id: r.caselist_id,
        caselist_url: r.caselist_url,
      }));
    });

  if (!caselistRows || caselistRows.length === 0) {
    return [];
  }

  // Step 2: fetch groupgamble_name for each caselist_id from main DB
  const caselistIds = caselistRows.map((r) => r.caselist_id);
  const groupMap = new Map<number, string>(); // caselist_id -> groupgamble_name
  await withDbConnection(async (connection) => {
    const chunkSize = 1000;
    for (let i = 0; i < caselistIds.length; i += chunkSize) {
      const chunk = caselistIds.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => "?").join(",");
      const q = `
        SELECT ug.caselist_id, gg.groupgamble_name
        FROM wddsb_url_groupgamble ug
        JOIN wddsb_groupgamble gg ON gg.groupgamble_id = ug.groupgamble_id
        WHERE ug.caselist_id IN (${placeholders})
      `;
      const [rows]: any = await connection.execute(q, chunk);
      for (const row of rows) {
        groupMap.set(Number(row.caselist_id), row.groupgamble_name);
      }
    }
  });

  // Step 3: build counts using mapping when available, otherwise fallback to domain extracted
  const counts = new Map<string, number>();
  for (const r of caselistRows) {
    const mapped = groupMap.get(r.caselist_id);
    const name = mapped || extractDomain(r.caselist_url) || "Unknown";
    counts.set(name, (counts.get(name) || 0) + 1);
  }

  // Convert map to sorted array matching previous shape
  const result = Array.from(counts.entries()).map(
    ([groupgamble_name, url_count]) => ({
      groupgamble_name,
      url_count,
    })
  );

  result.sort((a, b) => b.url_count - a.url_count);
  return result;
};

// New: fetch detailed rows for report export including case order info when available
export const fetchGroupGambleReport = async (
  groupId: number,
  startDate?: string,
  endDate?: string,
  sourceType?: string,
  selectedGroups?: Array<number | string>
) => {
  // Step 1: fetch caselist rows (id, url, order_id, petition_id) from dashboard DB
  const caselistRows: Array<{
    caselist_id: number;
    caselist_url: string;
    order_id?: number | null;
    petition_id?: number | null;
    creatdate?: string | null;
  }> = await withDashbDbConnection(async (dashConn) => {
    // Include creatdate so caller can present the import/created date per URL
    let q = `
      SELECT DISTINCT cl.caselist_id, cl.caselist_url, cl.order_id, cl.petition_id, cl.creatdate
      FROM case_listdata cl
      JOIN case_category cc ON cc.category_id = cl.category_id
      JOIN case_group cg ON cg.group_id = cc.group_id
      WHERE cg.group_id = ?
    `;
    const params: any[] = [groupId];

    if (sourceType === "court") {
      // For court orders, include rows where either order_date or orderred_date
      // falls within the selected range. Use DATE(...) so comparisons work when
      // the DB column is DATE (no time) or DATETIME. This also avoids excluding
      // rows where one of the two date columns is NULL.
      q = `
        SELECT DISTINCT cl.caselist_id, cl.caselist_url, cl.order_id, cl.petition_id, cl.creatdate
        FROM case_listdata cl
        JOIN case_category cc ON cc.category_id = cl.category_id
        JOIN case_group cg ON cg.group_id = cc.group_id
        JOIN case_order co ON co.order_id = cl.order_id
        WHERE cg.group_id = ?
          AND cl.order_id IS NOT NULL AND cl.order_id <> 0
      `;
      if (startDate && endDate) {
        q +=
          " AND ((DATE(co.order_date) BETWEEN ? AND ?) OR (DATE(co.orderred_date) BETWEEN ? AND ?))";
        params.push(startDate, endDate, startDate, endDate);
      } else if (startDate) {
        q += " AND (DATE(co.order_date) >= ? OR DATE(co.orderred_date) >= ?)";
        params.push(startDate, startDate);
      } else if (endDate) {
        q += " AND (DATE(co.order_date) <= ? OR DATE(co.orderred_date) <= ?)";
        params.push(endDate, endDate);
      }
    } else {
      // For other source types, filter by creatdate from case_listdata
      if (startDate) {
        q += " AND cl.creatdate >= ?";
        params.push(startDate + " 00:00:00");
      }
      if (endDate) {
        q += " AND cl.creatdate <= ?";
        params.push(endDate + " 23:59:59");
      }
      if (sourceType === "petition") {
        q += " AND cl.petition_id IS NOT NULL AND cl.petition_id <> 0";
      } else if (sourceType === "court") {
        q += " AND cl.order_id IS NOT NULL AND cl.order_id <> 0";
      }
    }

    if (selectedGroups && selectedGroups.length > 0) {
      const placeholders = selectedGroups.map(() => "?").join(",");
      q += ` AND cc.category_id IN (${placeholders})`;
      params.push(...selectedGroups);
    }

    const [rows]: any = await dashConn.execute(q, params);
    return (rows as any[]).map((r) => ({
      caselist_id: r.caselist_id,
      caselist_url: r.caselist_url,
      order_id: r.order_id ?? null,
      petition_id: r.petition_id ?? null,
      creatdate: r.creatdate ?? null,
    }));
  });

  if (!caselistRows || caselistRows.length === 0) return [];

  const caselistIds = caselistRows.map((r) => r.caselist_id);

  // Step 2: fetch groupgamble_name for each caselist_id from main DB
  const groupMap = new Map<number, string>(); // caselist_id -> groupgamble_name
  await withDbConnection(async (connection) => {
    const chunkSize = 1000;
    for (let i = 0; i < caselistIds.length; i += chunkSize) {
      const chunk = caselistIds.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => "?").join(",");
      const q = `
        SELECT ug.caselist_id, gg.groupgamble_name
        FROM wddsb_url_groupgamble ug
        JOIN wddsb_groupgamble gg ON gg.groupgamble_id = ug.groupgamble_id
        WHERE ug.caselist_id IN (${placeholders})
      `;
      const [rows]: any = await connection.execute(q, chunk);
      for (const row of rows) {
        groupMap.set(Number(row.caselist_id), row.groupgamble_name);
      }
    }
  });

  // Step 3: If there are order_ids or petition_ids, fetch details from dashboard DB
  const orderMap = new Map<number, any>(); // order_id -> order row
  const petitionMap = new Map<number, any>(); // petition_id -> petition row
  const orderIds = Array.from(
    new Set(caselistRows.map((r) => r.order_id).filter(Boolean))
  ) as number[];
  const petitionIds = Array.from(
    new Set(caselistRows.map((r) => r.petition_id).filter(Boolean))
  ) as number[];

  if (orderIds.length > 0) {
    await withDashbDbConnection(async (dashConn) => {
      const chunkSize = 1000;
      for (let i = 0; i < orderIds.length; i += chunkSize) {
        const chunk = orderIds.slice(i, i + chunkSize);
        const placeholders = chunk.map(() => "?").join(",");
        const q = `SELECT * FROM case_order WHERE order_id IN (${placeholders})`;
        const [rows]: any = await dashConn.execute(q, chunk);
        for (const row of rows) {
          orderMap.set(Number(row.order_id), row);
        }
      }
    });
  }

  if (petitionIds.length > 0) {
    await withDashbDbConnection(async (dashConn) => {
      const chunkSize = 1000;
      for (let i = 0; i < petitionIds.length; i += chunkSize) {
        const chunk = petitionIds.slice(i, i + chunkSize);
        const placeholders = chunk.map(() => "?").join(",");
        const q = `SELECT * FROM petition_data WHERE petition_id IN (${placeholders})`;
        const [rows]: any = await dashConn.execute(q, chunk);
        for (const row of rows) {
          petitionMap.set(Number(row.petition_id), row);
        }
      }
    });
  }

  // Step 4: merge into final rows
  const unsortedRows: Array<{
    group_name: string;
    caselist_id: number;
    caselist_url: string;
    import_date?: string | null; // creatdate from case_listdata
    order?: any | null; // court order (ดำ)
    petition?: any | null; // petition data (แดง)
  }> = caselistRows.map((r) => ({
    group_name: groupMap.get(r.caselist_id) || "",
    caselist_id: r.caselist_id,
    caselist_url: r.caselist_url,
    import_date: r.creatdate ?? null,
    order: r.order_id ? orderMap.get(r.order_id) || null : null,
    petition: r.petition_id ? petitionMap.get(r.petition_id) || null : null,
  }));

  // Group rows by group_name
  const groups = new Map<string, typeof unsortedRows>();
  for (const row of unsortedRows) {
    const name = row.group_name || "Unknown";
    if (!groups.has(name)) groups.set(name, [] as typeof unsortedRows);
    groups.get(name)!.push(row);
  }

  // Sort rows within each group by court order date (prefer order.order_date then order.orderred_date). Rows without order dates go after.
  for (const [name, rows] of groups.entries()) {
    rows.sort((a, b) => {
      const aOrder = a.order;
      const bOrder = b.order;
      const aDateStr = aOrder
        ? aOrder.order_date || aOrder.orderred_date
        : null;
      const bDateStr = bOrder
        ? bOrder.order_date || bOrder.orderred_date
        : null;
      if (aDateStr && bDateStr) {
        const ta = new Date(aDateStr).getTime();
        const tb = new Date(bDateStr).getTime();
        if (!isNaN(ta) && !isNaN(tb)) return ta - tb; // earliest first
      }
      if (aDateStr && !bDateStr) return -1;
      if (!aDateStr && bDateStr) return 1;
      return a.caselist_url.localeCompare(b.caselist_url);
    });
  }

  // Sort groups by number of URLs (descending)
  const sortedGroupEntries = Array.from(groups.entries()).sort(
    (a, b) => b[1].length - a[1].length
  );

  // Flatten back to array preserving group order and per-group URL ordering
  const resultRows: typeof unsortedRows = [];
  for (const [, rows] of sortedGroupEntries) {
    resultRows.push(...rows);
  }

  return resultRows;
};
