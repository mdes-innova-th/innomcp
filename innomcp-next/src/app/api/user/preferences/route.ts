import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

interface UserPreferences {
  theme: "light" | "dark" | "system";
  language: "th" | "en";
  providerMode: "remote" | "local";
  defaultModel: string;
  chatMode: "normal" | "multiagent";
  compactMode: boolean;
  showTimestamps: boolean;
  soundEnabled: boolean;
  keyboardShortcuts: boolean;
  tourCompleted: boolean;
  favoritePrompts: string[];
  customProviders: Array<{ name: string; baseUrl: string }>;
}

const defaults: UserPreferences = {
  theme: "system",
  language: "th",
  providerMode: "remote",
  defaultModel: "mdes-ollama-default",
  chatMode: "normal",
  compactMode: false,
  showTimestamps: true,
  soundEnabled: true,
  keyboardShortcuts: true,
  tourCompleted: false,
  favoritePrompts: [],
  customProviders: [],
};

const COOKIE_NAME = "userPreferences";

function sanitizeInput(input: unknown): Partial<UserPreferences> {
  if (typeof input !== "object" || input === null) return {};
  const data = input as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  if ("theme" in data && ["light", "dark", "system"].includes(data.theme as string))
    sanitized.theme = data.theme;
  if ("language" in data && ["th", "en"].includes(data.language as string))
    sanitized.language = data.language;
  if ("providerMode" in data && ["remote", "local"].includes(data.providerMode as string))
    sanitized.providerMode = data.providerMode;
  if ("defaultModel" in data && typeof data.defaultModel === "string")
    sanitized.defaultModel = data.defaultModel;
  if ("chatMode" in data && ["normal", "multiagent"].includes(data.chatMode as string))
    sanitized.chatMode = data.chatMode;
  if ("compactMode" in data && typeof data.compactMode === "boolean")
    sanitized.compactMode = data.compactMode;
  if ("showTimestamps" in data && typeof data.showTimestamps === "boolean")
    sanitized.showTimestamps = data.showTimestamps;
  if ("soundEnabled" in data && typeof data.soundEnabled === "boolean")
    sanitized.soundEnabled = data.soundEnabled;
  if ("keyboardShortcuts" in data && typeof data.keyboardShortcuts === "boolean")
    sanitized.keyboardShortcuts = data.keyboardShortcuts;
  if ("tourCompleted" in data && typeof data.tourCompleted === "boolean")
    sanitized.tourCompleted = data.tourCompleted;
  if ("favoritePrompts" in data && Array.isArray(data.favoritePrompts))
    sanitized.favoritePrompts = data.favoritePrompts.filter(
      (p: unknown) => typeof p === "string"
    );
  if ("customProviders" in data && Array.isArray(data.customProviders))
    sanitized.customProviders = data.customProviders.filter(
      (p: unknown) =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as Record<string, unknown>).name === "string" &&
        typeof (p as Record<string, unknown>).baseUrl === "string"
    );

  return sanitized as Partial<UserPreferences>;
}

function mergePreferences(
  current: UserPreferences,
  input: Partial<UserPreferences>
): UserPreferences {
  return { ...defaults, ...current, ...input };
}

async function getCurrentPreferences(): Promise<UserPreferences> {
  const cookieStore = await cookies();
  const prefCookie = cookieStore.get(COOKIE_NAME);
  if (prefCookie) {
    try {
      const parsed = JSON.parse(prefCookie.value);
      if (typeof parsed === "object" && parsed !== null) {
        return { ...defaults, ...parsed };
      }
    } catch { /* ignore */ }
  }
  return { ...defaults };
}

async function setPreferencesCookie(prefs: UserPreferences): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, JSON.stringify(prefs), {
    httpOnly: false,
    path: "/",
    sameSite: "lax",
  });
}

async function deletePreferencesCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function GET(): Promise<NextResponse> {
  const prefs = await getCurrentPreferences();
  await setPreferencesCookie(prefs);
  return NextResponse.json(prefs);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const currentPrefs = await getCurrentPreferences();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "เนื้อหาคำขอไม่ใช่ JSON" }, { status: 400 });
  }
  const sanitizedInput = sanitizeInput(body);
  const updatedPrefs = mergePreferences(currentPrefs, sanitizedInput);
  await setPreferencesCookie(updatedPrefs);
  return NextResponse.json(updatedPrefs);
}

export async function DELETE(): Promise<NextResponse> {
  await deletePreferencesCookie();
  return NextResponse.json(defaults);
}