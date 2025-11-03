import { fetchDashboardStats } from "./wsurlstats";

// Event emitter สำหรับ database notifications
export interface DatabaseEvent {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  data?: any;
  timestamp: Date;
}

// ประเภทของ WebSocket clients
export interface WebSocketClient {
  id: string;
  ws: any; // WebSocket instance
  connectionType: "ws-dashboard";
}

class DatabaseNotifyDashb {
  private clients: Map<string, WebSocketClient> = new Map();

  // เพิ่ม client เข้าระบบ
  addClient(
    id: string,
    ws: any,
    connectionType: "ws-dashboard" = "ws-dashboard"
  ) {
    this.clients.set(id, { id, ws, connectionType });
    console.log(
      `[dbNotifyDashb] added client ${id} for ${connectionType} notifications`
    );
  }

  // ลบ client ออกจากระบบ
  removeClient(id: string) {
    if (this.clients.has(id)) {
      this.clients.delete(id);
      console.log(`[dbNotifyDashb] Removed client ${id} from notifications`);
    }
  }

  // ส่ง notification ไปยัง dashboard clients
  async notifyDashboardClients(event: DatabaseEvent) {
    const dashboardClients = Array.from(this.clients.values()).filter(
      (client) => client.connectionType === "ws-dashboard"
    );

    if (dashboardClients.length === 0) {
      console.log(
        "[dbNotifyDashb] No dashboard clients connected for notifications"
      );
      return;
    }

    try {
      // ดึงข้อมูล dashboard ล่าสุด
      const dashboardData = await fetchDashboardStats();
      const message = {
        event: "databaseUpdate",
        type: event.type,
        table: event.table,
        timestamp: event.timestamp,
        data: dashboardData,
      };

      // ส่ง notification ไปยังทุก dashboard client
      dashboardClients.forEach((client) => {
        if (client.ws.readyState === 1) {
          // WebSocket.OPEN
          client.ws.send(JSON.stringify(message));
        }
      });

      console.log(
        `[dbNotifyDashb] Sent database update notification to ${dashboardClients.length} dashboard clients`
      );
    } catch (error) {
      console.error("Error sending dashboard notification:", error);
    }
  }

  // ส่ง ข้อความไปยัง clients ทั้งหมด หรือกรองตามประเภท
  broadcastToAll(message: any, filterType?: "ws-dashboard") {
    const targetClients = filterType
      ? Array.from(this.clients.values()).filter(
          (client) => client.connectionType === filterType
        )
      : Array.from(this.clients.values());

    targetClients.forEach((client) => {
      if (client.ws.readyState === 1) {
        // WebSocket.OPEN
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  // ดู client ที่เชื่อมต่ออยู่
  getConnectedClients() {
    return Array.from(this.clients.values());
  }

  // ตรวจสอบจำนวน dashboard clients
  getDashboardClientCount() {
    return Array.from(this.clients.values()).filter(
      (client) => client.connectionType === "ws-dashboard"
    ).length;
  }
}

// Singleton instance
export const dbNotifyDashb = new DatabaseNotifyDashb();

// Helper functions สำหรับใช้ในการแทรกข้อมูล

// ใช้สำหรับ notify หลังจาก INSERT operation
export async function notifyAfterInsert(tableName: string, insertedData?: any) {
  const event: DatabaseEvent = {
    type: "INSERT",
    table: tableName,
    data: insertedData,
    timestamp: new Date(),
  };

  console.log(
    `[dbNotifyDashb] Database INSERT notification: ${tableName}`,
    insertedData
  );
  await dbNotifyDashb.notifyDashboardClients(event);
}

// ใช้สำหรับ notify หลังจาก UPDATE operation
export async function notifyAfterUpdate(tableName: string, updatedData?: any) {
  const event: DatabaseEvent = {
    type: "UPDATE",
    table: tableName,
    data: updatedData,
    timestamp: new Date(),
  };

  console.log(
    `[dbNotifyDashb] Database UPDATE notification: ${tableName}`,
    updatedData
  );
  await dbNotifyDashb.notifyDashboardClients(event);
}

// ใช้สำหรับ notify หลังจาก DELETE operation
export async function notifyAfterDelete(tableName: string, deletedData?: any) {
  const event: DatabaseEvent = {
    type: "DELETE",
    table: tableName,
    data: deletedData,
    timestamp: new Date(),
  };

  console.log(
    `[dbNotifyDashb] Database DELETE notification: ${tableName}`,
    deletedData
  );
  await dbNotifyDashb.notifyDashboardClients(event);
}
