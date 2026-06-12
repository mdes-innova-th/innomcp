<!-- cc-team deliverable
 group: P3A (Phase 3.1 â€” Fix fastPathHandler: greetings must pass to LLM, not get 'à¸«à¹‰à¸²à¸¡à¹€à¸”à¸²à¹‚à¸§à¹‰à¸¢')
 member: P3A-3 role=dev model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":137,"completion_tokens":1153,"total_tokens":1290,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":627,"image_tokens":0},"cache_creation_input_tokens":0} | 23s
 generated: 2026-06-12T03:42:00.682Z -->
```typescript
    // ===== UNKNOWN / GIBBERISH =====

    // --- Greetings lookup (fast-path before gibberish detection) ---
    const normalizedForGreeting = (text ?? '').trim().toLowerCase();
    const GREETINGS: ReadonlySet<string> = new Set([
      'hi',
      'hello',
      'hey',
      'howdy',
      'test',
      'ping',
      'สวัสดี',
    ]);

    if (normalizedForGreeting.length > 0 && GREETINGS.has(normalizedForGreeting)) {
      await sendAiText({
        text:
          'Hello! 👋 I\'m here and ready to help. What would you like to do today?',
        sessionId,
        userId,
      });
      return { handled: true };
    }

    // --- Original gibberish / nonsense detection (kept intact) ---
    const raw = (text ?? '').trim();
    if (raw.length > 0) {
      const letters = raw.replace(/[^a-zA-Z\u0E00-\u0E7F]/g, '');
      const uniqueLetters = new Set(letters.toLowerCase()).size;
      const ratio = letters.length > 0 ? uniqueLetters / letters.length : 1;
      const hasVowel = /[aeiouAEIOU\u0E30-\u0E4F]/.test(raw);
      const wordCount = raw.split(/\s+/).filter(Boolean).length;
      const avgWordLen =
        wordCount > 0
          ? raw.replace(/\s+/g, '').length / wordCount
          : raw.length;

      const isGibberish =
        (letters.length >= 6 && ratio < 0.25 && !hasVowel) ||
        (letters.length >= 10 && ratio < 0.3) ||
        (wordCount === 1 && avgWordLen > 18 && ratio < 0.35) ||
        /^(.)\1{4,}$/.test(raw);

      if (isGibberish) {
        await sendAiText({
          text:
            "I'm not sure I understood that. Could you rephrase your message, please?",
          sessionId,
          userId,
        });
        return { handled: true };
      }
    }

```
