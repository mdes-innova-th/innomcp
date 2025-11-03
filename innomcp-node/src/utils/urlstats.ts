import { Connection } from "mysql2/promise";
import { withDashbDbConnection } from "./dbdashb";

// Types for Group Names
export interface GroupName {
  group_id: number;
  group_name: string;
}

// Types for URL statistics
export interface UrlByViolationTypeStats {
  group_name: string;
  url_count: number;
}

export interface UrlsByDateStats {
  date: string;
  group_name: string;
  url_count: number;
}

// New interface for URL processing time statistics
export interface UrlProcessingTimeStats {
  date: string;
  group_name: string;
  url_to_inspect1: number; // hours
  inspect1_to_inspect2: number; // hours
  inspect2_to_petition: number; // hours
  total: number; // hours
}

// Fetch violation group names.
export async function fetchGroupsNames(): Promise<GroupName[]> {
  return await withDashbDbConnection(async (connection: Connection) => {
    const query = `SELECT group_id, group_name FROM case_group ORDER BY group_name`;
    const [results] = await connection.query(query);
    return results as GroupName[];
  });
}

// Interface for today-by-office stats
export interface TodayByOfficeStats {
  department_id: number;
  department_name: string;
  url_count: number;
}

// Fetch top office stats for today (last 24 hours)
export async function fetchTodayByOffice(): Promise<TodayByOfficeStats[]> {
  return await withDashbDbConnection(async (connection: Connection) => {
    const query = `
SELECT ud.department_id,
    ud.department_name,
    cl.creatdate
    , COUNT(DISTINCT cl.caselist_id) AS url_count
FROM case_listdata cl
JOIN case_category cc ON cc.category_id = cl.category_id
JOIN case_group cg ON cg.group_id = cc.group_id
JOIN case_data cd ON cd.case_id = cl.case_id AND cd.group_id = cg.group_id
JOIN admin_main am ON am.id_member = cd.admin_id
JOIN tb_userdepartment ud ON ud.department_id = am.superadmin
WHERE cl.creatdate >= CURDATE()
  AND cl.creatdate < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
GROUP BY cl.creatdate, ud.department_id 
ORDER BY cl.creatdate;
    `;
    const [results] = await connection.query(query);
    return results as TodayByOfficeStats[];
  });
}

// Fetch URLs by violation group with date filter option and sourceType
export async function fetchUrlsByViolationGroup(
  startDate?: string,
  endDate?: string,
  sourceType?: string,
  selectedGroups?: string[]
): Promise<UrlByViolationTypeStats[]> {
  return await withDashbDbConnection(async (connection: Connection) => {
    let query = `SELECT cg.group_name, COUNT(cl.case_id) AS url_count
FROM case_listdata cl
JOIN case_category cc ON cc.category_id = cl.category_id
JOIN case_group cg ON cg.group_id = cc.group_id`;

    const params: any[] = [];
    let where = "";

    // Add sourceType filter if provided
    if (sourceType === "petition") {
      where += " JOIN petition_data pd ON cl.petition_id = pd.petition_id";
      // ensure petition_id is present and not zero
      where +=
        (where ? " AND " : " WHERE ") +
        "cl.petition_id IS NOT NULL AND cl.petition_id <> 0";
    } else if (sourceType === "court") {
      where += " JOIN case_order co ON cl.order_id = co.order_id";
      where +=
        (where ? " AND " : " WHERE ") +
        "cl.order_id IS NOT NULL AND cl.order_id <> 0";
    }

    // Add selectedGroups filter if provided
    if (selectedGroups && selectedGroups.length > 0) {
      where +=
        (where ? " AND " : " WHERE ") +
        `cg.group_id IN (${selectedGroups.map(() => "?").join(",")})`;
      params.push(...selectedGroups);
    }

    // Add date filter if provided
    if (startDate) {
      where += (where ? " AND " : " WHERE ") + "cl.creatdate >= ?";
      params.push(startDate + " 00:00:00");
    }
    if (endDate) {
      where += (where ? " AND " : " WHERE ") + "cl.creatdate <= ?";
      params.push(endDate + " 23:59:59");
    }
    if (selectedGroups && selectedGroups.length > 0) {
      where += (where ? " AND " : " WHERE ") + "cg.group_id IN (?)";
      params.push(selectedGroups);
    }

    // Special handling for same-day selection - ensure we get results for the entire day
    if (startDate && endDate && startDate === endDate) {
      // For same day, explicitly ensure we cover the full 24-hour period
      console.log(`[urlstats] Fetching data for same day: ${startDate}`);
    }

    query += where;
    query += " GROUP BY cg.group_id, cg.group_name ORDER BY cg.group_name";

    const [results] = await connection.query(query, params);
    return results as UrlByViolationTypeStats[];
  });
}

// Fetch URLs by date and group with date filter option
export async function fetchUrlsByDateAndGroup(
  startDate?: string,
  endDate?: string,
  sourceType?: string,
  selectedGroups?: string[]
): Promise<UrlsByDateStats[]> {
  return await withDashbDbConnection(async (connection: Connection) => {
    let query = `SELECT DATE(cl.creatdate) as date, cg.group_name, COUNT(cl.case_id) as url_count
FROM case_listdata cl
JOIN case_category cc ON cl.category_id = cc.category_id
JOIN case_group cg ON cg.group_id = cc.group_id`;

    const params: any[] = [];
    let where = "";

    // Add sourceType filter if provided
    if (sourceType === "petition") {
      where += " JOIN petition_data pd ON cl.petition_id = pd.petition_id";
      // ensure petition_id is present and not zero
      where +=
        (where ? " AND " : " WHERE ") +
        "cl.petition_id IS NOT NULL AND cl.petition_id <> 0";
    } else if (sourceType === "court") {
      where += " JOIN case_order co ON cl.order_id = co.order_id";
      where +=
        (where ? " AND " : " WHERE ") +
        "cl.order_id IS NOT NULL AND cl.order_id <> 0";
    }

    // Add date filter if provided
    if (startDate) {
      where += (where ? " AND " : " WHERE ") + "cl.creatdate >= ?";
      params.push(startDate + " 00:00:00");
    }
    if (endDate) {
      where += (where ? " AND " : " WHERE ") + "cl.creatdate <= ?";
      params.push(endDate + " 23:59:59");
    }
    if (selectedGroups && selectedGroups.length > 0) {
      where += (where ? " AND " : " WHERE ") + "cg.group_id IN (?)";
      params.push(selectedGroups);
    }

    // Special handling for same-day selection
    if (startDate && endDate && startDate === endDate) {
      console.log(`[urlstats] Fetching daily data for same day: ${startDate}`);
    }

    query += where;
    query +=
      " GROUP BY DATE(cl.creatdate), cg.group_id, cg.group_name ORDER BY date ASC, cg.group_name";

    const [results] = await connection.query(query, params);
    return results as UrlsByDateStats[];
  });
}

// New interface for total URL count statistics
export interface TotalUrlCountStats {
  total_urls: number;
  source_type: string;
  url_count: number;
}

// Fetch total imported URLs count for donut chart
export async function fetchTotalUrlCount(): Promise<TotalUrlCountStats[]> {
  return await withDashbDbConnection(async (connection: Connection) => {
    const queries = [
      // Total count
      `SELECT 
        'total' as source_type,
        COUNT(caselist_id) as url_count
      FROM case_listdata`,

      // Petition count
      `SELECT 
        'petition' as source_type,
        COUNT(cl.caselist_id) as url_count
      FROM case_listdata cl
      JOIN petition_data pd ON cl.petition_id = pd.petition_id
      WHERE cl.petition_id IS NOT NULL AND cl.petition_id <> 0`,

      // Court count
      `SELECT 
        'court' as source_type,
        COUNT(cl.caselist_id) as url_count
      FROM case_listdata cl
      JOIN case_order co ON cl.order_id = co.order_id
      WHERE cl.order_id IS NOT NULL AND cl.order_id <> 0`,
    ];

    const results = [];
    let totalUrls = 0;

    for (const query of queries) {
      const [queryResult] = await connection.query(query);
      const row = (queryResult as any[])[0];
      results.push({
        source_type: row.source_type,
        url_count: row.url_count,
      });

      if (row.source_type === "total") {
        totalUrls = row.url_count;
      }
    }

    return results.map((item) => ({
      ...item,
      total_urls: totalUrls,
    })) as TotalUrlCountStats[];
  });
}

// Fetch petition URLs count for donut chart
export async function fetchPetitionUrlCount(): Promise<TotalUrlCountStats[]> {
  return await withDashbDbConnection(async (connection: Connection) => {
    const query = `SELECT 
      'petition' as source_type,
      COUNT(cl.caselist_id) as url_count
    FROM case_listdata cl
    JOIN petition_data pd ON cl.petition_id = pd.petition_id
    WHERE cl.petition_id IS NOT NULL AND cl.petition_id <> 0`;

    const [queryResult] = await connection.query(query);
    const row = (queryResult as any[])[0];

    return [
      {
        source_type: row.source_type,
        url_count: row.url_count,
        total_urls: row.url_count,
      },
    ] as TotalUrlCountStats[];
  });
}

// Fetch court URLs count for donut chart
export async function fetchCourtUrlCount(): Promise<TotalUrlCountStats[]> {
  return await withDashbDbConnection(async (connection: Connection) => {
    const query = `SELECT 
      'court' as source_type,
      COUNT(cl.caselist_id) as url_count
    FROM case_listdata cl
    JOIN case_order co ON cl.order_id = co.order_id
    WHERE cl.order_id IS NOT NULL AND cl.order_id <> 0`;

    const [queryResult] = await connection.query(query);
    const row = (queryResult as any[])[0];

    return [
      {
        source_type: row.source_type,
        url_count: row.url_count,
        total_urls: row.url_count,
      },
    ] as TotalUrlCountStats[];
  });
}

// Fetch AI imported URLs count for donut chart
export async function fetchAIUrlCount(): Promise<TotalUrlCountStats[]> {
  return await withDashbDbConnection(async (connection: Connection) => {
    const queries = [
      // Total count
      `SELECT 
        'total' as source_type,
        COUNT(DISTINCT caselist_id) as url_count
      FROM case_listdata`,

      // AI count
      `SELECT 
        'ai' as source_type,
        COUNT(DISTINCT cl.caselist_id) as url_count
      FROM case_listdata cl
      JOIN case_category cc ON cc.category_id = cl.category_id
      JOIN case_group cg ON cg.group_id = cc.group_id
      JOIN case_data cd ON cd.case_id = cl.case_id AND cd.group_id = cg.group_id
      JOIN admin_main am ON am.id_member = cd.admin_id
      JOIN tb_userdepartment ud ON ud.department_id = am.superadmin
      WHERE ud.department_type = '3'`,
    ];

    const results = [];
    let totalUrls = 0;

    for (const query of queries) {
      const [queryResult] = await connection.query(query);
      const row = (queryResult as any[])[0];
      results.push({
        source_type: row.source_type,
        url_count: row.url_count,
      });

      if (row.source_type === "total") {
        totalUrls = row.url_count;
      }
    }

    // Add total_urls to all results
    return results.map((result) => ({
      ...result,
      total_urls: totalUrls,
    })) as TotalUrlCountStats[];
  });
}

// ฟังก์ชันสำหรับเว็บไซต์ผิดกฎหมายที่นำเข้าโดยโครงการ AI (แยกตามวันที่)
export async function fetchUrlsByDateAI(
  startDate?: string,
  endDate?: string,
  sourceType?: string,
  selectedGroups?: string[]
): Promise<UrlsByDateStats[]> {
  return await withDashbDbConnection(async (connection: Connection) => {
    let query = `SELECT DATE(cl.creatdate) as date, cg.group_name, COUNT(cl.caselist_id) AS url_count
FROM case_listdata cl
JOIN case_category cc ON cc.category_id = cl.category_id
JOIN case_group cg ON cg.group_id = cc.group_id
JOIN case_data cd ON cd.case_id = cl.case_id AND cd.group_id = cg.group_id
JOIN admin_main am ON am.id_member = cd.admin_id
JOIN tb_userdepartment ud ON ud.department_id = am.superadmin`;
    const params: any[] = [];
    let where = " ud.department_type = '3'"; // เฉพาะหน่วยงานที่เกี่ยวข้องกับ AI
    // Filter ตาม sourceType (เหมือนต้นแบบ)
    if (sourceType === "petition") {
      // ensure petition_id is present and not zero
      where += " AND cl.petition_id IS NOT NULL AND cl.petition_id <> 0";
    } else if (sourceType === "court") {
      where += " AND cl.order_id IS NOT NULL AND cl.order_id <> 0";
    }
    // Filter วันที่
    if (startDate) {
      where += " AND cl.creatdate >= ?";
      params.push(startDate + " 00:00:00");
    }
    if (endDate) {
      where += " AND cl.creatdate <= ?";
      params.push(endDate + " 23:59:59");
    }
    if (selectedGroups && selectedGroups.length > 0) {
      where += " AND cg.group_id IN (?)";
      params.push(selectedGroups);
    }

    query += ` WHERE ${where}`;
    query +=
      " GROUP BY DATE(cl.creatdate), cg.group_name ORDER BY date ASC, cg.group_name";

    const [results] = await connection.query(query, params);
    return results as UrlsByDateStats[];
  });
}

export async function fetchUrlProcessingTimes(
  startDate?: string,
  endDate?: string,
  sourceType: string = "court", // default: มีคำสั่งศาล
  durationType: string = "url_to_court", // default: ทั้งหมด
  selectedGroups?: string[]
): Promise<any[]> {
  return await withDashbDbConnection(async (connection: Connection) => {
    // Mapping ภาษาไทย -> ค่าภาษาอังกฤษที่ใช้ในระบบ
    const sourceTypeMap: Record<string, string> = {
      "บันทึก URL": "url",
      มีคำร้อง: "petition",
      "มีคำร้อง+คำสั่งศาล": "court",
    };
    const durationTypeMap: Record<string, string> = {
      "บันทึก URL-หน่วยงานต้นทางตรวจสอบ": "url_to_inspect1",
      "หน่วยงานต้นทางตรวจสอบ-หน่วยงานกฎหมายตรวจสอบ": "inspect1_to_inspect2",
      "หน่วยงานกฎหมายตรวจสอบ-วันที่มีคำร้อง": "inspect2_to_petition",
      "วันที่มีคำร้อง-วันที่มีคำสั่งศาล": "petition_to_court",
      "ทั้งหมด (บันทึก URL-วันที่มีคำสั่งศาล)": "url_to_court",
    };
    if (sourceTypeMap[sourceType]) sourceType = sourceTypeMap[sourceType];
    if (durationTypeMap[durationType])
      durationType = durationTypeMap[durationType];

    // เงื่อนไข sourceType
    let where = "cl.approve = '1'";
    if (sourceType === "url") {
      where += " AND cl.petition_id IS NULL AND cl.order_id IS NULL";
    } else if (sourceType === "petition") {
      // ensure petition_id is present and not zero, and no order yet
      where +=
        " AND cl.petition_id IS NOT NULL AND cl.petition_id <> 0 AND cl.order_id IS NULL";
    } else if (sourceType === "court") {
      where += " AND cl.order_id IS NOT NULL AND cl.order_id <> 0";
    }

    // เลือกฟิลด์สำหรับคำนวณช่วงเวลา (ชั่วโมงเท่านั้น)
    let selectField = "";
    if (durationType === "url_to_inspect1") {
      selectField =
        "ROUND(AVG(TIMESTAMPDIFF(HOUR, cl.creatdate, cl.round_date)), 1) as avg_hours";
      where += " AND cl.creatdate IS NOT NULL AND cl.round_date IS NOT NULL";
    } else if (durationType === "inspect1_to_inspect2") {
      selectField =
        "ROUND(AVG(TIMESTAMPDIFF(HOUR, cl.round_date, cl.approve_date)), 1) as avg_hours";
      where += " AND cl.round_date IS NOT NULL AND cl.approve_date IS NOT NULL";
    } else if (durationType === "inspect2_to_petition") {
      selectField =
        "ROUND(AVG(TIMESTAMPDIFF(HOUR, cl.approve_date, cl.petition_date)), 1) as avg_hours";
      where +=
        " AND cl.approve_date IS NOT NULL AND cl.petition_date IS NOT NULL";
    } else if (durationType === "petition_to_court") {
      selectField =
        "ROUND(AVG(TIMESTAMPDIFF(HOUR, cl.petition_date, co.orderred_date)), 1) as avg_hours";
      where +=
        " AND cl.petition_date IS NOT NULL AND co.orderred_date IS NOT NULL";
    } else {
      // ทั้งหมด (url.create_date - orderred_date)
      selectField =
        "ROUND(AVG(TIMESTAMPDIFF(HOUR, cl.creatdate, co.orderred_date)), 1) as avg_hours";
      where += " AND cl.creatdate IS NOT NULL AND co.orderred_date IS NOT NULL";
    }

    // กำหนด group by
    const groupBy = "cg.group_id, cg.group_name";

    // สร้าง query
    let query = `
      SELECT cg.group_name, ${selectField}
      FROM case_listdata cl
      JOIN case_category cc ON cl.category_id = cc.category_id
      JOIN case_group cg ON cg.group_id = cc.group_id
      LEFT JOIN case_order co ON cl.order_id = co.order_id
      WHERE ${where}
    `;

    // Add date filter if provided
    const params: any[] = [];
    if (startDate) {
      query += " AND cl.creatdate >= ?";
      params.push(startDate + " 00:00:00");
    }
    if (endDate) {
      query += " AND cl.creatdate <= ?";
      params.push(endDate + " 23:59:59");
    }
    if (selectedGroups && selectedGroups.length > 0) {
      query += " AND cg.group_id IN (?)";
      params.push(selectedGroups);
    }

    query += ` GROUP BY ${groupBy} ORDER BY cg.group_name`;

    const [results]: any = await connection.query(query, params);
    return results as any[];
  });
}

// Fetch URLs by month and group with month filter option
export interface UrlsByMonthStats {
  month: string;
  group_name: string;
  url_count: number;
}

export async function fetchUrlsByMonthAndGroup(
  startMonth?: string,
  endMonth?: string,
  sourceType?: string,
  p0?: string[] | undefined
): Promise<UrlsByMonthStats[]> {
  return await withDashbDbConnection(async (connection: Connection) => {
    let query = `SELECT DATE_FORMAT(cl.creatdate, '%Y-%m') as month, cg.group_name, COUNT(cl.case_id) as url_count
FROM case_listdata cl
JOIN case_category cc ON cl.category_id = cc.category_id
JOIN case_group cg ON cg.group_id = cc.group_id`;

    const params: any[] = [];
    let where = "";

    // Add sourceType filter if provided
    if (sourceType === "petition") {
      where += " JOIN petition_data pd ON cl.petition_id = pd.petition_id";
      // ensure petition_id is present and not zero
      where +=
        (where ? " AND " : " WHERE ") +
        "cl.petition_id IS NOT NULL AND cl.petition_id <> 0";
    } else if (sourceType === "court") {
      where += " JOIN case_order co ON cl.order_id = co.order_id";
      where +=
        (where ? " AND " : " WHERE ") +
        "cl.order_id IS NOT NULL AND cl.order_id <> 0";
    }

    // Add sourceType filter if provided
    if (sourceType === "petition") {
      // ensure petition_id is present and not zero
      where += " AND cl.petition_id IS NOT NULL AND cl.petition_id <> 0";
    } else if (sourceType === "court") {
      where += " AND cl.order_id IS NOT NULL AND cl.order_id <> 0";
    }

    // Add month filter if provided
    if (startMonth) {
      where += (where ? " AND " : " WHERE ") + "cl.creatdate >= ?";
      params.push(startMonth + "-01 00:00:00");
    }

    if (endMonth) {
      const [y, m] = endMonth.split("-");
      const lastDay = new Date(Number(y), Number(m), 0).getDate();
      where += (where ? " AND " : " WHERE ") + "cl.creatdate <= ?";
      params.push(`${endMonth}-${lastDay} 23:59:59`);
    }

    query += where;
    query +=
      " GROUP BY DATE_FORMAT(cl.creatdate, '%Y-%m'), cg.group_id, cg.group_name ORDER BY month ASC, cg.group_name";

    console.log(`[urlstats] Executing query: ${query}`, params);

    const [results]: any = await connection.query(query, params);
    return results.map((row: any) => ({
      month: row.month,
      group_name: row.group_name,
      url_count: row.url_count,
    })) as UrlsByMonthStats[];
  });
}

// ฟังก์ชันสำหรับเว็บไซต์ผิดกฎหมายที่นำเข้าโดยโครงการ AI (แยกตามเดือน)
export async function fetchUrlsByMonthAI(
  startMonth?: string,
  endMonth?: string,
  sourceType?: string,
  selectedGroups?: string[]
): Promise<UrlsByMonthStats[]> {
  return await withDashbDbConnection(async (connection: Connection) => {
    let query = `SELECT DATE_FORMAT(cl.creatdate, '%Y-%m') as month, cg.group_name, COUNT(cl.caselist_id) as url_count
FROM case_listdata cl
JOIN case_category cc ON cc.category_id = cl.category_id
JOIN case_group cg ON cg.group_id = cc.group_id
JOIN case_data cd ON cd.case_id = cl.case_id AND cd.group_id = cg.group_id
JOIN admin_main am ON am.id_member = cd.admin_id
JOIN tb_userdepartment ud ON ud.department_id = am.superadmin`;
    const params: any[] = [];
    let where = " ud.department_type = '3'"; // เฉพาะหน่วยงานที่เกี่ยวข้องกับ AI
    // Filter ตาม sourceType (เหมือนต้นแบบ)
    if (sourceType === "petition") {
      // ensure petition_id is present and not zero
      where += " AND cl.petition_id IS NOT NULL AND cl.petition_id <> 0";
    } else if (sourceType === "court") {
      where += " AND cl.order_id IS NOT NULL AND cl.order_id <> 0";
    }
    // Filter เดือน
    if (startMonth) {
      where += " AND cl.creatdate >= ?";
      params.push(startMonth + "-01 00:00:00");
    }
    if (endMonth) {
      const [y, m] = endMonth.split("-");
      const lastDay = new Date(Number(y), Number(m), 0).getDate();
      where += " AND cl.creatdate <= ?";
      params.push(`${endMonth}-${lastDay} 23:59:59`);
    }
    if (selectedGroups && selectedGroups.length > 0) {
      where += " AND cg.group_id IN (?)";
      params.push(selectedGroups);
    }
    query += ` WHERE${where}`;
    query +=
      " GROUP BY DATE_FORMAT(cl.creatdate, '%Y-%m'), cg.group_name ORDER BY month ASC, cg.group_name";
    const [results] = await connection.query(query, params);
    return results as UrlsByMonthStats[];
  });
}

// Top Organizations interface
export interface TopOfficeStats {
  department_id: number;
  department_name: string;
  url_count: number;
  total_urls?: number;
  percentage?: number;
}

export interface TopCategoryStats {
  group_id: number;
  group_name: string;
  contract_count: number;
  compliance_rate: number;
  total_urls?: number;
  percentage?: number;
}

export interface TopCourtStats {
  group_id: number;
  group_name: string;
  court_count: number;
  url_count: number;
  compliance_rate: number;
  total_orders?: number;
  total_urls?: number;
  percentage?: number;
}

// Fetch top organizations by URL count from AI data
export async function fetchTopOffice(): Promise<TopOfficeStats[]> {
  return await withDashbDbConnection(async (connection: Connection) => {
    const query = `
      SELECT 
        ud.department_id,
        ud.department_name,
        COUNT(DISTINCT cl.caselist_id) as url_count
      FROM case_listdata cl
      JOIN case_category cc ON cc.category_id = cl.category_id
      JOIN case_group cg ON cg.group_id = cc.group_id
      JOIN case_data cd ON cd.case_id = cl.case_id AND cd.group_id = cg.group_id
      JOIN admin_main am ON am.id_member = cd.admin_id
      JOIN tb_userdepartment ud ON ud.department_id = am.superadmin
      GROUP BY ud.department_id, ud.department_name
      ORDER BY url_count DESC
    `;

    const [results] = await connection.query(query);
    const topOfficeResults = results as TopOfficeStats[];

    // Get total URL count using fetchTotalUrlCount
    const totalUrlStats = await fetchTotalUrlCount();
    const totalUrls =
      totalUrlStats.find((stat) => stat.source_type === "total")?.url_count ||
      0;

    // Add total_urls and percentage to each result
    return topOfficeResults.map((office) => ({
      ...office,
      total_urls: totalUrls,
      percentage:
        totalUrls > 0
          ? Math.round((office.url_count / totalUrls) * 100 * 100) / 100
          : 0,
    }));
  });
}

// Fetch top categories by URL count without case_order
export async function fetchTopCategory(): Promise<TopCategoryStats[]> {
  return await withDashbDbConnection(async (connection: Connection) => {
    const query = `
      SELECT 
        cg.group_id,
        cg.group_name,
        COUNT(DISTINCT cl.caselist_id) as contract_count
      FROM case_listdata cl
      JOIN case_category cc ON cc.category_id = cl.category_id
      JOIN case_group cg ON cg.group_id = cc.group_id
      GROUP BY cg.group_id, cg.group_name
      HAVING contract_count > 0
      ORDER BY contract_count DESC
    `;

    const [results] = await connection.query(query);
    const topCategoryResults = results as TopCategoryStats[];

    // Get total URL count using fetchTotalUrlCount
    const totalUrlStats = await fetchTotalUrlCount();
    const totalUrls =
      totalUrlStats.find((stat) => stat.source_type === "total")?.url_count ||
      0;

    // Add total_urls, percentage, and compliance_rate to each result
    return topCategoryResults.map((category) => ({
      ...category,
      total_urls: totalUrls,
      percentage:
        totalUrls > 0
          ? Math.round((category.contract_count / totalUrls) * 100 * 100) / 100
          : 0,
      compliance_rate:
        totalUrls > 0
          ? Math.round((category.contract_count / totalUrls) * 100 * 100) / 100
          : 0,
    }));
  });
}

// Fetch top court categories by case_order count
export async function fetchTopCourt(): Promise<TopCourtStats[]> {
  return await withDashbDbConnection(async (connection: Connection) => {
    // First get total orders count
    const totalQuery = `SELECT COUNT(DISTINCT order_id) as total_count FROM case_order`;
    const [totalResult] = await connection.query(totalQuery);
    const totalOrders = (totalResult as any[])[0]?.total_count || 0;

    // Get total URLs count (only URLs with order_id)
    const totalUrlsQuery = `SELECT COUNT(cl.caselist_id) as url_count
      FROM case_listdata cl
      JOIN case_order co ON cl.order_id = co.order_id
      WHERE cl.order_id IS NOT NULL AND cl.order_id <> 0`;
    const [totalUrlsResult] = await connection.query(totalUrlsQuery);
    const totalUrls = (totalUrlsResult as any[])[0]?.url_count || 0;

    const query = `
      SELECT 
        cg.group_id,
        cg.group_name,
        COUNT(DISTINCT co.order_id) as court_count,
        COUNT(DISTINCT cl.caselist_id) as url_count
      FROM case_listdata cl
      JOIN case_category cc ON cc.category_id = cl.category_id
      JOIN case_group cg ON cg.group_id = cc.group_id
      JOIN case_order co ON cl.order_id = co.order_id
      WHERE cl.order_id IS NOT NULL AND cl.order_id <> 0
      GROUP BY cg.group_id, cg.group_name
      ORDER BY court_count DESC
    `;

    const [results] = await connection.query(query);
    const topCourtResults = results as TopCourtStats[];

    // Add total_orders, total_urls, percentage, and compliance_rate to each result
    return topCourtResults.map((court) => ({
      ...court,
      total_orders: totalOrders,
      total_urls: totalUrls,
      percentage:
        totalOrders > 0
          ? Math.round((court.court_count / totalOrders) * 100 * 100) / 100
          : 0,
      compliance_rate:
        totalUrls > 0
          ? Math.round((court.url_count / totalUrls) * 100 * 100) / 100
          : 0,
    }));
  });
}

// Types for Yearly Trends
export interface YearlyTrendCategory {
  name: string;
  count: number;
  percentage: number;
}

export interface YearlyTrendData {
  year: number;
  month?: string;
  categories: YearlyTrendCategory[];
  order_id?: string | undefined;
}

// Fetch yearly trends with top categories per year
export async function fetchYearlyTrends(
  yearsBack: number = 5,
  toprank: number = 2
): Promise<YearlyTrendData[]> {
  return await withDashbDbConnection(async (connection) => {
    const currentYear = new Date().getFullYear();
    const yearlyTrends: YearlyTrendData[] = [];

    for (let i = yearsBack - 1; i >= 0; i--) {
      const year = currentYear - i;
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      // Get top categories for this year (only URLs with order_id)
      const query = `
        SELECT 
          cg.group_name as name,
          COUNT(cl.caselist_id) as count
        FROM case_listdata cl
        JOIN case_category cc ON cc.category_id = cl.category_id
        JOIN case_group cg ON cg.group_id = cc.group_id
        JOIN case_order co ON cl.order_id = co.order_id
        WHERE co.orderred_date >= ? AND co.orderred_date <= ?
            AND cl.order_id IS NOT NULL AND cl.order_id <> 0
        GROUP BY cg.group_id, cg.group_name
        ORDER BY count DESC
        LIMIT ?
      `;

      const [results] = await connection.query(query, [
        startDate + " 00:00:00",
        endDate + " 23:59:59",
        toprank,
      ]);

      const categoryResults = results as Array<{
        name: string;
        count: number;
      }>;

      // Get total URLs for this year to calculate percentages (only URLs with order_id)
      const totalQuery = `
        SELECT COUNT(cl.caselist_id) as total_count
        FROM case_listdata cl
        JOIN case_order co ON cl.order_id = co.order_id
        WHERE co.orderred_date >= ? AND co.orderred_date <= ?
      AND cl.order_id IS NOT NULL AND cl.order_id <> 0
      `;

      const [totalResult] = await connection.query(totalQuery, [
        startDate + " 00:00:00",
        endDate + " 23:59:59",
      ]);

      const totalCount = (totalResult as any[])[0]?.total_count || 0;

      // Calculate percentages with 2 decimal places
      let categories: YearlyTrendCategory[] = [];
      if (categoryResults.length > 0 && totalCount > 0) {
        categories = categoryResults.map((category) => ({
          name: category.name,
          count: category.count,
          percentage:
            Math.round((category.count / totalCount) * 100 * 100) / 100,
        }));
      }

      // Ensure we always have at least some categories, even if empty
      while (categories.length < toprank) {
        categories.push({
          name: `No Data ${categories.length + 1}`,
          count: 0,
          percentage: 0,
        });
      }

      // Always fetch order_id, even if no data
      let orderId: string | undefined = undefined;
      if (totalCount > 0) {
        const orderIdQuery = `
          SELECT DISTINCT co.order_id
          FROM case_listdata cl
          JOIN case_order co ON cl.order_id = co.order_id
          WHERE co.orderred_date >= ? AND co.orderred_date <= ?
              AND cl.order_id IS NOT NULL AND cl.order_id <> 0
            LIMIT 1
        `;
        const [orderIdResult] = await connection.query(orderIdQuery, [
          startDate + " 00:00:00",
          endDate + " 23:59:59",
        ]);
        orderId = (orderIdResult as any[])[0]?.order_id || undefined;
      }

      yearlyTrends.push({
        year,
        categories,
        order_id: orderId,
      });
    }
    return yearlyTrends;
  });
}

// Fetch monthly trends with top categories per month
export async function fetchMonthlyTrends(
  monthsBack: number = 5,
  toprank: number = 2
): Promise<YearlyTrendData[]> {
  return await withDashbDbConnection(async (connection: Connection) => {
    const currentDate = new Date();
    const monthlyTrends: YearlyTrendData[] = [];

    for (let i = monthsBack - 1; i >= 0; i--) {
      const targetDate = new Date(currentDate);
      targetDate.setMonth(currentDate.getMonth() - i);
      const year = targetDate.getFullYear();
      const month = (targetDate.getMonth() + 1).toString().padStart(2, "0");
      const startDate = `${year}-${month}-01`;
      const endDate = `${year}-${month}-${new Date(
        year,
        parseInt(month),
        0
      ).getDate()}`;

      const query = `
        SELECT 
          cg.group_name as name,
          COUNT(cl.caselist_id) as count
        FROM case_listdata cl
        JOIN case_category cc ON cc.category_id = cl.category_id
        JOIN case_group cg ON cg.group_id = cc.group_id
        JOIN case_order co ON cl.order_id = co.order_id
        WHERE co.orderred_date >= ? AND co.orderred_date <= ?
            AND cl.order_id IS NOT NULL AND cl.order_id <> 0
        GROUP BY cg.group_id, cg.group_name
        ORDER BY count DESC
        LIMIT ?
      `;

      const [results] = await connection.query(query, [
        startDate + " 00:00:00",
        endDate + " 23:59:59",
        toprank,
      ]);

      const categoryResults = results as Array<{
        name: string;
        count: number;
      }>;

      const totalQuery = `
        SELECT COUNT(cl.caselist_id) as total_count
        FROM case_listdata cl
        JOIN case_order co ON cl.order_id = co.order_id
        WHERE co.orderred_date >= ? AND co.orderred_date <= ?
            AND cl.order_id IS NOT NULL AND cl.order_id <> 0
      `;

      const [totalResult] = await connection.query(totalQuery, [
        startDate + " 00:00:00",
        endDate + " 23:59:59",
      ]);

      const totalCount = (totalResult as any[])[0]?.total_count || 0;

      let categories: YearlyTrendCategory[] = [];
      if (categoryResults.length > 0 && totalCount > 0) {
        categories = categoryResults.map((category) => ({
          name: category.name,
          count: category.count,
          percentage:
            Math.round((category.count / totalCount) * 100 * 100) / 100,
        }));
      }

      while (categories.length < toprank) {
        categories.push({
          name: `No Data ${categories.length + 1}`,
          count: 0,
          percentage: 0,
        });
      }

      // include a machine-friendly month string so clients (frontend) can
      // reliably render monthly trend charts. Format: YYYY-MM
      monthlyTrends.push({
        year: year,
        month: `${year}-${month}`,
        categories,
      });
    }
    return monthlyTrends;
  });
}

// Interface for Procurement Cycle Time yearly data
export interface ProcurementCycleData {
  year: string;
  lines: {
    name: string;
    avgDays: number;
    urlCount: number;
    avgHours: number;
    avgMs: number;
  }[];
}

export async function fetchProcessTimes(
  yearsBack: number = 3
): Promise<ProcurementCycleData[]> {
  return await withDashbDbConnection(async (connection: Connection) => {
    const currentYear = new Date().getFullYear();
    const years = Array.from(
      { length: yearsBack },
      (_, i) => currentYear - i
    ).reverse();

    const procurementData: ProcurementCycleData[] = [];

    // Define the processing stages
    const processingStages = [
      {
        name: "บันทึก URL-หน่วยงานต้นทางตรวจสอบ",
        type: "url_to_inspect1",
      },
      {
        name: "หน่วยงานต้นทางตรวจสอบ-หน่วยงานกฎหมายตรวจสอบ",
        type: "inspect1_to_inspect2",
      },
      {
        name: "หน่วยงานกฎหมายตรวจสอบ-วันที่มีคำร้อง",
        type: "inspect2_to_petition",
      },
      {
        name: "วันที่มีคำร้อง-วันที่มีคำสั่งศาล",
        type: "petition_to_court",
      },
      {
        name: "ทั้งหมด (บันทึก URL-วันที่มีคำสั่งศาล)",
        type: "url_to_court",
      },
    ];

    for (const year of years) {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      const lines: {
        name: string;
        avgDays: number;
        urlCount: number;
        avgHours: number;
        avgMs: number;
      }[] = [];

      for (const stage of processingStages) {
        // We'll compute total hours sum and count of URLs that have both timestamps
        // then derive average hours per URL and also provide milliseconds (avgMs).
        let hoursDiffExpr = "";
        let where =
          "cl.approve = '1' AND cl.order_id IS NOT NULL AND cl.order_id <> 0";

        if (stage.type === "url_to_inspect1") {
          hoursDiffExpr = "TIMESTAMPDIFF(HOUR, cl.creatdate, cl.round_date)";
          where +=
            " AND cl.creatdate IS NOT NULL AND cl.round_date IS NOT NULL";
        } else if (stage.type === "inspect1_to_inspect2") {
          hoursDiffExpr = "TIMESTAMPDIFF(HOUR, cl.round_date, cl.approve_date)";
          where +=
            " AND cl.round_date IS NOT NULL AND cl.approve_date IS NOT NULL";
        } else if (stage.type === "inspect2_to_petition") {
          hoursDiffExpr =
            "TIMESTAMPDIFF(HOUR, cl.approve_date, cl.petition_date)";
          where +=
            " AND cl.approve_date IS NOT NULL AND cl.petition_date IS NOT NULL";
        } else if (stage.type === "petition_to_court") {
          hoursDiffExpr =
            "TIMESTAMPDIFF(HOUR, cl.petition_date, co.orderred_date)";
          where +=
            " AND cl.petition_date IS NOT NULL AND co.orderred_date IS NOT NULL";
        } else {
          // url_to_court
          hoursDiffExpr = "TIMESTAMPDIFF(HOUR, cl.creatdate, co.orderred_date)";
          where +=
            " AND cl.creatdate IS NOT NULL AND co.orderred_date IS NOT NULL";
        }

        // Query returns total_hours (SUM of hour differences) and url_count (rows considered)
        const query = `
          SELECT
            COALESCE(SUM(${hoursDiffExpr}), 0) as total_hours,
            COUNT(1) as url_count
          FROM case_listdata cl
          LEFT JOIN case_order co ON cl.order_id = co.order_id
          WHERE ${where}
            AND cl.creatdate >= ?
            AND cl.creatdate <= ?
        `;

        const params = [startDate + " 00:00:00", endDate + " 23:59:59"];

        try {
          const [results]: any = await connection.query(query, params);
          const totalHours = Number(results[0]?.total_hours) || 0;
          const urlCount = Number(results[0]?.url_count) || 0;

          // average hours per URL (avoid division by zero)
          const avgHours = urlCount > 0 ? totalHours / urlCount : 0;
          // provide average in days (1 day = 24 hours) as before for compatibility
          const avgDays = Math.round((avgHours / 24) * 10) / 10; // one decimal
          // average in milliseconds for clients that need ms
          const avgMs = Math.round(avgHours * 3600 * 1000);

          lines.push({
            name: stage.name,
            avgDays: Number(avgDays) || 0,
            urlCount,
            avgHours: Math.round(avgHours * 10) / 10,
            avgMs,
          });
        } catch (error) {
          console.error(
            `Error fetching data for ${stage.name} in ${year}:`,
            error
          );
          lines.push({
            name: stage.name,
            avgDays: 0,
            urlCount: 0,
            avgHours: 0,
            avgMs: 0,
          });
        }
      }

      procurementData.push({
        year: year.toString(),
        lines,
      });
    }

    return procurementData;
  });
}

export async function fetchUrlStatsByPlatform(): Promise<
  { platform: string; url_count: number }[]
> {
  return await withDashbDbConnection(async (connection: Connection) => {
    const cases: string[] = [];
    const params: string[] = [];

    // Filter only platforms with defined domains
    const hostExpr =
      "LOWER(SUBSTRING_INDEX(SUBSTRING_INDEX(caselist_url, '://', -1), '/', 1))";
    Object.entries(PLATFORM_DOMAINS)
      .filter(([_, domains]) => domains.length > 0)
      .forEach(([platform, domains]) => {
        const checks = domains
          .map((domain) => {
            // For each domain, check either exact hostname match
            // or subdomain match (*.example.com) using LIKE '%.example.com'
            params.push(domain.toLowerCase());
            params.push(domain.toLowerCase());
            return `(${hostExpr} = ? OR ${hostExpr} LIKE CONCAT('%.', ?))`;
          })
          .join(" OR ");

        cases.push(`WHEN ${checks} THEN ?`);
        params.push(platform);
      });

    const query = `
      SELECT
        CASE
          ${cases.join("\n          ")}
          ELSE 'Other'
        END as platform,
        COUNT(*) as url_count
      FROM case_listdata
      WHERE caselist_url IS NOT NULL 
        AND caselist_url != ''
      GROUP BY platform
      HAVING url_count > 0
      ORDER BY url_count DESC
    `;

    const [results]: any = await connection.query(query, params);

    return results.map((row: any) => ({
      platform: row.platform,
      url_count: parseInt(row.url_count, 10),
    }));
  });
}

export const PLATFORM_DOMAINS: Record<string, string[]> = {
  // Social Media - Global
  Facebook: ["facebook.com", "fb.com", "fb.me", "messenger.com", "fbcdn.net"],
  Twitter: ["twitter.com", "x.com", "t.co", "twimg.com"],
  Instagram: ["instagram.com", "instagr.am"],
  TikTok: ["tiktok.com", "tiktokv.com", "musical.ly"],
  LinkedIn: ["linkedin.com", "lnkd.in"],
  Snapchat: ["snapchat.com", "snap.com"],
  Pinterest: ["pinterest.com", "pin.it"],
  Reddit: ["reddit.com", "redd.it"],
  Tumblr: ["tumblr.com"],
  WhatsApp: ["whatsapp.com", "wa.me"],
  Discord: ["discord.com", "discord.gg"],

  // Video Platforms & Streaming
  YouTube: ["youtube.com", "youtu.be", "ytimg.com", "googlevideo.com"],
  Vimeo: ["vimeo.com"],
  Twitch: ["twitch.tv"],
  Dailymotion: ["dailymotion.com"],
  Netflix: ["netflix.com"],
  Bilibili: ["bilibili.com"],
  TrueID: ["trueid.net", "trueid.co.th"], // แพลตฟอร์มสตรีมมิ่งของไทย

  // Messaging Apps
  Telegram: ["telegram.org", "t.me", "telegram.me"],
  Line: ["line.me", "line.naver.jp", "linecorp.com"], // เพิ่ม Line (สำคัญในไทย)
  Slack: ["slack.com"],
  WeChat: ["wechat.com", "weixin.qq.com"],
  Viber: ["viber.com"],
  Signal: ["signal.org"],
  Skype: ["skype.com"],

  // Asian & Regional Social Media/Portals
  Weibo: ["weibo.com", "weibo.cn"],
  QQ: ["qq.com", "qzone.qq.com"],
  Douyin: ["douyin.com"],
  Baidu: ["baidu.com"],
  VK: ["vk.com", "vkontakte.ru"],
  Odnoklassniki: ["ok.ru"],
  Naver: ["naver.com"],
  Zalo: ["zalo.me"],
  // แพลตฟอร์มหลักของไทย
  Pantip: ["pantip.com"], // เว็บบอร์ดไทย
  Sanook: ["sanook.com"], // พอร์ทัลไทย
  Kapook: ["kapook.com"], // พอร์ทัลไทย
  Thairath: ["thairath.co.th"], // ข่าวไทย
  Manager: ["mgronline.com"], // ข่าวไทย

  // Blogging & Content Platforms
  Medium: ["medium.com"],
  Substack: ["substack.com"],
  Blogspot: ["blogspot.com", "blogger.com"],
  WordPress: ["wordpress.com", "wordpress.org", "wp.com"],
  Wix: ["wix.com", "wixsite.com"],
  Ghost: ["ghost.org", "ghost.io"],
  Wikipedia: ["wikipedia.org"],
  Fandom: ["fandom.com"],

  // Professional & Business
  Behance: ["behance.net"],
  Dribbble: ["dribbble.com"],
  GitHub: ["github.com", "github.io"],
  GitLab: ["gitlab.com"],
  "Stack Overflow": ["stackoverflow.com", "stackexchange.com"],
  Microsoft: ["microsoft.com"],
  Canva: ["canva.com"],

  // Search Engines & AI
  Google: [
    "google.com",
    "goo.gl",
    "g.co",
    "google.co.th", // ไทย
    "google.co.uk",
    "google.co.jp",
    "googleapis.com",
    "gstatic.com",
  ],
  Bing: ["bing.com", "live.com"],
  Yahoo: ["yahoo.com", "yahoo.co.jp"],
  DuckDuckGo: ["duckduckgo.com"],
  Yandex: ["yandex.ru"],
  ChatGPT: ["chatgpt.com"],
  Gemini: ["gemini.google.com"],

  // E-commerce & Food Delivery
  Amazon: [
    "amazon.com",
    "amzn.to",
    "amazon.co.uk",
    "amazon.co.jp",
    "aws.amazon.com",
  ],
  eBay: ["ebay.com"],
  Alibaba: ["alibaba.com", "aliexpress.com"],
  Shopee: ["shopee.com", "shopee.co.th", "shopee.sg"], // ไทย
  Lazada: ["lazada.com", "lazada.co.th", "lazada.sg"], // ไทย
  Temu: ["temu.com"],
  Grab: ["grab.com", "grab.co.th"], // Food/Ride-hailing ไทย/SEA
  Foodpanda: ["foodpanda.co.th", "foodpanda.com"], // Food Delivery ไทย

  // Music & Audio
  Spotify: ["spotify.com", "spotify.link"],
  "Apple Music": ["music.apple.com"],
  SoundCloud: ["soundcloud.com"],

  // News & Media
  BBC: ["bbc.com", "bbc.co.uk"],
  CNN: ["cnn.com"],
  "New York Times": ["nytimes.com", "nyti.ms"],
  Dzen: ["dzen.ru"],
  Globo: ["globo.com"],

  // Travel & Booking (เพิ่มหมวดหมู่)
  Agoda: ["agoda.com"],
  Booking: ["booking.com"],
  AirAsia: ["airasia.com"], // สายการบินภูมิภาค

  // Banking & Finance (เพิ่มหมวดหมู่)
  SCB: ["scb.co.th"], // ธนาคารไทย
  KBank: ["kasikornbank.com", "kbank.co.th"], // ธนาคารไทย
  Krungthai: ["krungthai.com"], // ธนาคารไทย

  // File Sharing & Cloud
  Dropbox: ["dropbox.com", "db.tt"],
  "Google Drive": ["drive.google.com"],
  OneDrive: ["onedrive.com", "1drv.ms"],
  "Microsoft 365/Office": ["office.com", "sharepoint.com"],

  // URL Shorteners
  Bitly: ["bit.ly", "bitly.com"],
  TinyURL: ["tinyurl.com"],

  // Dating & Social
  Tinder: ["tinder.com"],
  Bumble: ["bumble.com"],

  // Gaming
  Steam: ["steampowered.com", "steamcommunity.com"],
  "Epic Games": ["epicgames.com"],
  Roblox: ["roblox.com"],

  // Adult Entertainment
  Pornhub: ["pornhub.com", "phncdn.com", "pornhub.net"],
  XVideos: ["xvideos.com", "xvideos.es", "xvideo.com"],
  XHamster: ["xhamster.com", "xhamsterlive.com"],
  YouPorn: ["youporn.com"],
  RedTube: ["redtube.com"],
  Stripchat: ["stripchat.com"],
  LiveJasmin: ["livejasmin.com"],
  Chaturbate: ["chaturbate.com"],
  Brazzers: ["brazzers.com"],
  "xHamster Gay": ["gay.xhamster.com"],
  "TLD .xxx": ["xxx"],

  Other: [], // fallback for unknown domains
};

export async function fetchUrlStatsByRegisterCountry(): Promise<
  { country: string; count: number }[]
> {
  return await withDashbDbConnection(async (connection: Connection) => {
    const cases: string[] = [];
    const params: string[] = [];
    // Build CASE statements for countries, excluding those with empty keywords
    Object.entries(COUNTRIES).forEach(([country, keywords]) => {
      if (keywords.length === 0) return; // Skip countries with no keywords
      const checks = keywords
        .map((keyword) => {
          params.push(`%${keyword.toLowerCase()}%`);
          return `LOWER(register_country) LIKE ?`;
        })
        .join(" OR ");
      cases.push(`WHEN ${checks} THEN ?`);
      params.push(country);
    });

    const query = `
      SELECT
        CASE
          ${cases.join("\n          ")}
          ELSE 'Other'
        END as country,
        COUNT(*) as count
      FROM
        case_listdata
      GROUP BY
        country
      HAVING count > 0
      ORDER BY count DESC
    `;

    const [rows] = await connection.execute(query, params);
    return rows as { country: string; count: number }[];
  });
}

export const COUNTRIES: Record<string, string[]> = {
  Afghanistan: ["afghanistan"],
  Albania: ["albania"],
  Algeria: ["algeria"],
  Andorra: ["andorra"],
  Angola: ["angola"],
  "Antigua and Barbuda": ["antigua and barbuda"],
  Argentina: ["argentina"],
  Armenia: ["armenia"],
  Australia: ["australia"],
  Austria: ["austria"],
  Azerbaijan: ["azerbaijan"],
  "Bahamas, The": ["bahamas, the"],
  Bahrain: ["bahrain"],
  Bangladesh: ["bangladesh"],
  Barbados: ["barbados"],
  Belarus: ["belarus"],
  Belgium: ["belgium"],
  Belize: ["belize"],
  Benin: ["benin"],
  Bhutan: ["bhutan"],
  Bolivia: ["bolivia"],
  "Bosnia and Herzegovina": ["bosnia and herzegovina"],
  Botswana: ["botswana"],
  Brazil: ["brazil"],
  Brunei: ["brunei"],
  Bulgaria: ["bulgaria"],
  "Burkina Faso": ["burkina faso"],
  Burundi: ["burundi"],
  "Cabo Verde": ["cabo verde"],
  Cambodia: ["cambodia"],
  Cameroon: ["cameroon"],
  Canada: ["canada"],
  "Central African Republic": ["central african republic"],
  Chad: ["chad"],
  Chile: ["chile"],
  China: ["china"],
  Colombia: ["colombia"],
  Comoros: ["comoros"],
  "Congo (Brazzaville)": ["congo (brazzaville)"],
  "Congo (Kinshasa)": ["congo (kinshasa)"],
  "Costa Rica": ["costa rica"],
  "Côte d'Ivoire": ["côte d'ivoire"],
  Croatia: ["croatia"],
  Cuba: ["cuba"],
  Cyprus: ["cyprus"],
  Czechia: ["czechia"],
  Denmark: ["denmark"],
  Djibouti: ["djibouti"],
  Dominica: ["dominica"],
  "Dominican Republic": ["dominican republic"],
  Ecuador: ["ecuador"],
  Egypt: ["egypt"],
  "El Salvador": ["el salvador"],
  "Equatorial Guinea": ["equatorial guinea"],
  Eritrea: ["eritrea"],
  Estonia: ["estonia"],
  Eswatini: ["eswatini"],
  Ethiopia: ["ethiopia"],
  Fiji: ["fiji"],
  Finland: ["finland"],
  France: ["france"],
  Gabon: ["gabon"],
  "Gambia, The": ["gambia, the"],
  Georgia: ["georgia"],
  Germany: ["germany"],
  Ghana: ["ghana"],
  Greece: ["greece"],
  Grenada: ["grenada"],
  Guatemala: ["guatemala"],
  Guinea: ["guinea"],
  "Guinea-Bissau": ["guinea-bissau"],
  Guyana: ["guyana"],
  Haiti: ["haiti"],
  "Holy See": ["holy see"],
  Honduras: ["honduras"],
  Hungary: ["hungary"],
  Iceland: ["iceland"],
  India: ["india"],
  Indonesia: ["indonesia"],
  Iran: ["iran"],
  Iraq: ["iraq"],
  Ireland: ["ireland"],
  Israel: ["israel"],
  Italy: ["italy"],
  Jamaica: ["jamaica"],
  Japan: ["japan"],
  Jordan: ["jordan"],
  Kazakhstan: ["kazakhstan"],
  Kenya: ["kenya"],
  Kiribati: ["kiribati"],
  "Korea (DPRK)": ["korea (dprk)"],
  "Korea (Republic of)": ["korea (republic of)"],
  Kosovo: ["kosovo"],
  Kuwait: ["kuwait"],
  Kyrgyzstan: ["kyrgyzstan"],
  Laos: ["laos"],
  Latvia: ["latvia"],
  Lebanon: ["lebanon"],
  Lesotho: ["lesotho"],
  Liberia: ["liberia"],
  Libya: ["libya"],
  Liechtenstein: ["liechtenstein"],
  Lithuania: ["lithuania"],
  Luxembourg: ["luxembourg"],
  Madagascar: ["madagascar"],
  Malawi: ["malawi"],
  Malaysia: ["malaysia"],
  Maldives: ["maldives"],
  Mali: ["mali"],
  Malta: ["malta"],
  "Marshall Islands": ["marshall islands"],
  Mauritania: ["mauritania"],
  Mauritius: ["mauritius"],
  Mexico: ["mexico"],
  Micronesia: ["micronesia"],
  Moldova: ["moldova"],
  Monaco: ["monaco"],
  Mongolia: ["mongolia"],
  Montenegro: ["montenegro"],
  Morocco: ["morocco"],
  Mozambique: ["mozambique"],
  Myanmar: ["myanmar"],
  Namibia: ["namibia"],
  Nauru: ["nauru"],
  Nepal: ["nepal"],
  Netherlands: ["netherlands"],
  "New Zealand": ["new zealand"],
  Nicaragua: ["nicaragua"],
  Niger: ["niger"],
  Nigeria: ["nigeria"],
  "North Macedonia": ["north macedonia"],
  Norway: ["norway"],
  Oman: ["oman"],
  Pakistan: ["pakistan"],
  Palau: ["palau"],
  Palestine: ["palestine"],
  Panama: ["panama"],
  "Papua New Guinea": ["papua new guinea"],
  Paraguay: ["paraguay"],
  Peru: ["peru"],
  Philippines: ["philippines"],
  Poland: ["poland"],
  Portugal: ["portugal"],
  Qatar: ["qatar"],
  Romania: ["romania"],
  Russia: ["russia"],
  Rwanda: ["rwanda"],
  "Saint Kitts and Nevis": ["saint kitts and nevis"],
  "Saint Lucia": ["saint lucia"],
  "Saint Vincent and the Grenadines": ["saint vincent and the grenadines"],
  Samoa: ["samoa"],
  "San Marino": ["san marino"],
  "Sao Tome and Principe": ["sao tome and principe"],
  "Saudi Arabia": ["saudi arabia"],
  Senegal: ["senegal"],
  Serbia: ["serbia"],
  Seychelles: ["seychelles"],
  "Sierra Leone": ["sierra leone"],
  Singapore: ["singapore"],
  Slovakia: ["slovakia"],
  Slovenia: ["slovenia"],
  "Solomon Islands": ["solomon islands"],
  Somalia: ["somalia"],
  "South Africa": ["south africa"],
  "South Sudan": ["south sudan"],
  Spain: ["spain"],
  "Sri Lanka": ["sri lanka"],
  Sudan: ["sudan"],
  Suriname: ["suriname"],
  Sweden: ["sweden"],
  Switzerland: ["switzerland"],
  Syria: ["syria"],
  Tajikistan: ["tajikistan"],
  Tanzania: ["tanzania"],
  Thailand: ["thailand"],
  "Timor-Leste": ["timor-leste"],
  Togo: ["togo"],
  Tonga: ["tonga"],
  "Trinidad and Tobago": ["trinidad and tobago"],
  Tunisia: ["tunisia"],
  Turkey: ["turkey"],
  Turkmenistan: ["turkmenistan"],
  Tuvalu: ["tuvalu"],
  Uganda: ["uganda"],
  Ukraine: ["ukraine"],
  "United Arab Emirates": ["united arab emirates"],
  "United Kingdom": ["united kingdom"],
  "United States": ["united states"],
  Uruguay: ["uruguay"],
  Uzbekistan: ["uzbekistan"],
  Vanuatu: ["vanuatu"],
  Venezuela: ["venezuela"],
  Vietnam: ["vietnam"],
  Yemen: ["yemen"],
  Zambia: ["zambia"],
  Zimbabwe: ["zimbabwe"],
  Other: [],
};
