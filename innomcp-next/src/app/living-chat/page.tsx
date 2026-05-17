"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type ChatMode = "local" | "remote" | "hybrid";

export default function LivingChatPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to main chat with thinking mode enabled
    router.push("/?thinkingMode=true");
  }, [router]);

  return null;
}
