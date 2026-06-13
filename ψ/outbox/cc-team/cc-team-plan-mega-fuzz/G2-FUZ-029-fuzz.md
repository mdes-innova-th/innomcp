<!-- cc-team deliverable
 group: G2 (fuzz division)
 member: FUZ-029 role=fuzz model=deepseek/deepseek-v4-pro
 finish_reason: length | tokens: {"prompt_tokens":3022,"completion_tokens":5000,"total_tokens":8022,"prompt_tokens_details":{"cached_tokens":2944,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4187,"image_tokens":0},"cache_creation_input_tokens":0} | 74s
 generated: 2026-06-13T12:09:12.401Z -->
- **SSRF: block IPv4 loopback**  
  Input: `"127.0.0.1"`  
  Expected: `isBlockedHost` returns `true`

- **SSRF: block IPv6 loopback**  
  Input: `"::1"`  
  Expected: `isBlockedHost` returns `true`

- **SSRF: block link-local IPv6 (zone ID bypass)**  
  Input: `"fe80::1%eth0"`  
  Expected: `isBlockedHost` returns `true` (current implementation may fail)

- **SSRF: block localhost case-insensitive**  
  Input: `"LocalHost"`  
  Expected: `isBlockedHost` returns `true`

- **SSRF: whitespace bypass attempt**  
  Input: `" 127.0.0.1 "` (leading/trailing spaces)  
  Expected: `isBlockedHost` returns `true` (hostnames are trimmed; current implementation may fail)

- **SSRF: public hostname passes**  
  Input: `"example.com"`  
  Expected: `isBlockedHost` returns `false`

- **SSRF: 172.16.0.0 – 172.31.255.255 range edge**  
  Input: `"172.16.0.0"` → `true`; `"172.31.255.255"` → `true`; `"172.32.0.0"` → `false`  
  Expected: boundaries respected

- **html→Markdown: no script remnant from self-closing impostor**  
  Input: `<script>var a='</script>';</script>`  
  Expected: output does **not** contain the substring `</script>` (non-greedy regex may leak)

- **html→Markdown: all common entities decoded**  
  Input: `<p>&amp; &lt; &gt; &quot; &#39; &nbsp;</p>`  
  Expected: markdown body contains `& < > " '` (no `&amp;` etc.)

- **html→Markdown: title fallback to hostname**  
  Input: HTML with no `<title>` tag; `baseUrl = "https://example.com/page"`  
  Expected: `title` = `"example.com"`, markdown starts with `# example.com`

- **html→Markdown: title fallback to “Untitled” for invalid baseUrl**  
  Input: HTML without `<title>`; `baseUrl = "not-a-url"`  
  Expected: `title = "Untitled"`

- **html→Markdown: massive input does not crash**  
  Input: 10 MB of nested `<div>`s with text  
  Expected: function returns within a reasonable wall time (e.g., <2 s), no uncaught exception

- **html→Markdown: link with single-quoted href**  
  Input: `<a href='https://x.com'>click</a>`  
  Expected: output contains no raw HTML tag; link text remains, but may not be converted (current regex only matches `href="..."`)

- **html→Markdown: malformed tag <unclosed**  
  Input: `<p>text <unclosed`  
  Expected: output contains literal `<unclosed` but no other raw HTML tags (final `<[^>]+>` pass removes closed tags only)

- **fetchRawHtml: rejects invalid URL**  
  Input: `"not a url"`  
  Expected: throws/rejects with `"Invalid URL"`

- **fetchRawHtml: explicit SSRF reject**  
  Input: `"http://127.0.0.1"`  
  Expected
