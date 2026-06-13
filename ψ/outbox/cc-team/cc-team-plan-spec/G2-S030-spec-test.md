<!-- cc-team deliverable
 group: G2 (Spec/contract-based tests)
 member: S030 role=spec-test model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":360,"completion_tokens":324,"total_tokens":684,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 10s
 generated: 2026-06-13T11:27:55.697Z -->
Looking at the provided API surface, I notice that the module's public interface is extremely minimal:

```typescript
interface HeartbeatInfo { ... }      // empty interface - no fields visible
export class WSEnhancer { ... }      // no methods visible
export const wsEnhancer = new WSEnhancer();  // instance with no visible API
```

The API surface contains:
- An empty `HeartbeatInfo` interface (no members shown)
- A `WSEnhancer` class with no visible method signatures
- A singleton instance

I cannot write a meaningful contract test for this module because:

1. **No method signatures are provided** for `WSEnhancer` - I would have to invent the methods to test, which violates the rule to test the actual contract.
2. **The `HeartbeatInfo` interface has no defined fields** - I cannot construct valid test fixtures or assert on its shape.
3. **There are no inputs/outputs to test against** - any test I write would be fabricated behavior, not testing the implied contract.

To produce a valid contract test, I need at minimum:
- The method signatures of `WSEnhancer` (method names, parameters, return types)
- The shape of `HeartbeatInfo` (its properties and types)
- The expected error conditions or throw cases (if any)

Could you provide the full public API surface including the method signatures inside the `WSEnhancer` class and the properties of the `HeartbeatInfo` interface? Once I have those, I can write a proper contract test that asserts on real observable behavior.
