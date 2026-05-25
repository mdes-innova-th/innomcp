/**
 * Unit tests for webFetchTool service.
 *
 * Tests cover:
 * - SSRF protection (blocked hosts)
 * - htmlToMarkdown conversion
 * - isBlockedHost helper
 * - FetchResult shape
 * - Invalid URL handling
 *
 * No live HTTP calls — SSRF/error paths short-circuit before any network I/O.
 */

import { describe, it, expect } from "@jest/globals";
import * as os from "os";
import * as path from "path";
import { webFetch, isBlockedHost, htmlToMarkdown } from "../../src/services/webFetchTool";

const WORKSPACE = path.join(os.tmpdir(), "innomcp-test-webfetch");

// ---------------------------------------------------------------------------
// SSRF protection — isBlockedHost helper
// ---------------------------------------------------------------------------
describe("isBlockedHost", () => {
  it("blocks localhost", () => expect(isBlockedHost("localhost")).toBe(true));
  it("blocks LOCALHOST (case-insensitive)", () => expect(isBlockedHost("LOCALHOST")).toBe(true));
  it("blocks 127.0.0.1", () => expect(isBlockedHost("127.0.0.1")).toBe(true));
  it("blocks 127.255.255.255", () => expect(isBlockedHost("127.255.255.255")).toBe(true));
  it("blocks 10.0.0.1", () => expect(isBlockedHost("10.0.0.1")).toBe(true));
  it("blocks 10.255.255.255", () => expect(isBlockedHost("10.255.255.255")).toBe(true));
  it("blocks 192.168.0.1", () => expect(isBlockedHost("192.168.0.1")).toBe(true));
  it("blocks 192.168.255.255", () => expect(isBlockedHost("192.168.255.255")).toBe(true));
  it("blocks 172.16.0.1", () => expect(isBlockedHost("172.16.0.1")).toBe(true));
  it("blocks 172.31.255.255", () => expect(isBlockedHost("172.31.255.255")).toBe(true));
  it("blocks 0.0.0.0", () => expect(isBlockedHost("0.0.0.0")).toBe(true));
  it("blocks ::1 (IPv6 loopback)", () => expect(isBlockedHost("::1")).toBe(true));
  it("blocks 169.254.169.254 (AWS metadata)", () => expect(isBlockedHost("169.254.169.254")).toBe(true));
  it("allows example.com", () => expect(isBlockedHost("example.com")).toBe(false));
  it("allows api.github.com", () => expect(isBlockedHost("api.github.com")).toBe(false));
  it("allows 8.8.8.8 (public IP)", () => expect(isBlockedHost("8.8.8.8")).toBe(false));
  it("does NOT block 172.15.x.x (not in RFC-1918)", () => expect(isBlockedHost("172.15.0.1")).toBe(false));
  it("does NOT block 172.32.x.x (not in RFC-1918)", () => expect(isBlockedHost("172.32.0.1")).toBe(false));
});

// ---------------------------------------------------------------------------
// SSRF protection — webFetch returns error without network I/O
// ---------------------------------------------------------------------------
describe("webFetch — SSRF protection", () => {
  it("blocks localhost", async () => {
    const r = await webFetch("http://localhost:3000", { workspaceRoot: WORKSPACE, saveArtifact: false });
    expect(r.error).toMatch(/SSRF/i);
    expect(r.markdown).toBe("");
  });

  it("blocks 127.0.0.1", async () => {
    const r = await webFetch("http://127.0.0.1/secret", { workspaceRoot: WORKSPACE, saveArtifact: false });
    expect(r.error).toMatch(/SSRF/i);
  });

  it("blocks 192.168.1.1", async () => {
    const r = await webFetch("http://192.168.1.1/admin", { workspaceRoot: WORKSPACE, saveArtifact: false });
    expect(r.error).toMatch(/SSRF/i);
  });

  it("blocks 10.0.0.1", async () => {
    const r = await webFetch("http://10.0.0.1", { workspaceRoot: WORKSPACE, saveArtifact: false });
    expect(r.error).toMatch(/SSRF/i);
  });

  it("blocks 169.254.169.254 (metadata service)", async () => {
    const r = await webFetch("http://169.254.169.254/latest/meta-data/", { workspaceRoot: WORKSPACE, saveArtifact: false });
    expect(r.error).toMatch(/SSRF/i);
  });
});

// ---------------------------------------------------------------------------
// Invalid URL handling
// ---------------------------------------------------------------------------
describe("webFetch — invalid URL", () => {
  it("returns error for non-URL string", async () => {
    const r = await webFetch("not-a-url", { workspaceRoot: WORKSPACE, saveArtifact: false });
    expect(r.error).toBeTruthy();
    expect(r.markdown).toBe("");
    expect(r.wordCount).toBe(0);
  });

  it("returns error for empty string", async () => {
    const r = await webFetch("", { workspaceRoot: WORKSPACE, saveArtifact: false });
    expect(r.error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// FetchResult shape
// ---------------------------------------------------------------------------
describe("webFetch — FetchResult shape", () => {
  it("blocked result has all required fields", async () => {
    const r = await webFetch("http://127.0.0.1", { workspaceRoot: WORKSPACE, saveArtifact: false });
    expect(typeof r.url).toBe("string");
    expect(typeof r.title).toBe("string");
    expect(typeof r.markdown).toBe("string");
    expect(typeof r.wordCount).toBe("number");
    expect(typeof r.fetchedAt).toBe("number");
    expect(typeof r.cached).toBe("boolean");
    expect(r.cached).toBe(false);
    expect(r.error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// htmlToMarkdown unit tests (pure function, no I/O)
// ---------------------------------------------------------------------------
describe("htmlToMarkdown", () => {
  it("extracts title from <title> tag", () => {
    const { title } = htmlToMarkdown("<html><head><title>Hello World</title></head><body></body></html>", "https://example.com");
    expect(title).toBe("Hello World");
  });

  it("falls back to hostname when no title", () => {
    const { title } = htmlToMarkdown("<html><body></body></html>", "https://example.com/page");
    expect(title).toBe("example.com");
  });

  it("converts <h1> to # heading", () => {
    const { markdown } = htmlToMarkdown("<h1>Main Heading</h1>", "https://example.com");
    expect(markdown).toContain("# Main Heading");
  });

  it("converts <h2> to ## heading", () => {
    const { markdown } = htmlToMarkdown("<h2>Section</h2>", "https://example.com");
    expect(markdown).toContain("## Section");
  });

  it("strips <script> tags", () => {
    const { markdown } = htmlToMarkdown('<script>alert("xss")</script><p>Clean</p>', "https://example.com");
    expect(markdown).not.toContain("alert");
    expect(markdown).toContain("Clean");
  });

  it("strips <style> tags", () => {
    const { markdown } = htmlToMarkdown("<style>.foo { color: red; }</style><p>Text</p>", "https://example.com");
    expect(markdown).not.toContain(".foo");
    expect(markdown).toContain("Text");
  });

  it("strips <nav> boilerplate", () => {
    const { markdown } = htmlToMarkdown("<nav>Menu Links Here</nav><p>Content</p>", "https://example.com");
    expect(markdown).not.toContain("Menu Links Here");
    expect(markdown).toContain("Content");
  });

  it("converts <strong> to **bold**", () => {
    const { markdown } = htmlToMarkdown("<strong>Bold</strong>", "https://example.com");
    expect(markdown).toContain("**Bold**");
  });

  it("converts <em> to *italic*", () => {
    const { markdown } = htmlToMarkdown("<em>Italic</em>", "https://example.com");
    expect(markdown).toContain("*Italic*");
  });

  it("converts <code> to `inline code`", () => {
    const { markdown } = htmlToMarkdown("<code>myFunction()</code>", "https://example.com");
    expect(markdown).toContain("`myFunction()`");
  });

  it("converts <a> to [text](url)", () => {
    const { markdown } = htmlToMarkdown('<a href="https://example.com">Link</a>', "https://example.com");
    expect(markdown).toContain("[Link](https://example.com)");
  });

  it("converts <li> items to - list items", () => {
    const { markdown } = htmlToMarkdown("<ul><li>Item one</li><li>Item two</li></ul>", "https://example.com");
    expect(markdown).toContain("- Item one");
    expect(markdown).toContain("- Item two");
  });

  it("decodes HTML entities", () => {
    const { markdown } = htmlToMarkdown("<p>AT&amp;T &lt;Corp&gt; &quot;Q1&quot;</p>", "https://example.com");
    expect(markdown).toContain("AT&T");
    expect(markdown).toContain("<Corp>");
    expect(markdown).toContain('"Q1"');
  });

  it("includes source URL in output", () => {
    const { markdown } = htmlToMarkdown("<p>Hello</p>", "https://example.com/page");
    expect(markdown).toContain("Source: https://example.com/page");
  });

  it("collapses multiple blank lines", () => {
    const { markdown } = htmlToMarkdown("<p>A</p>\n\n\n\n<p>B</p>", "https://example.com");
    expect(markdown).not.toMatch(/\n{4,}/);
  });
});
