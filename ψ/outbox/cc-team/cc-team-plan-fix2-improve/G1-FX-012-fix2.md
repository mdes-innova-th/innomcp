<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from improve)
 member: FX-012 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: length | tokens: {"prompt_tokens":3316,"completion_tokens":8000,"total_tokens":11316,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":6544,"image_tokens":0},"cache_creation_input_tokens":0} | 71s
 generated: 2026-06-13T11:35:49.951Z -->
FILE: innomcp-node/src/services/providerFailover.ts
<<<<<<< SEARCH
  private healthChecker: HealthCheckFn | null = null;

  constructor(
    primaryId: string = DEFAULT_PRIMARY_ID,
    backupIds: string[] = DEFAULT_BACKUP_IDS,
    failThreshold = DEFAULT_FAIL_THRESHOLD,
    cooldownMs = DEFAULT_COOLDOWN_MS,
  ) {
    this.failThreshold = failThreshold;
    this.cooldownMs = cooldownMs;
    this.statuses = new Map();

    const providerIds = [primaryId, ...backupIds];
    for (const id of providerIds) {
      this.statuses.set(id, {
        id,
        healthy: true,
        latencyMs: 0,
        failCount: 0,
        lastCheck: Date.now(),
      });
    }

    this.activeProviderId = primaryId;
  }
=======
  private healthChecker: HealthCheckFn | null = null;
  private readonly primaryId: string;
  private readonly backupIds: string[];

  constructor(
    primaryId: string = DEFAULT_PRIMARY_ID,
    backupIds: string[] = DEFAULT_BACKUP_IDS,
    failThreshold = DEFAULT_FAIL_THRESHOLD,
    cooldownMs = DEFAULT_COOLDOWN_MS,
  ) {
    this.failThreshold = failThreshold;
    this.cooldownMs = cooldownMs;
    this.primaryId = primaryId;
    this.backupIds = backupIds;
    this.statuses = new Map();

    const providerIds = [primaryId, ...backupIds];
    for (const id of providerIds) {
      this.statuses.set(id, {
        id,
        healthy: true,
        latencyMs: 0,
        failCount: 0,
        lastCheck: Date.now(),
      });
    }

    this.activeProviderId = primaryId;
  }
>>>>>>> REPLACE

FILE: innomcp-node/src/services/providerFailover.ts
<<<<<<< SEARCH
  public async selectProvider(_task?: string): Promise<string> {
    // Check primary
    const primaryStatus = this.statuses.get(DEFAULT_PRIMARY_ID)!;
    if (primaryStatus.healthy) {
      this.activeProviderId = DEFAULT_PRIMARY_ID;
      return DEFAULT_PRIMARY_ID;
    }

    // Primary unhealthy – try backups
    for (const backupId of DEFAULT_BACKUP_IDS) {
      const backupStatus = this.statuses.get(backupId);
      if (backupStatus && backupStatus.healthy) {
        this.activeProviderId = backupId;
        return backupId;
      }
    }

    // All unhealthy – fallback to primary (but log)
    console.warn(
      `[ProviderFailover] All providers unhealthy. Falling back to primary (${DEFAULT_PRIMARY_ID})`,
    );
    this.activeProviderId = DEFAULT_PRIMARY_ID;
    return DEFAULT_PRIMARY_ID;
  }
=======
  public async selectProvider(_task?: string): Promise<string> {
    // Check primary
    const primaryStatus = this.statuses.get(this.primaryId)!;
    if (primaryStatus.healthy) {
      this.activeProviderId = this.primaryId;
      return this.primaryId;
    }

    // Primary unhealthy – try backups
    for (const backupId of this.backupIds) {
      const backupStatus = this.statuses.get(backupId);
      if (backupStatus && backupStatus.healthy) {
        this.activeProviderId = backupId;
        return backupId;
      }
    }

    // All unhealthy – fallback to primary (but log)
    console.warn(
      `[ProviderFailover] All providers unhealthy. Falling back to primary (${this.primaryId})`,
    );
    this.activeProviderId = this.primaryId;
    return this.primaryId;
  }
>>>>>>> REPLACE

FILE: innomcp-node/src/services/providerFailover.ts
<<<<<<< SEARCH
  public getStats(): {
    primary: ProviderStatus;
    backups: ProviderStatus[];
    activeProvider: string;
  } {
    const primary = this.statuses.get(DEFAULT_PRIMARY_ID)!;
    const backups = DEFAULT_BACKUP_IDS
      .map(id => this.statuses.get(id))
      .filter(Boolean) as ProviderStatus[];

    return {
      primary: { ...primary },
      backups: backups.map(s => ({ ...s })),
      activeProvider: this.activeProviderId,
    };
  }
=======
  public getStats(): {
    primary: ProviderStatus;
    backups: ProviderStatus[];
    activeProvider: string;
  } {
    const primary = this.statuses.get(this.primaryId)!;
    const backups = this.backupIds
      .map(id => this.statuses.get(id))
      .filter(Boolean) as ProviderStatus[];

    return {
      primary: { ...primary },
      backups: backups.map(s => ({ ...s })),
      activeProvider: this.activeProviderId,
    };
  }
>>>>>>> REPLACE

FILE: innomcp-node/src/services/providerFailover.ts
<<<<<<< SEARCH
  public resetAll(): void {
    const now = Date.now();
    for (const status of this.statuses.values()) {
      status.healthy = true;
      status.failCount = 0;
      status.latencyMs = 0;
      status.lastCheck = now;
    }
    this.activeProviderId = DEFAULT_PRIMARY_ID;
    console.log('[ProviderFailover] All providers reset to healthy.');
  }
=======
  public resetAll(): void {
    const now = Date.now();
    for (const status of this.statuses.values()) {
      status.healthy = true;
      status.failCount = 0;
      status.latencyMs = 0;
      status.lastCheck = now;
    }
    this.activeProviderId = this.primaryId;
    console.log('[ProviderFailover] All providers reset to healthy.');
  }
>>>>>>> REPLACE

FILE: innomcp-node/src/services/providerFailover.ts
<<<<<<< SEARCH
    const now = Date.now();
    // If healthy, optionally re-check to update latency? We'll not force re-check when healthy.
    // Only perform active check if currently unhealthy and cooldown elapsed, or if never checked.
    const shouldAttemptCheck =
      !status.healthy && (now - status.lastCheck >= this.cooldownMs);

    if (!shouldAttemptCheck && status.healthy) {
      // Still healthy, no need to re-probe now
      return true;
    }
=======
    const now = Date.now();
    const shouldAttemptCheck =
      !status.healthy && (now - status.lastCheck >= this.cooldownMs);

    if (!shouldAttemptCheck) {
      return status.healthy;
    }
>>>>>>> REPLACE

FILE
