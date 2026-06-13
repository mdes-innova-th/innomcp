<!-- cc-team deliverable
 group: G2 (Spec/contract-based tests)
 member: S039 role=spec-test model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":199,"completion_tokens":2507,"total_tokens":2706,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2098,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 25s
 generated: 2026-06-13T11:30:25.541Z -->
```typescript
import { GeoRouter } from '../src/geo/geo-tool-router';

// Contract type definitions inferred from the public API signatures
interface GeoIntentResult {
  type: string;
  origin?: string;
  destination?: string;
  query?: string;
}

interface ToolPlan {
  toolName: string;
  parameters: Record<string, unknown>;
}

describe('GeoRouter Contract Tests', () => {
  let router: GeoRouter;

  beforeEach(() => {
    router = new GeoRouter();
  });

  describe('route(intent: GeoIntentResult)', () => {
    it('should return a valid ToolPlan with "RoutingTool" for a valid routing intent', () => {
      const intent: GeoIntentResult = {
        type: 'route',
        origin: 'Point A',
        destination: 'Point B',
      };

      const plan = router.route(intent);

      expect(plan).not.toBeNull();
      expect(plan!.toolName).toBe('RoutingTool');
      expect(plan!.parameters).toEqual(
        expect.objectContaining({
          origin: 'Point A',
          destination: 'Point B',
        })
      );
    });

    it('should return a valid ToolPlan with "GeocodingTool" for a valid geocoding intent', () => {
      const intent: GeoIntentResult = {
        type: 'geocode',
        query: '1600 Pennsylvania Avenue',
      };

      const plan = router.route(intent);

      expect(plan).not.toBeNull();
      expect(plan!.toolName).toBe('GeocodingTool');
      expect(plan!.parameters).toEqual(
        expect.objectContaining({
          query: '1600 Pennsylvania Avenue',
        })
      );
    });

    it('should return null for an unrecognized or unsupported intent type', () => {
      const intent: GeoIntentResult = {
        type: 'unsupported_intent_type',
        query: 'irrelevant data',
      };

      const plan = router.route(intent);

      expect(plan).toBeNull();
    });

    it('should return null for a valid intent type that lacks required parameters', () => {
      const intent: GeoIntentResult = {
        type: 'route',
        // Missing origin and destination
      };

      const plan = router.route(intent);

      // Contract specifies null for un-routeable intents rather than throwing
      expect(plan).toBeNull();
    });

    it('should throw an error when passed a null or undefined intent', () => {
      expect(() => router.route(null as any)).toThrow();
      expect(() => router.route(undefined as any)).toThrow();
    });

    it('should throw an error when passed a fundamentally malformed intent (missing type)', () => {
      const intent = {} as GeoIntentResult;

      expect(() => router.route(intent)).toThrow();
    });

    it('should not mutate the original intent object', () => {
      const intent: GeoIntentResult = {
        type: 'geocode',
        query: 'Statue of Liberty',
      };
      const originalIntentSnapshot = JSON.stringify(intent);

      router.route(intent);

      expect(JSON.stringify(intent)).toEqual(originalIntentSnapshot);
    });
  });
});
```
