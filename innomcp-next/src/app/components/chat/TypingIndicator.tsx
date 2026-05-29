"use client";

import React from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TypingUser {
  userId: number;
  displayName: string;
}

interface Props {
  typingUsers: TypingUser[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildLabel(typingUsers: TypingUser[]): React.ReactNode {
  if (typingUsers.length === 0) return null;

  const bold = (name: string) => (
    <strong key={name} className="font-semibold text-foreground/80">
      {name}
    </strong>
  );

  if (typingUsers.length === 1) {
    return <>{bold(typingUsers[0].displayName)} is typing</>;
  }

  if (typingUsers.length === 2) {
    return (
      <>
        {bold(typingUsers[0].displayName)} and{" "}
        {bold(typingUsers[1].displayName)} are typing
      </>
    );
  }

  // 3+
  const others = typingUsers.length - 2;
  return (
    <>
      {bold(typingUsers[0].displayName)},{" "}
      {bold(typingUsers[1].displayName)} and {others} other
      {others > 1 ? "s" : ""} are typing
    </>
  );
}

// ─── Animated dots ────────────────────────────────────────────────────────────

function PulsingDots() {
  return (
    <span
      className="ml-1 inline-flex items-center gap-[3px] align-middle"
      aria-hidden="true"
    >
      <span className="h-1 w-1 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
      <span className="h-1 w-1 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
      <span className="h-1 w-1 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
    </span>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

const TypingIndicator: React.FC<Props> = ({ typingUsers }) => {
  if (typingUsers.length === 0) return null;

  return (
    <div
      className="flex h-5 items-center px-1 text-[12px] text-muted-foreground leading-none select-none"
      role="status"
      aria-live="polite"
      aria-label={`${typingUsers.map((u) => u.displayName).join(", ")} typing`}
    >
      {buildLabel(typingUsers)}
      <PulsingDots />
    </div>
  );
};

export default TypingIndicator;
