<!-- cc-team deliverable
 group: G2 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-035 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: length | tokens: {"prompt_tokens":1455,"completion_tokens":7000,"total_tokens":8455,"prompt_tokens_details":{"cached_tokens":1408,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":6332,"image_tokens":0},"cache_creation_input_tokens":0} | 76s
 generated: 2026-06-13T12:10:33.986Z -->
FILE: innomcp-server-node/src/memory/vectorStore.ts
<<<<<<< SEARCH
    private items: MemoryItem[] = [];
    private filePath: string;
=======
    private items: MemoryItem[] = [];
    private filePath: string;
    private _lock: Promise<void> = Promise.resolve();
>>>>>>> REPLACE

FILE: innomcp-server-node/src/memory/vectorStore.ts
<<<<<<< SEARCH
    constructor(filePath: string = "./data/memory.json") {
        this.filePath = filePath;
    }

    async add(item: MemoryItem): Promise<void> {
=======
    constructor(filePath: string = "./data/memory.json") {
        this.filePath = filePath;
    }

    private async _withLock<T>(fn: () => Promise<T>): Promise<T> {
        const prev = this._lock;
        let resolve: (() => void) = () => {};
        this._lock = new Promise<void>(r => { resolve = r; });
        await prev;
        try {
            return await fn();
        } finally {
            resolve();
        }
    }

    async add(item: MemoryItem): Promise<void> {
>>>>>>> REPLACE

FILE: innomcp-server-node/src/memory/vectorStore.ts
<<<<<<< SEARCH
    async add(item: MemoryItem): Promise<void> {
        // Check for duplicate ID
        const index = this.items.findIndex(i => i.id === item.id);
        if (index >= 0) {
            this.items[index] = item; // Update
        } else {
            this.items.push(item);
        }
    }
=======
    async add(item: MemoryItem): Promise<void> {
        await this._withLock(async () => {
            // Check for duplicate ID
            const index = this.items.findIndex(i => i.id === item.id);
            if (index >= 0) {
                this.items[index] = item; // Update
            } else {
                this.items.push(item);
            }
        });
    }
>>>>>>> REPLACE

FILE: innomcp-server-node/src/memory/vectorStore.ts
<<<<<<< SEARCH
    async load(): Promise<void> {
        try {
            const data = await fs.readFile(this.filePath, "utf-8");
            this.items = JSON.parse(data);
        } catch (err) {
            // If file doesn't exist, start empty
            console.log(`[Memory] No existing memory file found at ${this.filePath}, starting fresh.`);
            this.items = [];
        }
    }
=======
    async load(): Promise<void> {
        await this._withLock(async () => {
            try {
                const data = await fs.readFile(this.filePath, "utf-8");
                this.items = JSON.parse(data);
            } catch (err) {
                if ((err as any).code === "ENOENT") {
                    console.log(`[Memory] No existing memory file found at ${this.filePath}, starting fresh.`);
                    this.items = [];
                } else {
                    throw err;
                }
            }
        });
    }
>>>>>>> REPLACE

FILE: innom
