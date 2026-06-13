<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from security)
 member: FX-007 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":3021,"completion_tokens":3947,"total_tokens":6968,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3692,"image_tokens":0},"cache_creation_input_tokens":0} | 40s
 generated: 2026-06-13T11:33:38.243Z -->
FILE: innomcp-node/src/services/healthAggregator.ts
<<<<<<< SEARCH
    } catch (error: unknown) {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1e6;
      const errorMessage =
        error instanceof Error ? error.message : 'เกิดข้อผิดพลาดที่ไม่รู้จัก';

      return {
        name,
        result: {
          status: 'unhealthy',
          message: `การตรวจสอบล้มเหลว: ${errorMessage}`,
          latencyMs: durationMs,
          durationMs,
        },
      };
    }
=======
    } catch (error: unknown) {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1e6;

      // Log the full error server-side; do not expose details to clients
      console.error(`Health checker '${name}' failed:`, error);

      return {
        name,
        result: {
          status: 'unhealthy',
          message: 'การตรวจสอบล้มเหลว',
          latencyMs: durationMs,
          durationMs,
        },
      };
    }
>>>>>>> REPLACE
