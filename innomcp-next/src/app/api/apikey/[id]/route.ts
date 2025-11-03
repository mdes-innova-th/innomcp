import { NextRequest, NextResponse } from "next/server";
import { withDbConnection } from "@/app/lib/db";
import { decryptApiKey } from "@/app/lib/apikey";
import { jwtMiddleware } from "@/jwtmiddleware";
import { RowDataPacket } from "mysql2";

interface ApiKeyRow extends RowDataPacket {
  id: number;
  user_id: number;
  apikey: string;
  status: string;
  created_at?: string;
  updated_at?: string;
}

// GET /api/apikey/[id] - ดึง apikey จากตาราง apikey ตาม user_id โดยตรวจสอบ jwtmiddleware
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Await params first
  const { id } = await params;

  // ตรวจสอบ JWT
  const jwtResult = jwtMiddleware(req);
  // ถ้า jwtResult เป็น NextResponse แสดงว่า error
  if (jwtResult instanceof NextResponse) {
    return jwtResult;
  }
  const decoded = jwtResult.decoded;
  // Convert id to number for comparison since JWT user_id is a number
  if (!decoded || decoded.user_id !== parseInt(id)) {
    console.log(`[API] JWT user_id: ${decoded?.user_id}, URL param id: ${id}`);
    return NextResponse.json(
      { message: "Unauthorized: user_id mismatch" },
      { status: 403 }
    );
  }

  // ดึง apikey จากฐานข้อมูล
  try {
    const connection = await withDbConnection(async (conn) => {
      const result = await conn.execute(
        "SELECT * FROM apikey WHERE user_id = ? AND status = ?",
        [id, "active"]
      );
      const rows = Array.isArray(result[0]) ? result[0] : [];
      return rows;
    });
    const apikeys = (connection as ApiKeyRow[]).map((row: ApiKeyRow) => ({
      ...row,
      apikey: decryptApiKey(row.apikey),
    }));
    console.log(`Fetched active API keys for user_id ${id}`);
    return NextResponse.json({ apikeys });
  } catch (error) {
    return NextResponse.json(
      { message: "catch-Error fetching apikey", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
