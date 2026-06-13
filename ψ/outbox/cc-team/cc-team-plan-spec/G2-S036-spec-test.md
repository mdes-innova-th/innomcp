<!-- cc-team deliverable
 group: G2 (Spec/contract-based tests)
 member: S036 role=spec-test model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":221,"completion_tokens":2494,"total_tokens":2715,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1190,"image_tokens":0},"cache_creation_input_tokens":0} | 26s
 generated: 2026-06-13T11:29:58.857Z -->
```typescript
import { GeoGuard } from "../src/geo/geo-guard";

// Mock timers to control async behavior deterministically
jest.useFakeTimers();

describe("GeoGuard", () => {
    describe("constructor", () => {
        it("should use DEFAULT_TIMEOUT_MS when no argument is provided", async () => {
            // We can't access the private timeoutMs, but we can test behaviour:
            // if the default is something like 5000ms, a function that takes 6000ms should timeout.
            const guard = new GeoGuard();
            const fn = jest.fn().mockImplementation(
                () => new Promise<void>(() => {}), // never resolves
            );
            const promise = guard.executeWithGuard(fn);

            // Advance time just below any reasonable default – assume default > 1000
            jest.advanceTimersByTime(1000);
            // Still pending – no error yet
            await expect(Promise.race([promise, Promise.resolve("pending")])).resolves.toBe("pending");

            // Advance time far beyond a common default (e.g., 10000ms > any plausible default)
            jest.advanceTimersByTime(9000); // total 10000ms
            await expect(promise).rejects.toThrow(/timeout/i);
        });

        it("should accept a custom timeout in milliseconds", async () => {
            const guard = new GeoGuard(100);
            const fn = jest.fn(
                () => new Promise<void>(() => {}), // never resolves
            );
            const promise = guard.executeWithGuard(fn);

            // Advance time to just under the timeout
            jest.advanceTimersByTime(99);
            await expect(Promise.race([promise, Promise.resolve("still pending")])).resolves.toBe("still pending");

            // Advance exactly to the timeout threshold
            jest.advanceTimersByTime(1); // now 100ms total
            await expect(promise).rejects.toThrow(/timeout/i);
        });
    });

    describe("executeWithGuard", () => {
        it("should resolve with the value of a successfully completed function", async () => {
            const guard = new GeoGuard(1000);
            const fn = jest.fn(() => Promise.resolve(42));
            await expect(guard.executeWithGuard(fn)).resolves.toBe(42);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it("should resolve with the value when the function completes before the timeout", async () => {
            const guard = new GeoGuard(1000);
            const fn = jest.fn(
                () => new Promise<number>((resolve) => setTimeout(() => resolve(7), 200)),
            );
            const promise = guard.executeWithGuard(fn);

            // Advance time enough for the inner timeout to fire
            jest.advanceTimersByTime(200);
            await expect(promise).resolves.toBe(7);
        });

        it("should reject if the function takes longer than the timeout", async () => {
            const guard = new GeoGuard(100);
            const fn = jest.fn(
                () => new Promise<never>((_, reject) => setTimeout(() => reject(new Error("slow")), 200)),
            );
            const promise = guard.executeWithGuard(fn);

            // Advance time beyond the guard timeout (100ms) but before the inner timeout (200ms)
            jest.advanceTimersByTime(100);
            await expect(promise).rejects.toThrow(/timeout/i);
            // The function's internal rejection should not be observed because the guard already rejected
        });

        it("should reject if the function throws synchronously", async () => {
            const guard = new GeoGuard(1000);
            const fn = jest.fn(() => {
                throw new Error("sync error");
            });
            await expect(guard.executeWithGuard(fn)).rejects.toThrow("sync error");
        });

        it("should reject if the function returns a rejected promise", async () => {
            const guard = new GeoGuard(1000);
            const fn = jest.fn(() => Promise.reject(new Error("async reject")));
            await expect(guard.executeWithGuard(fn)).rejects.toThrow("async reject");
        });

        it("should reject when the execution time exactly equals the timeout (boundary)", async () => {
            // Most implementations treat timeout as >=, so exactly at the limit should fail.
            const guard = new GeoGuard(100);
            const fn = jest.fn(
                () => new Promise<number>((resolve) => setTimeout(() => resolve(1), 100)),
            );
            const promise = guard.executeWithGuard(fn);

            // Advance time exactly to 100ms
            jest.advanceTimersByTime(100);
            await expect(promise).rejects.toThrow(/timeout/i);
            // The inner setTimeout would also fire at 100ms, but the guard timeout fires first
            // and should reject, preventing the resolve from being observed.
        });

        it("should not resolve with the function's result after timeout has been triggered", async () => {
            const guard = new GeoGuard(50);
            const resolveSpy = jest.fn();
            const fn = jest.fn(
                () => new Promise<number>((resolve) => setTimeout(() => resolve(99), 200)),
            );
            const promise = guard.executeWithGuard(fn);
            promise.then(resolveSpy, () => {}); // ignore rejection, just spy

            // Trigger timeout
            jest.advanceTimersByTime(50);
            // Wait for any microtasks to settle
            await Promise.resolve();

            // The timeout should have rejected, so resolveSpy should not have been called
            expect(resolveSpy).not.toHaveBeenCalled();

            // Now advance past the inner timeout – resolution would happen but the guard is done
            jest.advanceTimersByTime(150);
            await Promise.resolve();
            expect(resolveSpy).not.toHaveBeenCalled();
        });
    });
});
```
