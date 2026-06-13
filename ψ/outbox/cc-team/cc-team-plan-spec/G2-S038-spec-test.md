<!-- cc-team deliverable
 group: G2 (Spec/contract-based tests)
 member: S038 role=spec-test model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":235,"completion_tokens":7000,"total_tokens":7235,"prompt_tokens_details":{"cached_tokens":70,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 108s
 generated: 2026-06-13T11:31:47.250Z -->
The user wants a Jest contract/behavior test for a module `geo-service` with a specific public API.

Public API:
```typescript
export type ToolDispatcher = (toolName: string, params: Record<string, unknown>) => Promise<unknown>;
export class GeoService {
  constructor(private readonly dispatch: ToolDispatcher) {}
  public async handleRequest(userMessage: string): Promise<WeatherPacket> {
```

Wait, the API mentions `WeatherPacket` but it's not defined in the provided surface. I need to infer what `WeatherPacket` likely looks like based on the name and context, or perhaps I should define a mock type for it if needed, but the instructions say "strict TS" and import exactly from '../src/geo/geo-service'. Since `WeatherPacket` is part of the return type of the public method, it must be exported or at least available. However, the user only gave the snippet. I should probably assume `WeatherPacket` is also exported from the module, or I can infer its shape. Since it's a contract test, I need to assert the structure of the returned packet.

Given the name `GeoService` and `handleRequest(userMessage: string)` returning `Promise<WeatherPacket>`, and the dependency on a `ToolDispatcher`, this service likely:
1. Parses the user message to extract location/geo intent.
2. Uses the `dispatch` function to call external tools (e.g., a weather tool, geocoding tool).
3. Aggregates results into a `WeatherPacket`.

Contract tests should verify:
- Valid input: returns a `WeatherPacket` with expected properties (e.g., location, temperature, condition, forecast, etc.). Since I don't know the exact shape, I need to make a reasonable inference or keep it generic enough. But the instructions say "Assert VALUES/STATE (toBe/toEqual/toThrow)". I need to define what `WeatherPacket` might look like. Actually, looking at the prompt, `WeatherPacket` is not defined in the provided snippet. I should probably import it if it's exported, or define it if it's not. But the prompt says "Import EXACTLY: import ... from '../src/geo/geo-service';". This means I should import `GeoService`, `ToolDispatcher`, and likely `WeatherPacket` if it's exported. If it's not exported as a value but used as a type, I can import it as a type. But if it's not exported at all, I might need to infer it. However, the prompt says "public API surface", so `WeatherPacket` is part of that surface. I will assume it's exported as a type.

Let's infer `WeatherPacket` structure. A weather packet likely contains:
- location: string
- temperature: number
- unit: string (e.g., 'C', 'F')
- condition: string
- forecast?: Array<...>
- timestamp?: Date | string

But I don't know for sure. Since this is a contract test based *only* on names and signatures, I should focus on the contract implied by the names:
- `handleRequest` takes a `userMessage` (string) and returns a `WeatherPacket`.
- It uses `dispatch` to call tools.
- The `dispatch` is a `ToolDispatcher`: `(toolName: string, params: Record<string, unknown>) => Promise<unknown>`.

Contractual behavior:
1. For a valid user message (e.g., "What's the weather in Paris?"), `handleRequest` should:
   - Call `dispatch` with appropriate tool name(s) and parameters derived from the user message. Since we don't know the internal logic, we can't assert exact tool names unless implied. But "GeoService" and "WeatherPacket" strongly imply it might dispatch tools like `get_weather`, `geocode`, etc. However, the contract test should not assume implementation details like exact tool names *unless* they are part of the contract. The contract is that it uses the dispatcher to get weather data and returns a structured packet.
   - Wait, the prompt says "Test observable behavior/contracts implied by the names+signatures". The name `GeoService` and `handleRequest` returning `WeatherPacket` implies it processes a natural language request into weather data. The `dispatch` is the mechanism to reach external tools. The contract is that given a user message, it returns a valid WeatherPacket. It might dispatch one or more tools. We should mock `dispatch` to return deterministic values and assert the final `WeatherPacket` value.

2. For invalid inputs:
   - `userMessage` is empty string: should throw or reject? Contractually, if the method accepts a string, empty string might be invalid. It should probably throw a specific error (e.g., `Invalid user message` or similar). Since we don't know the exact error message, we can assert it throws *something* or a specific type if we can infer it. But the prompt says "error/throw on invalid inputs". An empty string is a good boundary case.
   - `userMessage` is not a string? But TS would catch that at compile time. However, in JS runtime, it could receive null/undefined. The signature says `string`, but runtime contract might throw if not a string. But in strict TS tests, we might not test runtime type checks unless the contract explicitly says it validates. Given the strict TS rule, maybe we focus on logical invalid inputs like empty string.

3. Boundary conditions:
   - Very long user message.
   - User message with special characters.
   - Dispatcher returning unexpected data: should handle gracefully or throw? The contract of `handleRequest` is to return a `WeatherPacket`. If the dispatcher returns malformed data, the service might throw. This is a contract boundary.

4. Mocking `dispatch`:
   - We need to mock the `dispatch` function deterministically.
   - Since `dispatch` returns `Promise<unknown>`, we mock it to return whatever the service expects (e.g., weather data objects).

Let's think about what `WeatherPacket` might look like. I'll define a reasonable interface for the test. But wait, if `WeatherPacket` is imported from the module, I don't need to redefine it. I just need to use it in type annotations. However, if the actual module doesn't export it, the test would fail. The prompt says the public API surface includes `WeatherPacket` as the return type, so it's part of the surface. I will import it.

Actually, the prompt only explicitly shows:
```typescript
export type ToolDispatcher = ...
export class GeoService {
  constructor(private readonly dispatch: ToolDispatcher) {}
  public async handleRequest(userMessage: string): Promise<WeatherPacket> {
```

It doesn't explicitly show `export type WeatherPacket = ...`, but it's referenced. I will assume it's exported. If not, I can import it as a type if it's there, or I might need to declare it. But to be safe and follow "Import EXACTLY", I should import `GeoService`, `ToolDispatcher`, and `WeatherPacket`.

Wait, the prompt says "Import EXACTLY: import ... from '../src/geo/geo-service';". The ellipsis means I should fill in what is imported from that path. So: `import { GeoService, ToolDispatcher, WeatherPacket } from '../src/geo/geo-service';`.

Now, what are the contracts?

Contract 1: Successful weather retrieval.
- Input: userMessage = "Weather in Tokyo"
- Mock dispatch: When called with a tool name and params containing location "Tokyo", return a weather object. But we don't know the exact tool name. The contract test shouldn't assume internal tool names unless necessary. However, to test the contract, we must mock the dispatch. The service will call dispatch with *some* tool name and *some* params. We can set up the mock to return a valid weather payload for any call, or we can assert that dispatch was called. But rule 2 says "Assert VALUES/STATE (toBe/toEqual/toThrow), not just that mocks were called." So asserting that dispatch was called is secondary; the primary assertion is the return value.
- But if we don't know what dispatch returns, how do we know what WeatherPacket looks like? We need to infer a reasonable shape for `WeatherPacket` and the mock return values. The contract is that `handleRequest` transforms the dispatcher's raw result into a `WeatherPacket`.

Let's assume `WeatherPacket` has at least:
```typescript
export interface WeatherPacket {
  location: string;
  temperature: number;
  condition: string;
  unit: string;
}
```

And the dispatcher might return something like `{ temp: 20, condition: 'Sunny', location: 'Tokyo' }` which the service maps.

But I need to be careful: I am not given the implementation, so I must test the contract implied by names. The contract is:
- `handleRequest` returns a `Promise<WeatherPacket>`.
- It should resolve to an object that is a valid weather packet.
- It should use the `dispatch` tool to fulfill the request.

Let's design the test file:

```typescript
import { GeoService, ToolDispatcher, WeatherPacket } from '../src/geo/geo-service';

describe('GeoService', () => {
  let mockDispatch: jest.MockedFunction<ToolDispatcher>;
  let geoService: GeoService;

  beforeEach(() => {
    mockDispatch = jest.fn<ToolDispatcher>();
    geoService = new GeoService(mockDispatch);
  });

  describe('handleRequest', () => {
    it('should return a WeatherPacket for a valid location query', async () => {
      // Arrange: mock dispatch to return deterministic weather data
      const rawWeather = {
        location: 'Paris, France',
        temperature: 18,
        unit: 'C',
        condition: 'Partly Cloudy',
        humidity: 65,
      };
      mockDispatch.mockResolvedValue(rawWeather);

      const userMessage = 'What is the weather like in Paris?';

      // Act
      const result = await geoService.handleRequest(userMessage);

      // Assert: result must be a valid WeatherPacket with expected values mapped from dispatch
      // Since we don't know exact mapping, we assert the shape and values derived from mock.
      // But wait, if the implementation maps fields, we might not know the exact field names.
      // However, contractually, the returned packet should contain weather information.
      // Let's assume the service passes through or maps the dispatcher result into the packet shape.
      // Actually, to make the test robust without knowing implementation, we should assert that
      // the result is an object containing weather-related data, and that dispatch was invoked.
      // But rule 2 says assert values/state, not just mocks.
      // Let's assume WeatherPacket is defined as:
      // { location: string; temperature: number; condition: string; unit: string; }
      // And the service constructs it from dispatch results.
      
      // Hmm, this is tricky without knowing the shape. Let me think differently.
      // The prompt says "Test observable behavior/contracts implied by the names+signatures".
      // The most important contract is: given a user message, it returns a WeatherPacket.
      // It must call dispatch at least once (since it has no other deps).
      // It must throw on empty string.
      // It must throw if dispatch throws.
      // It must handle boundary inputs (very long string, special chars).
      
      // Let's define a plausible WeatherPacket interface in the test if it's not exported?
      // No, I should import it. If the real module exports it, great. If not, the test won't compile.
      // But the prompt implies WeatherPacket is part of the public API surface.
      
      // Let's assume the module exports WeatherPacket as:
      // export interface WeatherPacket {
      //   location: string;
      //   temperature: number;
      //   unit: 'C' | 'F';
      //   condition: string;
      //   forecast?: Array<{ day: string; high: number; low: number; condition: string }>;
      // }
      
      // I will write the test assuming the service maps dispatcher results to this shape.
      // But to avoid guessing field names too specifically, I can assert structural properties
      // that any WeatherPacket must have based on the name.
    });
  });
});
```

Wait, I need to be more concrete. The user wants a complete test file. I need to make reasonable assumptions about the shape of `WeatherPacket` and how `dispatch` is used, but frame it as testing the contract.

Let's look at the name `GeoService`. It might dispatch a `geocode` tool and then a `weather` tool. Or just a `get_weather` tool. The contract is that it interprets the user message and dispatches appropriate tool(s). But without knowing the exact tool names, I can still set up the mock to return values for *any* tool call, and assert on the final packet.

However, if the service calls dispatch multiple times (e.g., first geocode, then weather), the mock should handle that. I can use `mockImplementation` based on the tool name.

Let's assume:
- `WeatherPacket` has: `location`, `temperature`, `condition`, `unit`.
- The service might call `dispatch('geocode', { query: 'Paris' })` returning `{ lat: 48.85, lon: 2.35, name: 'Paris' }`.
- Then `dispatch('get_weather', { lat: 48.85, lon: 2.35 })` returning `{ temp: 18, condition: 'Cloudy', unit: 'C' }`.
- Then it combines into `WeatherPacket: { location: 'Paris', temperature: 18, condition: 'Cloudy', unit: 'C' }`.

But this assumes a lot about implementation (tool names). Is that okay? The prompt says "Mock external deps (db/network/fs/other services) deterministically." and "Test observable behavior/contracts implied by the names+signatures". The tool dispatcher is the external dep. The contract is that the service uses the dispatcher to get weather info. The exact tool names might be an implementation detail, but they are also part of the contract if the service is a specific orchestrator.

Alternatively, I can make the mock generic and assert that the result is a `WeatherPacket` with values that could only come from the mock. But if I don't know how the service maps them, I can't assert exact values.

Wait, perhaps the `dispatch` function is used as a generic tool caller, and `GeoService` is a specific class that knows which tools to call. The contract test should verify that for a given user message, the service interacts with the dispatcher correctly and produces a valid packet. But rule 2 says "Assert VALUES/STATE... not just that mocks were called."

Maybe the best approach is to assume `WeatherPacket` is a branded type or interface, and the service's job is to return it. I can assert:
1. The result is defined and not null.
2. The result has properties consistent with a weather packet (location, temp, etc.).
3. The service throws on empty input.
4. The service propagates errors from dispatch.
5. The service handles dispatch returning unexpected shapes by throwing.

Since I have to write strict TS, I need the actual type names. I'll import `WeatherPacket`. If I need to reference its properties, I'll assume them. But to be safe, I can use type assertions or expect the result to match a partial object.

Actually, I can write the test in a way that defines the expected shape of `WeatherPacket` locally if needed, but since I must import it, I'll use it.

Let me reconsider the prompt. It says "You are given ONLY its public API surface (signatures)". This means I should derive the contract purely from the names and signatures. The signature is:
- `handleRequest(userMessage: string): Promise<WeatherPacket>`

Contracts implied:
- Input: non-empty string representing a user message. Output: Promise resolving to WeatherPacket.
- Input: empty string. Output: Promise rejecting (throwing) because it's not a valid request.
- The method is async, so it always returns a Promise.
- It depends on `dispatch`. If `dispatch` rejects, `handleRequest` should reject (propagate the error or wrap it? Propagation is the default contract unless specified otherwise).
- It must call `dispatch` because otherwise it cannot produce weather data (no other deps in constructor).

So the test should:
1. Mock `dispatch` to resolve with a deterministic object that the service can turn into a `WeatherPacket`. Since I don't know the exact mapping, I will make the mock return a comprehensive object and assert that the resulting `WeatherPacket` has the expected structure. But I need to know the structure.

Let's assume `WeatherPacket` is:
```typescript
export interface WeatherPacket {
  location: string;
  temperature: number;
  unit: string;
  condition: string;
}
```

This is a reasonable assumption. I'll proceed with this assumption and add a comment or just use it. But since I'm writing the test file only, I can't declare the interface if it's imported. I'll just use it in type positions.

Wait, if `WeatherPacket` is an interface, I can use `expect(result).toEqual(expect.objectContaining({...}))`. This doesn't require me to know every field, but I should assert the fields that are contractually necessary.

Let's think about what fields are contractually necessary for a `WeatherPacket`. The name implies it's a packet of weather data. It must contain:
- Where: `location`
- What: `temperature`, `condition`
- Maybe `unit`

I will assert these.

Now, how does the service map from dispatch result? I'll assume the dispatch result for a weather tool is something like:
```typescript
{
  city: 'Paris',
  temp_c: 20,
  condition: { text: 'Sunny' }
}
```
But I don't know. This is too implementation-specific.

Alternative approach: The contract test should treat the service as a black box. We give it a message, we mock `dispatch` to return *any* valid weather payload, and we assert that the returned `WeatherPacket` is a valid object. But we can't check exact values without knowing the mapping.

However, maybe the `WeatherPacket` is literally the return value of `dispatch` casted/validated? No, that seems unlikely.

Another idea: Perhaps `GeoService` is an MCP (Model Context Protocol) service (the name "innomcp-node" suggests MCP). In MCP, a service handles a request by dispatching tool calls. The `handleRequest` might parse the user message, decide to call a weather tool, and return the tool's result formatted as a `WeatherPacket`. The `WeatherPacket` might be the direct result or a wrapper.

Given the ambiguity, I should write tests that are robust:
- Test 1: Valid input. Mock `dispatch` to return a known object. Assert that `handleRequest` resolves to an object. Assert that the object matches the expected `WeatherPacket` shape. I'll define the expected shape based on reasonable inference. If the actual module differs, this is the best I can do given the prompt.
- Test 2: Empty string input. Assert `rejects.toThrow()`.
- Test 3: `dispatch` throws. Assert `rejects.toThrow()`.
- Test 4: `dispatch` returns null/invalid. Assert `rejects.toThrow()` or returns a default? The contract implies it needs weather data, so invalid dispatch result should throw.
- Test 5: Long user message. Should still work.
- Test 6: User message with no location. Should throw.

Let's refine the mock. Since `GeoService` likely dispatches a tool like `weather/get` or `geocode`, I can make `mockDispatch` return appropriate data based on the `toolName` argument. This is deterministic and offline.

```typescript
mockDispatch.mockImplementation(async (toolName, params) => {
  if (toolName === 'geocode') {
    return { lat: 35.68, lon: 139.69, name: params.query };
  }
  if (toolName === 'weather') {
    return { temperature: 22, condition: 'Clear', unit: 'C' };
  }
  throw new Error(`Unknown tool: ${toolName}`);
});
```

Then the service is expected to combine these into a `WeatherPacket: { location: 'Tokyo', temperature: 22, condition: 'Clear', unit: 'C' }`.

This assumes tool names, which is a bit implementation-specific, but necessary to make the mock deterministic. However, the prompt says "Mock external deps deterministically". This is fine.

But wait, the prompt says "Test observable behavior/contracts implied by the names+signatures". Is assuming tool names 'geocode' and 'weather' too specific? Maybe. But `GeoService` implies geocoding and weather. The `ToolDispatcher` signature takes a `toolName: string`. The service must use some tool names. The contract test can verify that it calls dispatch with tool names that are strings, and that the params are a Record. But that's weak.

Perhaps a better approach: Since we don't know the tool names, we can make the mock return a generic successful payload for *any* tool call, and assert that the final `WeatherPacket` contains data derived from the user message or the mock. But again, we don't know the mapping.

Let's reconsider. Maybe `WeatherPacket` is simply the return value of the `dispatch` call, wrapped or typed. For example:
```typescript
public async handleRequest(userMessage: string): Promise<WeatherPacket> {
  // ... parse userMessage to extract location ...
  const result = await dispatch('get_weather', { location: parsed });
  return result as WeatherPacket;
}
```
If this is the case, then the mock return value directly determines the `WeatherPacket`. This is the simplest contract. The service is just an orchestrator that calls the dispatcher and returns its result (cast/validated).

Let's assume this simpler contract: `handleRequest` parses the message, calls `dispatch` with some tool/parameters, and returns the result as a `WeatherPacket`. The test can then assert that the returned value equals the mock's resolved value (or a derivation).

But even then, I don't know if it modifies the result.

Given the constraints, I will write a comprehensive contract test that:
1. Assumes `WeatherPacket` is an object with at least `location`, `temperature`, `condition`, and `unit`.
2. Mocks `dispatch` to return an object satisfying that shape (as if the external tool returns raw weather data).
3. Asserts that `handleRequest` returns an object matching the expected `WeatherPacket` values.
4. Tests error cases: empty string, dispatch rejection, dispatch returning malformed data (missing required fields).
5. Tests boundary: very long string.

To make it strict TS and not assume too much, I'll define a helper type in the test? No, I should import `WeatherPacket`. If the real `WeatherPacket` has different fields, my test might not compile. But I have to make reasonable assumptions.

Let's assume the module exports:
```typescript
export interface WeatherPacket {
  location: string;
  temperature: number;
  condition: string;
  unit: 'C' | 'F';
}
```

This is minimal and reasonable.

Now, the test structure:

```typescript
import { GeoService, ToolDispatcher, WeatherPacket } from '../src/geo/geo-service';

describe('GeoService', () => {
  let mockDispatch: jest.MockedFunction<ToolDispatcher>;
  let service: GeoService;

  beforeEach(() => {
    mockDispatch = jest.fn<ToolDispatcher>();
    service = new GeoService(mockDispatch);
  });

  describe('handleRequest', () => {
    it('resolves with a WeatherPacket containing weather data for a valid user message', async () => {
      const mockWeather: WeatherPacket = {
        location: 'Berlin',
        temperature: 15,
        condition: 'Cloudy',
        unit: 'C',
      };
      mockDispatch.mockResolvedValue(mockWeather);

      const result = await service.handleRequest('What is the weather in Berlin?');

      expect(result).toEqual(mockWeather);
      expect(mockDispatch).toHaveBeenCalledTimes(1);
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ location: 'Berlin' }) // or expect.any(Object)
      );
    });

    it('rejects when userMessage is an empty string', async () => {
      await expect(service.handleRequest('')).rejects.toThrow();
    });

    it('rejects when the dispatcher throws an error', async () => {
      mockDispatch.mockRejectedValue(new Error('Network failure'));
      await expect(service.handleRequest('Weather in Tokyo')).rejects.toThrow('Network failure');
    });

    it('rejects when the dispatcher returns data missing required WeatherPacket fields', async () => {
      mockDispatch.mockResolvedValue({ invalid: true } as unknown as WeatherPacket);
      await expect(service.handleRequest('Weather in Madrid')).rejects.toThrow();
    });

    it('handles very long user messages without crashing', async () => {
      const longMessage = 'Weather in ' + 'a'.repeat(10000);
      const mockWeather: WeatherPacket = {
        location: 'a'.repeat(10000),
        temperature: 25,
        condition: 'Sunny',
        unit: 'C',
      };
      mockDispatch.mockResolvedValue(mockWeather);
      const result = await service.handleRequest(longMessage);
      expect(result.location).toBe(mockWeather.location);
    });
  });
});
```

Wait, the last test assumes the service extracts the location and passes it to dispatch. If the service doesn't do that, the mock might not be called with that location. But the contract implies it should parse the message.

However, `expect(mockDispatch).toHaveBeenCalledWith(expect.any(String), expect.any(Object))` is asserting on mocks, which the prompt says "not just that mocks were called". But it also says "Assert VALUES/STATE... not just that mocks were called." It doesn't forbid mock assertions entirely, but the primary assertions must be on values/state. So I should focus on the return value.

Let's refine. The prompt says "Mock external deps... deterministically." and "Assert VALUES/STATE (toBe/toEqual/toThrow), not just that mocks were called." So I should minimize mock call assertions, or at least not make them the only assertion. The `toEqual(mockWeather)` is a value assertion. The `toHaveBeenCalledTimes` is a mock assertion. I can include it but ensure value assertions are present.

Actually, if the service transforms the dispatch result, `toEqual(mockWeather)` might fail. For example, if the service adds a timestamp or changes field names. But without implementation, assuming pass-through is the safest baseline. Or I can assert `expect(result).toMatchObject(mockWeather)` which is less strict.

Let's think about what is universally true for the contract:
- The result must be a `WeatherPacket`.
- If `dispatch` resolves to X, and if the service is a pure pass-through/transform, the result should contain the weather data.
- The service must not return null/undefined for valid input.
- The service must throw for empty input.
- The service must propagate dispatch errors.

I can write the test to be agnostic to the exact transformation by asserting structural properties of the result that must hold regardless.

But I need to compile this in strict TS. So I need to know the properties of `WeatherPacket`. I'll assume the properties I mentioned.

Let's try to make the test as contract-focused as possible, minimizing assumptions about internal tool names.

```typescript
import { GeoService, ToolDispatcher, WeatherPacket } from '../src/geo/geo-service';

describe('GeoService contract', () => {
  let mockDispatch: jest.MockedFunction<ToolDispatcher>;
  let geoService: GeoService;

  beforeEach(() => {
    mockDispatch = jest.fn<ToolDispatcher>();
    geoService = new GeoService(mockDispatch);
  });

  describe('handleRequest', () => {
    it('returns a resolved WeatherPacket for a non-empty user message when dispatch yields valid data', async () => {
      // Deterministic mock: external tool returns structured weather data
      const toolResponse: WeatherPacket = {
        location: 'Reykjavik',
        temperature: -2,
        condition: 'Snow',
        unit: 'C',
      };
      mockDispatch.mockResolvedValue(toolResponse);

      const packet = await geoService.handleRequest('What is the weather in Reykjavik?');

      // Contract: the returned packet must be a valid WeatherPacket with observable values
      expect(packet).toBeDefined();
      expect(packet.location).toBe('Reykjavik');
      expect(packet.temperature).toBe(-2);
      expect(packet.condition).toBe('Snow');
      expect(packet.unit).toBe('C');
    });

    it('throws when userMessage is empty', async () => {
      await expect(geoService.handleRequest('')).rejects.toThrow();
    });

    it('propagates errors when the tool dispatcher rejects', async () => {
      const networkError = new Error('Dispatcher offline');
      mockDispatch.mockRejectedValue(networkError);

      await expect(geoService.handleRequest('Weather in Oslo')).rejects.toThrow('Dispatcher offline');
    });

    it('throws when dispatch returns data that cannot form a valid WeatherPacket', async () => {
      mockDispatch.mockResolvedValue({} as unknown as WeatherPacket);
      await expect(geoService.handleRequest('Weather in Lima')).rejects.toThrow();
    });

    it('processes boundary-length user messages without truncation errors', async () => {
      const extremeLocation = 'Z'.repeat(5000);
      const boundaryPacket: WeatherPacket = {
        location: extremeLocation,
        temperature: 0,
        condition: 'Windy',
        unit: 'F',
      };
      mockDispatch.mockResolvedValue(boundaryPacket);

      const packet = await geoService.handleRequest(`Tell me the weather in ${extremeLocation}`);

      expect(packet.location).toBe(extremeLocation);
      expect(packet.unit).toBe('F');
    });
  });
});
```

This looks good. It tests:
- Valid input -> correct output values (location, temp, condition, unit).
- Empty input -> throws.
- External dep failure -> propagates throw.
- Invalid external data -> throws.
- Boundary (long string) -> handles correctly, state preserved.

I used `toBe` for primitives and `toBeDefined`. I didn't assert mock calls as the primary thing. I did use `mockDispatch.mockResolvedValue` to set up the mock, which is necessary.

One issue: `mockDispatch.mockResolvedValue({} as unknown as WeatherPacket)` — if `WeatherPacket` is an interface, `{}` is not a valid `WeatherPacket`, so casting is needed. This is fine.

Another issue: The test assumes `WeatherPacket` has `location`, `temperature`, `condition`, `unit`. If the actual type has different names, this test won't compile. But given the name `WeatherPacket`, these are highly likely fields. I could make it slightly more generic by using `expect.objectContaining` if I knew the shape. But I need to access properties for strict TS.

Wait, I can avoid assuming specific property names by testing the contract more abstractly:
- `expect(packet).toBeDefined();`
- `expect(typeof packet).toBe('object');`
- But this is too weak. The prompt says "Assert VALUES/STATE". So I should assert specific values.

Given that I must produce a complete test file and the prompt implies `WeatherPacket` is part of the public API, I will proceed with the assumed shape. It's the only way to write a meaningful contract test.

Let me double-check the import rule: "Import EXACTLY: import ... from '../src/geo/geo-service';". This means the import line should look like:
`import { GeoService, ToolDispatcher, WeatherPacket } from '../src/geo/geo-service';`
I should not import anything else.

Also, "Strict TS" means I should use types everywhere. `jest.MockedFunction<ToolDispatcher>` is good.

Let's refine the test names and content to be very contract-focused.

Test 1: `should resolve to a WeatherPacket whose fields reflect the deterministic tool response for a valid user message`
- This asserts the mapping contract.

Test 2: `should reject with an error when the user message is empty`
- Boundary/invalid input.

Test 3: `should reject with an error when the tool dispatcher fails`
- Error propagation contract.

Test 4: `should reject when the tool dispatcher returns an incomplete payload`
- Robustness contract.

Test 5: `should correctly handle extremely long user messages and preserve returned state`
- Boundary condition.

I should also consider the case where `userMessage` has no discernible location. The contract might throw. I'll add:
Test 6: `should reject when the user message does not contain a resolvable location`

But I don't know if the service throws or returns a default. Given the signature returns `WeatherPacket`, it probably throws if it can't resolve. I'll add it.

Let's write the final code.

One more thought: The prompt says "Mock external deps (db/network/fs/other services) deterministically. Offline
