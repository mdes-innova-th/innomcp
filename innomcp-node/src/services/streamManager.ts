import { Response } from 'express';

interface StreamInfo {
  id: string;
  sessionId: string;
  res: Response;
  startTime: number;
  lastActivity: number;
  status: 'active' | 'closed';
}

class StreamManager {
  private streams: Map<string, StreamInfo> = new Map();
  private totalCreated = 0;
  private totalClosedDuration = 0; // sum of (close time - start time) in ms
  private closedCount = 0;

  /**
   * Registers a new SSE stream. Caller is responsible for setting SSE headers on the response.
   */
  create(id: string, sessionId: string, res: Response): StreamInfo {
    const info: StreamInfo = {
      id,
      sessionId,
      res,
      startTime: Date.now(),
      lastActivity: Date.now(),
      status: 'active',
    };
    this.streams.set(id, info);
    this.totalCreated++;
    return info;
  }

  /**
   * Sends data as an SSE message. Returns false if the stream is closed or not found.
   */
  send(streamId: string, data: unknown): boolean {
    const stream = this.streams.get(streamId);
    if (!stream || stream.status !== 'active') {
      return false;
    }
    try {
      stream.res.write(`data: ${JSON.stringify(data)}\n\n`);
      stream.lastActivity = Date.now();
      return true;
    } catch {
      // Write failed (client probably disconnected), clean up
      this.close(streamId);
      return false;
    }
  }

  /**
   * Sends an SSE error message. Silently ignored if stream is not active.
   */
  sendError(streamId: string, error: string): void {
    const stream = this.streams.get(streamId);
    if (!stream || stream.status !== 'active') {
      return;
    }
    try {
      stream.res.write(`data: ${JSON.stringify({ error })}\n\n`);
      stream.lastActivity = Date.now();
    } catch {
      this.close(streamId);
    }
  }

  /**
   * Closes the SSE stream and marks it as finished.
   */
  close(streamId: string): void {
    const stream = this.streams.get(streamId);
    if (!stream || stream.status !== 'active') {
      return;
    }

    stream.status = 'closed';
    const duration = Date.now() - stream.startTime;
    this.totalClosedDuration += duration;
    this.closedCount++;

    try {
      stream.res.end();
    } catch {
      // ignore errors when ending the response
    }

    this.streams.delete(streamId);
  }

  /**
   * Closes all active streams belonging to the given session.
   */
  closeSession(sessionId: string): void {
    // Collect IDs first to avoid modification-during-iteration issues
    const toClose: string[] = [];
    for (const [id, stream] of this.streams) {
      if (stream.sessionId === sessionId && stream.status === 'active') {
        toClose.push(id);
      }
    }
    for (const id of toClose) {
      this.close(id);
    }
  }

  /**
   * Returns true if the stream exists and is active.
   */
  isActive(streamId: string): boolean {
    const stream = this.streams.get(streamId);
    return stream?.status === 'active' || false;
  }

  /**
   * Returns an array of all currently active streams.
   */
  getActive(): StreamInfo[] {
    return Array.from(this.streams.values()).filter(
      (stream) => stream.status === 'active'
    );
  }

  /**
   * Closes any streams that have been idle for more than maxIdleMs milliseconds.
   * Defaults to 5 minutes.
   * Returns the number of streams closed.
   */
  cleanup(maxIdleMs: number = 300_000): number {
    const now = Date.now();
    const toClose: string[] = [];
    for (const [id, stream] of this.streams) {
      if (
        stream.status === 'active' &&
        now - stream.lastActivity > maxIdleMs
      ) {
        toClose.push(id);
      }
    }

    for (const id of toClose) {
      this.close(id);
    }

    return toClose.length;
  }

  /**
   * Returns basic statistics about the stream manager.
   */
  stats(): { active: number; total: number; avgDurationMs: number } {
    return {
      active: this.streams.size,
      total: this.totalCreated,
      avgDurationMs:
        this.closedCount > 0
          ? Math.round(this.totalClosedDuration / this.closedCount)
          : 0,
    };
  }
}

export const streamManager = new StreamManager();