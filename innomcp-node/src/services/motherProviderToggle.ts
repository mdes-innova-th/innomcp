/**
 * services/motherProviderToggle.ts — Per-provider runtime enable/disable
 *
 * Simple in-memory Set of disabled provider IDs. All 14 providers start
 * enabled. Toggling persists until process restart (by design — no DB needed
 * for a feature-flag toggle).
 */

const disabledProviders = new Set<string>();

/** Returns true if the provider is currently enabled (not disabled). */
export function isProviderEnabled(providerId: string): boolean {
  return !disabledProviders.has(providerId);
}

/** Disable a provider — it will be skipped by dispatchMother. */
export function disableProvider(providerId: string): void {
  disabledProviders.add(providerId);
}

/** Re-enable a previously disabled provider. */
export function enableProvider(providerId: string): void {
  disabledProviders.delete(providerId);
}

/** Toggle a provider — returns the new enabled state. */
export function toggleProvider(providerId: string): boolean {
  if (disabledProviders.has(providerId)) {
    disabledProviders.delete(providerId);
    return true;  // now enabled
  } else {
    disabledProviders.add(providerId);
    return false; // now disabled
  }
}

/** Returns a snapshot of all disabled provider IDs. */
export function getDisabledProviders(): string[] {
  return Array.from(disabledProviders);
}

/** Reset all providers to enabled (for testing). */
export function resetAllProviders(): void {
  disabledProviders.clear();
}
