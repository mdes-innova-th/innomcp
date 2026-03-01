import crypto from "crypto";
import { withDbConnection } from "./db";
import { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getRedisClient } from "./redis";
import "dotenv/config";

// API Key interface matching the database schema
export interface ApiKeyData extends RowDataPacket {
  apikey_id: number;
  apikey: string;
  status: "active" | "inactive" | "revoke";
  apikey_name: string | null;
  create: Date;
  expire: Date | null;
  update: Date;
  rate_limit: number | null;
  allowed_origins: string | null;
}

// AES-256 Encryption/Decryption Functions
function getEncryptionKey(): Buffer {
  const key = process.env.API_KEY_SECRET;
  if (!key) {
    console.log("[apikey] API_KEY_SECRET environment variable is not set");
    console.error("API_KEY_SECRET environment variable is not set");
    // Fallback to a default key (not recommended for production)
    return crypto.scryptSync(
      "default-fallback-key-do-not-use-in-production",
      "salt",
      32
    );
  }
  // Use scrypt to derive a 32-byte key (256 bits) from the environment variable
  return crypto.scryptSync(key, "salt", 32);
}

// Encrypt API key with AES-256
export function encryptApiKey(apiKey: string): string {
  try {
    const iv = crypto.randomBytes(16); // Initialization vector
    const key = getEncryptionKey();
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);

    let encrypted = cipher.update(apiKey, "utf8", "hex");
    encrypted += cipher.final("hex");

    // Return IV + encrypted data (IV is needed for decryption)
    return iv.toString("hex") + ":" + encrypted;
  } catch (error) {
    console.log("[apikey] Error encrypting API key:", error);
    console.error("Error encrypting API key:", error);
    return apiKey; // Fallback to unencrypted if encryption fails
  }
}

// Decrypt API key with AES-256
export function decryptApiKey(encryptedApiKey: string): string {
  try {
    const [ivHex, encryptedData] = encryptedApiKey.split(":");
    if (!ivHex || !encryptedData) {
      // If the format is not as expected, return as is (might be unencrypted)
      return encryptedApiKey;
    }

    const iv = Buffer.from(ivHex, "hex");
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);

    let decrypted = decipher.update(encryptedData, "hex", "utf8");
    decrypted += decipher.final("utf8");

    console.log("[apikey] API key was decrypted");

    return decrypted;
  } catch (error) {
    console.log("[apikey] catch-Error decrypting API key:", error);
    console.error("Error decrypting API key:", error);
    return encryptedApiKey; // Return encrypted version if decryption fails
  }
}

// สร้าง API Key ตามรูปแบบ prefix-random-suffix สำหรับแอปพลิเคชันหรือเว็บไซต์
export function generateApiKey(prefix: string = "webd"): string {
  const randomBytes = crypto.randomBytes(24).toString("hex");
  console.log("[apikey] Generated API Key.");
  return `${prefix}_${randomBytes}`;
}

// สร้างและบันทึก API Key ใหม่สำหรับแอปพลิเคชันหรือเว็บไซต์
export async function createApiKey(
  apiKeyName: string,
  expireDate?: Date,
  rateLimit?: number,
  allowedOrigins?: string
): Promise<ApiKeyData | null> {
  const apiKey = generateApiKey();
  // Encrypt the API key before storing
  const encryptedApiKey = encryptApiKey(apiKey);

  try {
    const result = await withDbConnection(async (connection) => {
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO apikey (apikey, apikey_name, expire, rate_limit, allowed_origins) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          encryptedApiKey,
          apiKeyName,
          expireDate || null,
          rateLimit || null,
          allowedOrigins || null,
        ]
      );

      if (result.affectedRows > 0) {
        const [rows] = await connection.execute<RowDataPacket[]>(
          "SELECT * FROM apikey WHERE apikey = ?",
          [encryptedApiKey]
        );

        if (rows.length > 0) {
          const apiKeyData = rows[0] as ApiKeyData;
          // Return the original unencrypted API key to the user
          // This is the only time they'll see the unencrypted version
          apiKeyData.apikey = apiKey;
          return apiKeyData;
        }
      }
      return null;
    });

    return result as ApiKeyData | null;
  } catch (error) {
    console.error("Error creating API key:", error);
    return null;
  }
}

// ตรวจสอบ API Key
export async function validateApiKey(
  apiKey: string,
  origin?: string
): Promise<{
  valid: boolean;
  apiKeyData?: ApiKeyData | null;
  error?: string;
}> {
  if (!apiKey) {
    return { valid: false, error: "No API key provided" };
  }

  try {
    // Get all active API keys
    const apiKeyData = await withDbConnection(async (connection) => {
      const [rows] = await connection.execute<RowDataPacket[]>(
        'SELECT * FROM apikey WHERE status = "active" AND (expire IS NULL OR expire > NOW())',
        []
      );

      // Check each API key by decrypting and comparing
      for (const row of rows) {
        const encryptedApiKey = row.apikey;
        const decryptedApiKey = decryptApiKey(encryptedApiKey);

        if (decryptedApiKey === apiKey) {
          return row as ApiKeyData;
        }
      }

      return null;
    });

    if (!apiKeyData) {
      return { valid: false, error: "Invalid or expired API key" };
    }

    // Check allowed origins if specified
    if (apiKeyData.allowed_origins && origin) {
      const allowedOriginsList = apiKeyData.allowed_origins
        .split(",")
        .map((o) => o.trim());
      if (
        !allowedOriginsList.includes("*") &&
        !allowedOriginsList.includes(origin)
      ) {
        return {
          valid: false,
          apiKeyData,
          error: "Origin not allowed for this API key",
        };
      }
    }

    // In a real implementation, you would also check rate limits here
    // This would likely involve tracking usage in a cache or database

    return {
      valid: true,
      apiKeyData,
    };
  } catch (error) {
    console.error("Error validating API key:", error);
    return { valid: false, error: "Error validating API key" };
  }
}

// Check if a key has exceeded its rate limit using Redis
export async function checkRateLimit(apiKeyData: ApiKeyData): Promise<boolean> {
  if (!apiKeyData.rate_limit) {
    return true; // No rate limit set, so not exceeded
  }

  try {
    const redis = await getRedisClient();
    const keyId = apiKeyData.apikey_id;
    const now = Date.now();

    // Key for storing timestamps in Redis with proper namespace
    const redisKey = `ratelimit:${keyId}`;

    // Add current timestamp to the sorted set
    await redis.zadd(redisKey, now, now.toString());

    // Remove timestamps older than 1 minute (60000 milliseconds)
    const oneMinuteAgo = now - 60000;
    await redis.zremrangebyscore(redisKey, 0, oneMinuteAgo);

    // Count remaining items (requests within the last minute)
    const requestCount = await redis.zcard(redisKey);

    // Set expiry on the Redis key (for automatic cleanup)
    await redis.expire(redisKey, 120); // 2 minutes TTL

    // Return true if within rate limit, false if exceeded
    const withinLimit = requestCount <= apiKeyData.rate_limit;

    // For debugging/monitoring
    if (!withinLimit) {
      console.warn(
        `Rate limit exceeded for API key ID ${keyId}: ${requestCount}/${apiKeyData.rate_limit} requests per minute`
      );
    }

    return withinLimit;
  } catch (error) {
    console.error("Error checking rate limit:", error);
    // Fallback to allowing the request in case of Redis errors
    return true;
  }
}

// Middleware สำหรับตรวจสอบ API Key
export async function apiKeyMiddleware(
  req: any,
  res: any,
  next: any
): Promise<any> {
  // รับ API Key จาก header X-API-Key หรือ auth header token-scheme
  const apiKey =
    req.headers["x-api-key"] ||
    req.headers["authorization"]?.replace(/^bearer\s+/i, "");

  const origin = req.headers.origin || req.header("origin");

  if (!apiKey) {
    return res.status(401).json({ message: "API key is required" });
  }

  const { valid, apiKeyData, error } = await validateApiKey(
    apiKey,
    origin || undefined
  );

  if (!valid) {
    console.log("[apikey] API key validation failed:", error);
    return res
      .status(401)
      .json({ message: error || "Invalid or expired API key" });
  }

  console.log("[apikey] API key validated successfully.");

  // Check rate limits if API key has a rate limit set
  if (apiKeyData?.rate_limit) {
    const withinLimit = await checkRateLimit(apiKeyData);
    if (!withinLimit) {
      console.log("Rate limit exceeded for API key.");
      return res.status(429).json({ message: "Rate limit exceeded" });
    }
  }

  // Attach the validated API key data to the request for use in route handlers
  req.apiKeyData = apiKeyData;
  next();
}

// Revoke an API key
export async function revokeApiKey(apiKey: string): Promise<boolean> {
  try {
    // Find the API key by decrypting and comparing
    const result = await withDbConnection(async (connection) => {
      // First, get all API keys
      const [rows] = await connection.execute<RowDataPacket[]>(
        "SELECT apikey_id, apikey FROM apikey",
        []
      );

      // Find the matching API key by decrypting each one
      let matchedKeyId = null;
      for (const row of rows) {
        const decryptedKey = decryptApiKey(row.apikey);
        if (decryptedKey === apiKey) {
          matchedKeyId = row.apikey_id;
          break;
        }
      }

      if (matchedKeyId) {
        // Update the key status
        const [result] = await connection.execute<ResultSetHeader>(
          'UPDATE apikey SET status = "revoke" WHERE apikey_id = ?',
          [matchedKeyId]
        );
        return result.affectedRows > 0;
      }

      return false;
    });

    return result;
  } catch (error) {
    console.error("Error revoking API key:", error);
    return false;
  }
}

// Revoke an API key by ID
export async function revokeApiKeyById(apiKeyId: number): Promise<boolean> {
  try {
    const result = await withDbConnection(async (connection) => {
      // Update the key status directly using the ID
      const [result] = await connection.execute<ResultSetHeader>(
        'UPDATE apikey SET status = "revoke", `update` = NOW() WHERE apikey_id = ?',
        [apiKeyId]
      );
      return result.affectedRows > 0;
    });

    return result;
  } catch (error) {
    console.error("Error revoking API key by ID:", error);
    return false;
  }
}

// Delete an API key permanently
export async function deleteApiKey(apiKeyId: number): Promise<boolean> {
  try {
    const result = await withDbConnection(async (connection) => {
      // Delete the API key from the database
      const [result] = await connection.execute<ResultSetHeader>(
        "DELETE FROM apikey WHERE apikey_id = ?",
        [apiKeyId]
      );
      return result.affectedRows > 0;
    });

    return result;
  } catch (error) {
    console.error("Error deleting API key:", error);
    return false;
  }
}

// Update API key information
export async function updateApiKey(
  apiKeyId: number,
  updatedInfo: {
    apikey_name?: string;
    expire?: Date | null;
    rate_limit?: number | null;
    allowed_origins?: string | null;
  }
): Promise<boolean> {
  try {
    const result = await withDbConnection(async (connection) => {
      // Prepare update fields
      const updateFields = [];
      const params = [];

      if (updatedInfo.apikey_name !== undefined) {
        updateFields.push("apikey_name = ?");
        params.push(updatedInfo.apikey_name);
      }

      if (updatedInfo.expire !== undefined) {
        updateFields.push("expire = ?");
        params.push(updatedInfo.expire);
      }

      if (updatedInfo.rate_limit !== undefined) {
        updateFields.push("rate_limit = ?");
        params.push(updatedInfo.rate_limit);
      }

      if (updatedInfo.allowed_origins !== undefined) {
        updateFields.push("allowed_origins = ?");
        params.push(updatedInfo.allowed_origins);
      }

      // Add the update timestamp
      updateFields.push("`update` = NOW()");

      // Add the apikey_id to params
      params.push(apiKeyId);

      if (updateFields.length === 0) {
        return false; // No fields to update
      }

      // Update the API key
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE apikey SET ${updateFields.join(", ")} WHERE apikey_id = ?`,
        params
      );

      return result.affectedRows > 0;
    });

    return result;
  } catch (error) {
    console.error("Error updating API key:", error);
    return false;
  }
}

// List all API keys (with optional filtering)
export async function listApiKeys(
  status?: "active" | "inactive" | "revoke",
  apiKeyName?: string
): Promise<ApiKeyData[]> {
  try {
    const apiKeys = await withDbConnection(async (connection) => {
      // Build query with conditions
      const conditions = [];
      const params = [];

      if (status) {
        conditions.push("status = ?");
        params.push(status);
      }

      if (apiKeyName) {
        conditions.push("apikey_name LIKE ?");
        params.push(`%${apiKeyName}%`);
      }

      // Create the base query and add WHERE clause if we have conditions
      let query = "SELECT * FROM apikey";
      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }

      // Execute the query with parameters
      const [rows] = await connection.execute<RowDataPacket[]>(query, params);

      // For security, we don't return the full decrypted API keys in listings
      // Instead, show a masked version for display purposes
      const apiKeys = rows.map((row) => {
        const apiKeyData = row as ApiKeyData;
        const encrypted = apiKeyData.apikey;

        // For display purposes, create a masked version
        // Show a part of the encrypted key instead of decrypting
        apiKeyData.apikey =
          encrypted.substring(0, 10) +
          "..." +
          encrypted.substring(encrypted.length - 8);

        return apiKeyData;
      });

      return apiKeys as ApiKeyData[];
    });

    return apiKeys;
  } catch (error) {
    console.error("Error listing API keys:", error);
    return [];
  }
}
