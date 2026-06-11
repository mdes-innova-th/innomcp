```ts
// cacheManager.ts — In-memory LRU cache with TTL for innomcp-node
// TypeScript เข้มงวด ห้ามใช้ any โดยไม่จำเป็น ใช้ unknown สำหรับค่าที่ไม่รู้จัก

interface CacheOptions {
  /** ค่า TTL เริ่มต้นในหน่วยมิลลิวินาที (default: 0 = ไม่มีวันหมดอายุ) */
  ttl?: number;
  /** จำนวนรายการสูงสุดที่เก็บได้ (default: Infinity) */
  maxSize?: number;
}

interface CacheNode {
  key: string;
  value: unknown;
  expiry: number; // timestamp milliseconds (0 = never expires)
  prev: CacheNode | null;
  next: CacheNode | null;
}

class CacheManager {
  private map = new Map<string, CacheNode>();
  private head: CacheNode | null = null;
  private tail: CacheNode | null = null;
  private maxSize: number;
  private defaultTTL: number;
  private hits = 0;
  private misses = 0;

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize && options.maxSize > 0 ? options.maxSize : Infinity;
    this.defaultTTL = options.ttl && options.ttl > 0 ? options.ttl : 0;
  }

  /**
   * เพิ่มหรืออัปเดตข้อมูลในแคช
   * @param key key ที่ต้องการเก็บ
   * @param value ค่าที่ต้องการเก็บ (generic)
   * @param ttl ระยะเวลาหมดอายุในหน่วย ms (ถ้าไม่ระบุจะใช้ defaultTTL จาก constructor)
   */
  set<T>(key: string, value: T, ttl?: number): void {
    const expiry =
      ttl !== undefined && ttl > 0
        ? Date.now() + ttl
        : this.defaultTTL > 0
          ? Date.now() + this.defaultTTL
          : 0;

    const existingNode = this.map.get(key);
    if (existingNode) {
      // อัปเดตโหนดเดิม
      existingNode.value = value;
      existingNode.expiry = expiry;
      this.moveToFront(existingNode);
    } else {
      // ถ้าเต็มความจุ ให้ลบรายการที่ใช้น้อยที่สุด (tail)
      if (this.maxSize !== Infinity && this.map.size >= this.maxSize && this.tail) {
        this.removeNode(this.tail);
      }
      const node: CacheNode = {
        key,
        value,
        expiry,
        prev: null,
        next: null,
      };
      this.addToFront(node);
      this.map.set(key, node);
    }
  }

  /**
   * ดึงข้อมูลจากแคช
   * @returns ค่าที่เก็บไว้ (generic) หรือ undefined ถ้าไม่มีหรือหมดอายุ
   */
  get<T>(key: string): T | undefined {
    const node = this.map.get(key);
    if (!node) {
      this.misses++;
      return undefined;
    }

    if (node.expiry > 0 && Date.now() > node.expiry) {
      // หมดอายุ -> ลบแล้ว return miss
      this.removeNode(node);
      this.misses++;
      return undefined;
    }

    // ย้ายไปหน้า list (ใช้งานล่าสุด)
    this.moveToFront(node);
    this.hits++;
    return node.value as T;
  }

  /** ตรวจสอบว่ามี key ที่ยังไม่หมดอายุหรือไม่ */
  has(key: string): boolean {
    const node = this.map.get(key);
    if (!node) return false;
    if (node.expiry > 0 && Date.now() > node.expiry) {
      this.removeNode(node);
      return false;
    }
    return true;
  }

  /** ลบ key ออกจากแคช */
  delete(key: string): void {
    const node = this.map.get(key);
    if