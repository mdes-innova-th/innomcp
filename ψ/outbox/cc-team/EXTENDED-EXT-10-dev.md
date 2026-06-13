<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-10 role=dev model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":76,"completion_tokens":1635,"total_tokens":1711,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1483,"image_tokens":0},"cache_creation_input_tokens":0} | 32s
 generated: 2026-06-13T05:26:04.974Z -->
import { EventEmitter } from 'events';

export class EventBusHelper {
  private readonly emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
  }

  public emit<T>(event: string, data: T): boolean {
    return this.emitter.emit(event, data);
  }

  public on<T>(event: string, handler: (data: T) => void): void {
    this.emitter.on(event, handler as (...args: any[]) => void);
  }

  public off(event: string, handler: (...args: any[]) => void): void {
    this.emitter.off(event, handler);
  }
}
