import { NextResponse, NextRequest } from "next/server";
import type { RowDataPacket } from "mysql2";
import { withDbConnection } from "@/app/lib/db";
import { jwtMiddleware } from "@/jwtmiddleware";

// Admin role in this codebase = userrole_id === 0 (see /api/admin/users, /api/admin/metrics).
// Spec said `role === "admin"`, but the JWT actually carries userrole_id, not role —
// using the existing convention so admin auth stays consistent across endpoints.
const ADMIN_ROLE_ID = 0;

interface RatingRow extends RowDataPacket {
  rating: "up" | "down";
  count: number;
}

interface DailyRow extends RowDataPacket {
  date: string;
  rating: "up" | "down";
  count: number;
}

// GET /api/admin/feedback/stats — aggregate up/down counts + last-7-day breakdown.
export async function GET(req: NextRequest) {
  const jwtResult = jwtMiddleware(req);
  if (jwtResult instanceof NextResponse) return jwtResult;

  const { decoded } = jwtResult;
  if (
    !decoded ||
    typeof decoded !== "object" ||
    (decoded as { userrole_id?: number }).userrole_id !== ADMIN_ROLE_ID
  ) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 403 }
    );
  }

  try {
    const { totals, last7Days } = await withDbConnection(async (conn) => {
      const [totalsRows] = await conn.execute<RatingRow[]>(
        "SELECT rating, COUNT(*) AS count FROM chat_feedback GROUP BY rating"
      );
      const [dailyRows] = await conn.execute<DailyRow[]>(
        `SELECT DATE(created_at) AS date, rating, COUNT(*) AS count
           FROM chat_feedback
          WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          GROUP BY date, rating
          ORDER BY date DESC`
      );
      return { totals: totalsRows, last7Days: dailyRows };
    });

    let up = 0;
    let down = 0;
    for (const row of totals) {
      if (row.rating === "up") up = Number(row.count);
      else if (row.rating === "down") down = Number(row.count);
    }

    return NextResponse.json({
      total: up + down,
      up,
      down,
      last7Days: last7Days.map((r) => ({
        date: typeof r.date === "string" ? r.date : new Date(r.date).toISOString().slice(0, 10),
        rating: r.rating,
        count: Number(r.count),
      })),
    });
  } catch (err) {
    console.error("[admin/feedback/stats]", err);
    return NextResponse.json({
      total: 0,
      up: 0,
      down: 0,
      last7Days: [],
      error: "db_unavailable",
    });
  }
}
