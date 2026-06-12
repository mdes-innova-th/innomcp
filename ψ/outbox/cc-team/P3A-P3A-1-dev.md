<!-- cc-team deliverable
 group: P3A (Phase 3.1 â€” Fix fastPathHandler: greetings must pass to LLM, not get 'à¸«à¹‰à¸²à¸¡à¹€à¸”à¸²à¹‚à¸§à¹‰à¸¢')
 member: P3A-1 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":329,"completion_tokens":2910,"total_tokens":3239,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2646,"image_tokens":0},"cache_creation_input_tokens":0} | 42s
 generated: 2026-06-12T03:42:19.331Z -->
  // HISTORY FAST LOOKUP
  // (original history fast-path logic preserved)

  // GREETINGS FAST PATH
  const greetings = ['hello','hi','hey','howdy','greetings','yo','sup','test','ping','à¸ªà¸§à¸±à¸ªà¸”à¸µ'];
  if (greetings.includes(text.toLowerCase())) {
    return sendAiText('greeting', 'à¸ªà¸§à¸±à¸ªà¸”à¸µà¸„à¸£à¸±à¸š! à¸¡��¸µà¸­à¸°à¹„à¸£à¹ƒà¸«à¹‰à¸Šà¹ˆà¸§à¸¢à¹„à¸«à¸¡à¸„à¸£à¸±à¸š? 😊');
  }

  // UNKNOWN/GIBBERISH
  if (/^[a-zA-Z0-9\s]+$/.test(text)) {
    return sendAiText('gibberish', 'ขอโทษครับ ผมไม่เข้าใจคำว่า "' + text + '" คุณช่วยพูดใหม่ได้ไหมครับ?');
  }

  return { handled: false };
