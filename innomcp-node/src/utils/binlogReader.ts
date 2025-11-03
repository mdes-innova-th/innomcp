import mysql from "mysql2/promise";
import { DatabaseEvent, dbNotifyDashb } from "./dbNotifyDashb";

export interface BinlogEvent {
  timestamp: Date;
  position: number;
  eventType: string;
  tableName: string;
  schemaName: string;
  data?: any[];
  logName: string;
  serverId: number;
}

export interface BinlogPosition {
  logName: string;
  position: number;
}

class BinlogReader {
  private connection: mysql.Connection | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000; // 5 seconds
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastBinlogPosition: BinlogPosition | null = null;
  private readonly pollInterval = 2000; // 2 seconds

  // ตารางที่ต้องการติดตาม
  private trackedTables = (process.env.BINLOG_TABLES || "case_listdata")
    .split(",")
    .map((t) => t.trim());

  // เก็บสถิติ per-table สำหรับ fallback (count, max primary key, last update time)
  private tableStats: Record<
    string,
    { count: number; maxId: any; lastUpdateTime: Date | null }
  > = {};

  // cache สำหรับ primary key ของตาราง
  private primaryKeyCache: Record<string, string | null> = {};

  constructor() {
    this.initializeConnection();
  }

  private async initializeConnection() {
    console.log("[BinlogReader] Initializing MySQL connection...");

    try {
      // สร้าง MySQL connection configuration
      const config = {
        host: process.env.DB_DASHB_HOST || "localhost",
        port: parseInt(process.env.DB_DASHB_PORT || "3306"),
        user: process.env.DB_DASHB_USER || "root",
        password: process.env.DB_DASHB_PASSWORD || "",
        database: process.env.DB_DASHB_NAME || "db_webd",
        charset: "utf8mb4",
        connectTimeout: 60000,
        // การตั้งค่าสำหรับ binlog
        multipleStatements: true, // อนุญาตให้รัน multiple statements
      };

      console.log(
        `[BinlogReader] Configuration: ${config.host}:${config.port}, Database: ${config.database}`
      );
      console.log(`[BinlogReader] Tracked tables:`, this.trackedTables);

      // สร้าง connection
      this.connection = await mysql.createConnection(config);

      console.log("[BinlogReader] MySQL connection initialized successfully");
    } catch (error) {
      console.error("Failed to initialize connection:", error);
      throw error;
    }
  }

  public async start() {
    try {
      console.log("[BinlogReader] Starting MySQL binlog reader...");

      if (!this.connection) {
        await this.initializeConnection();
      }

      // ตรวจสอบสถานะ binlog และสิทธิ์
      await this.checkBinlogStatus();

      // เริ่มต้น polling
      await this.initializePolling();

      this.isConnected = true;
      this.reconnectAttempts = 0;

      console.log("[BinlogReader] binlog reader started successfully");
    } catch (error) {
      console.error("Error starting binlog reader:", error);
      this.scheduleReconnect();
    }
  }

  private async checkBinlogStatus() {
    if (!this.connection) {
      throw new Error("No database connection");
    }

    try {
      // ตรวจสอบว่า binlog เปิดใช้งานหรือไม่
      const [rows] = await this.connection.execute(
        "SHOW VARIABLES LIKE 'log_bin'"
      );
      const logBinStatus = (rows as any[])[0];

      if (logBinStatus?.Value !== "ON") {
        console.warn("[BinlogReader] Warning: Binary logging is not enabled");
        console.log("[BinlogReader] Will use alternative polling method");
        return;
      }

      // หา binlog position ล่าสุด
      const [masterStatus] = await this.connection.execute(
        "SHOW MASTER STATUS"
      );
      const currentPosition = (masterStatus as any[])[0];

      if (currentPosition) {
        this.lastBinlogPosition = {
          logName: currentPosition.File,
          position: currentPosition.Position,
        };
        console.log(
          "[BinlogReader] Current binlog position:",
          this.lastBinlogPosition
        );
      }
    } catch (error) {
      console.error("Error checking binlog status:", error);
      console.log("[BinlogReader] Will use alternative polling method");
    }
  }

  private async initializePolling() {
    console.log("[BinlogReader] Initializing binlog polling system");

    // หยุด polling เดิม (ถ้ามี)
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      console.log("[BinlogReader] Stopped previous polling interval");
    }

    // เริ่ม polling ใหม่
    this.pollingInterval = setInterval(async () => {
      try {
        await this.pollBinlogEvents();
      } catch (error) {
        console.error("Error during polling:", error);
        this.handleError(error as Error);
      }
    }, this.pollInterval);

    console.log(
      `[BinlogReader] Monitoring ${
        this.trackedTables.length
      } table(s): ${this.trackedTables.join(", ")}`
    );
  }

  private async pollBinlogEvents() {
    if (!this.connection || !this.isConnected) {
      return;
    }

    try {
      // วิธีที่ 1: ใช้ SHOW BINLOG EVENTS (ถ้ามี binlog)
      if (this.lastBinlogPosition) {
        await this.checkBinlogEvents();
      }

      // วิธีที่ 2: ใช้ polling กับ timestamp (สำรอง)
      await this.checkTableChanges();
    } catch (error) {
      console.error("Error polling binlog events:", error);
    }
  }

  private async checkBinlogEvents() {
    if (!this.connection || !this.lastBinlogPosition) {
      return;
    }

    try {
      // ดู binlog events ตั้งแต่ position ล่าสุด
      const query = `SHOW BINLOG EVENTS IN '${this.lastBinlogPosition.logName}' FROM ${this.lastBinlogPosition.position} LIMIT 100`;
      const [events] = await this.connection.execute(query);

      const binlogEvents = events as any[];

      if (binlogEvents.length === 0) {
        return;
      }

      console.log(
        `[BinlogReader] Found ${binlogEvents.length} new binlog events`
      );

      // ประมวลผล events — กรองเฉพาะตารางที่เราสนใจ (trackedTables)
      for (const event of binlogEvents) {
        try {
          const eventTable = this.extractTableNameFromInfo(event.Info);

          // ถ้าเรามีรายการ trackedTables ให้กรอง (เปรียบเทียบ case-insensitive)
          if (this.trackedTables && this.trackedTables.length > 0) {
            const normalizedTracked = this.trackedTables.map((t) =>
              t.toLowerCase()
            );
            if (
              !eventTable ||
              !normalizedTracked.includes(eventTable.toLowerCase())
            ) {
              // ไม่ต้อง log ลดการแจ้งเตือนเมื่อมีงานอื่นๆ ที่ไม่เกี่ยวข้อง ทำให้เกิด binlog จำนวนมาก
              continue;
            }
          }

          await this.processBinlogEvent(event);
        } catch (err) {
          // ป้องกัน loop หยุดเมื่อเกิดข้อผิดพลาดใน event เดียว
          console.error("[BinlogReader] Error processing a binlog event:", err);
        }
      }

      // อัปเดต position ล่าสุด
      const lastEvent = binlogEvents[binlogEvents.length - 1];
      this.lastBinlogPosition.position = lastEvent.End_log_pos;
    } catch (error) {
      // ถ้า binlog event ไม่สามารถอ่านได้ ให้ใช้วิธีอื่น
      console.log(
        "[BinlogReader] Cannot read binlog events, using alternative method"
      );
    }
  }

  private async processBinlogEvent(event: any) {
    // ตรวจสอบ event type ที่เราสนใจ
    if (
      !["Write_rows", "Update_rows", "Delete_rows"].includes(event.Event_type)
    ) {
      return;
    }

    // แปลง event เป็น format ที่เราต้องการ
    const changeType = this.mapEventType(event.Event_type);
    if (!changeType) return;

    // พยายามดึงชื่อตารางจาก Info field
    const tableName = this.extractTableNameFromInfo(event.Info) || "unknown";

    console.log(
      `[BinlogReader] ${changeType} operation on table: ${tableName}`
    );

    // สร้าง database event (โดยทั่วไปจะต้องมีข้อมูลเพิ่มเติม)
    const dbEvent: DatabaseEvent = {
      type: changeType,
      table: tableName,
      data: null, // binlog info มักจะไม่มีข้อมูลตัวเต็ม
      timestamp: new Date(),
    };

    await this.notifyDashboardUpdate(dbEvent);
  }

  // เพิ่มเมธอดสำหรับดึงชื่อตารางจาก binlog info
  private extractTableNameFromInfo(info: string): string | null {
    if (!info) return null;

    // ลองดึงชื่อตารางจาก pattern ต่างๆ
    const patterns = [/table_id:\s*\d+\s*\((.*?)\)/i, /`([^`]+)`/, /(\w+)\./];

    for (const pattern of patterns) {
      const match = info.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  private async checkTableChanges() {
    if (!this.connection) {
      return;
    }

    try {
      // วิธีการ polling แบบง่าย: ตรวจสอบ last modified time หรือ auto_increment
      for (const tableName of this.trackedTables) {
        await this.checkTableForChanges(tableName);
      }
    } catch (error) {
      console.error("Error checking table changes:", error);
    }
  }

  private async checkTableForChanges(tableName: string) {
    if (!this.connection) {
      return;
    }

    try {
      // Fallback approach: พยายามอนุมาน INSERT/DELETE/UPDATE โดยใช้ COUNT และ MAX(primaryKey)
      // ขั้นตอน:
      // 1) หาชื่อ primary key ของตาราง (cache)
      // 2) อ่าน COUNT(*) และ MAX(pk) (ถ้ามี pk) เพื่อเปรียบเทียบกับค่าเก่า
      // 3) ตัดสินว่าเป็น INSERT/DELETE/UPDATE (อนุมาน)

      // ตรวจสอบ table status เพื่อดึง Update_time เล็กน้อย (จะใช้เป็น timestamp ของ event)
      const [tableStatus] = await this.connection.execute(
        `SHOW TABLE STATUS LIKE '${tableName}'`
      );
      const status = (tableStatus as any[])[0];
      const updateTime = status ? status.Update_time : new Date();

      // หา primary key ของตาราง (ถ้ายังไม่มีใน cache)
      let pk = this.primaryKeyCache[tableName];
      if (typeof pk === "undefined") {
        pk = await this.getPrimaryKeyColumn(tableName);
        this.primaryKeyCache[tableName] = pk;
      }

      // Query สำหรับนับและหา max pk (ถ้ามี)
      let statsQuery = `SELECT COUNT(*) AS c`;
      if (pk) {
        statsQuery += `, MAX(\`${pk}\`) AS maxId`;
      }
      statsQuery += ` FROM \`${tableName}\``;

      const [statRows] = await this.connection.execute(statsQuery);
      const row = (statRows as any[])[0] || { c: 0, maxId: null };
      const currentCount = Number(row.c || 0);
      const currentMaxId = row.maxId === undefined ? null : row.maxId;

      const prev = this.tableStats[tableName] || {
        count: currentCount,
        maxId: currentMaxId,
        lastUpdateTime: status ? new Date(status.Update_time) : null,
      };

      // หากยังไม่เคยมีค่าเก่า ให้เซ็ตและไม่ส่ง event (first sync)
      if (!this.tableStats[tableName]) {
        this.tableStats[tableName] = {
          count: currentCount,
          maxId: currentMaxId,
          lastUpdateTime: status ? new Date(status.Update_time) : null,
        };
        return;
      }

      let detectedType: "INSERT" | "DELETE" | "UPDATE" | null = null;

      if (currentCount > prev.count) {
        detectedType = "INSERT";
      } else if (currentCount < prev.count) {
        detectedType = "DELETE";
      } else if (
        status &&
        prev.lastUpdateTime &&
        new Date(updateTime) > prev.lastUpdateTime
      ) {
        detectedType = "UPDATE";
      }

      if (detectedType) {
        console.log(
          `[BinlogReader] Detected ${detectedType} on table: ${tableName}`
        );

        // อัพเดตสถิติก่อนส่ง (เพื่อหลีกเลี่ยงการแจ้งซ้ำ)
        this.tableStats[tableName] = {
          count: currentCount,
          maxId: currentMaxId,
          lastUpdateTime: status ? new Date(updateTime) : null,
        };

        const dbEvent: DatabaseEvent = {
          type: detectedType,
          table: tableName,
          data:
            detectedType === "DELETE"
              ? null
              : await this.getRecentTableData(tableName),
          timestamp: status ? new Date(updateTime) : new Date(),
        };

        await this.notifyDashboardUpdate(dbEvent);
      }
    } catch (error) {
      console.error(`[BinlogReader] Error checking table ${tableName}:`, error);
    }
  }

  // helper: หา primary key column ของตาราง (คืนค่า field name หรือ null)
  private async getPrimaryKeyColumn(tableName: string): Promise<string | null> {
    if (!this.connection) return null;

    try {
      const [columns] = await this.connection.execute(
        `SHOW KEYS FROM \`${tableName}\` WHERE Key_name = 'PRIMARY'`
      );
      const cols = columns as any[];
      if (cols && cols.length > 0) {
        // Column_name field มีชื่อคอลัมน์หลักตัวแรก
        return cols[0].Column_name || null;
      }
    } catch (error) {
      // อาจเกิดตารางไม่มีสิทธิ์/ไม่พบ
    }

    return null;
  }

  private mapEventType(
    eventType: string
  ): "INSERT" | "UPDATE" | "DELETE" | null {
    switch (eventType) {
      case "Write_rows":
        return "INSERT";
      case "Update_rows":
        return "UPDATE";
      case "Delete_rows":
        return "DELETE";
      default:
        return null;
    }
  }

  private async notifyDashboardUpdate(event: DatabaseEvent) {
    try {
      console.log(
        `[BinlogReader] Sending ${event.type} event for table '${event.table}' to dashboard clients`
      );

      // ส่ง notification ผ่าน dbNotificationService
      await dbNotifyDashb.notifyDashboardClients(event);
    } catch (error) {
      console.error("Error notifying dashboard clients:", error);
    }
  }

  // เพิ่มเมธอดสำหรับดึงข้อมูลล่าสุดจากตาราง
  private async getRecentTableData(tableName: string): Promise<any[] | null> {
    if (!this.connection) {
      return null;
    }

    try {
      // ลองดึงข้อมูล 5 แถวล่าสุด (id หรือ timestamp column)
      const possibleOrderColumns = [
        "id",
        "created_at",
        "updated_at",
        "timestamp",
      ];
      let query = `SELECT * FROM \`${tableName}\``;

      // หา column ที่เหมาะสมสำหรับ ORDER BY
      const [columns] = await this.connection.execute(
        `DESCRIBE \`${tableName}\``
      );
      const columnList = (columns as any[]).map((col) =>
        col.Field.toLowerCase()
      );

      for (const col of possibleOrderColumns) {
        if (columnList.includes(col)) {
          query += ` ORDER BY \`${col}\` DESC`;
          break;
        }
      }

      query += ` LIMIT 5`;

      const [rows] = await this.connection.execute(query);
      return rows as any[];
    } catch (error) {
      console.warn(
        `[BinlogReader] Could not fetch recent data for table ${tableName}:`,
        error
      );
      return null;
    }
  }

  private handleError(error: Error) {
    console.error("Handling error:", error.message);
    this.isConnected = false;

    // Check if it's a connection-related error
    const connectionErrors = [
      "Too many connections",
      "Connection lost",
      "ECONNRESET",
      "ENOTFOUND",
      "connect ETIMEDOUT",
    ];

    const isConnectionError = connectionErrors.some((err) =>
      error.message.includes(err)
    );

    if (isConnectionError) {
      console.log(
        "[BinlogReader] Connection error detected, attempting to reconnect..."
      );

      this.scheduleReconnect();
    } else {
      console.log(
        "[BinlogReader] Non-connection error, will not attempt to reconnect"
      );
    }
  }

  private async cleanupConnection() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    if (this.connection) {
      try {
        await this.connection.end();
      } catch (error) {
        console.error("Error closing connection:", error);
      }
      this.connection = null;
    }

    this.isConnected = false;
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(
        `[BinlogReader] Max reconnect attempts (${this.maxReconnectAttempts}) reached. Stopping reconnection.`
      );
      return;
    }

    this.reconnectAttempts++;
    console.log(
      `[BinlogReader] Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay}ms`
    );

    setTimeout(async () => {
      try {
        await this.cleanupConnection();
        await this.initializeConnection();
        await this.start();
      } catch (error) {
        console.error("Reconnection failed:", error);
        this.scheduleReconnect();
      }
    }, this.reconnectDelay);

    // เพิ่มระยะเวลาสำหรับ attempt ถัดไป (exponential backoff)
    this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 30000); // สูงสุด 30 วินาที
  }

  public async stop() {
    try {
      console.log("[BinlogReader] Stopping MySQL binlog reader...");

      // Clear any pending reconnection attempts
      this.reconnectAttempts = this.maxReconnectAttempts;

      await this.cleanupConnection();

      console.log("[BinlogReader] MySQL binlog reader stopped successfully");
    } catch (error) {
      console.error("Error stopping binlog reader:", error);
    }
  }

  public isRunning(): boolean {
    return this.isConnected;
  }

  // Get connection status and statistics
  public getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      trackedTables: [...this.trackedTables],
      lastBinlogPosition: this.lastBinlogPosition,
      pollInterval: this.pollInterval,
      status: this.isConnected ? "Connected" : "Disconnected",
    };
  }

  // เพิ่มตารางที่ต้องการติดตาม
  public addTrackedTable(tableName: string) {
    if (!this.trackedTables.includes(tableName)) {
      this.trackedTables.push(tableName);
      console.log(`[BinlogReader] Added table ${tableName} to tracking list`);
    }
  }

  // ลบตารางออกจากการติดตาม
  public removeTrackedTable(tableName: string) {
    const index = this.trackedTables.indexOf(tableName);
    if (index > -1) {
      this.trackedTables.splice(index, 1);
      console.log(
        `[BinlogReader] Removed table ${tableName} from tracking list`
      );
    }
  }

  // ดูรายการตารางที่ติดตาม
  public getTrackedTables(): string[] {
    return [...this.trackedTables];
  }

  // เพิ่มเมธอดสำหรับ manual trigger เพื่อทดสอบ
  public async triggerManualCheck() {
    console.log("[BinlogReader] Manually triggering table check...");
    try {
      await this.checkTableChanges();
    } catch (error) {
      console.error("Manual check failed:", error);
    }
  }

  // เมธอดสำหรับดู binlog position ปัจจุบัน
  public async getCurrentBinlogPosition(): Promise<BinlogPosition | null> {
    if (!this.connection) {
      return null;
    }

    try {
      const [masterStatus] = await this.connection.execute(
        "SHOW MASTER STATUS"
      );
      const currentPosition = (masterStatus as any[])[0];

      if (currentPosition) {
        return {
          logName: currentPosition.File,
          position: currentPosition.Position,
        };
      }
    } catch (error) {
      console.error("Error getting current binlog position:", error);
    }

    return null;
  }
}

// สร้าง singleton instance
export const binlogReader = new BinlogReader();
