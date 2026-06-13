<!-- cc-team deliverable
 group: GA (Concrete fix-proposals for the 4 known innomcp gaps)
 member: GAP-MCP role=gap-fix model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":207,"completion_tokens":2406,"total_tokens":2613,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1086,"image_tokens":0},"cache_creation_input_tokens":0} | 36s
 generated: 2026-06-13T11:10:59.193Z -->
## Root cause
The innova-bot MCP server is never **connected** via an MCP client transport in the agent’s session setup. The tool metadata (`mcp_innovabot_*`) exists in the codex registry, but no live transport sends tool calls to the server – the skeleton tool handler reads static `.planning/*.md` files instead of invoking the server.

## Files/functions to change (best-guess paths)

| File | Function/Block | Purpose |
|------|----------------|---------|
| `innomcp-node/src/mcp/connector.ts` | `connectServers()` or `buildToolMap()` | Where MCP clients are created and tools collected |
| `innomcp-node/src/config/mcp-servers.ts` | export `activeServers` array / `getServers()` | Configure which MCP servers to mount |
| `innomcp-node/src/claude/session.ts` | `createSession()` / tool registration | Bind live tools to the Claude tool-use loop |
| `innomcp-server-node/src/servers/innovabot/index.ts` | (exists; verify export) | MCP server transport config (port, mode) |

*If the server is in-process:*  
- `innomcp-node/src/mcp/in-process-innovabot.ts` – create and register in-process transport.

## Code snippets

### 1. Add innova-bot to the active MCP server list
```typescript
// innomcp-node/src/config/mcp-servers.ts
export const mcpServersConfig: McpServerEntry[] = [
  {
    id: 'innovabot',
    name: 'innovabot',
    transport: {
      type: 'stdio', // or 'sse' if server is already running
      command: 'node',
      args: ['./dist/servers/innovabot/run.js'], // path to server entrypoint
    },
    // Remove fallback flag if present
    fallbackPattern: false, // ensure no .planning fallback
  },
  // ... other servers
];
```

### 2. Connect innova-bot and bind tools in the session
```typescript
// innomcp-node/src/mcp/connector.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mcpServersConfig } from '../config/mcp-servers.js';

export async function connectAllMcpServers(): Promise<Map<string, ToolDescription[]>> {
  const toolMap = new Map<string, ToolDescription[]>();

  for (const entry of mcpServersConfig) {
    if (entry.fallbackPattern) continue; // skip dummy entries

    const transport = buildTransport(entry);
    const client = new Client(
      { name: 'innomcp-node', version: '1.0.0' },
      { capabilities: {} }
    );

    await client.connect(transport);
    const { tools } = await client.listTools();

    // Prefix tool names with mcp_<serverId>_ to match registry
    const prefixedTools = tools.map(t => ({
      ...t,
      name: `mcp_${entry.id}_${t.name}`, // e.g., mcp_innovabot_generate
    }));

    toolMap.set(entry.id, prefixedTools);

    // Store client for later tool execution
    mcpClients.set(entry.id, client);
  }

  return toolMap;
}
```

### 3. Wire live tool execution into Claude's session
```typescript
// innomcp-node/src/claude/session.ts
import { mcpClients } from '../mcp/connector.js';

async function executeToolCall(toolName: string, args: any): Promise<any> {
  // Check if tool belongs to an MCP server
  const parsed = toolName.match(/^mcp_(\w+)_(.+)$/);
  if (!parsed) return fallbackFileReader(toolName, args); // old manual fallback

  const [, serverId, actualToolName] = parsed;
  const client = mcpClients.get(serverId);
  if (!client) throw new Error(`MCP client for ${serverId} not connected`);

  const result = await client.callTool({ name: actualToolName, arguments: args });
  // Return content as text (MCP content types)
  return result.content.map(c => (c.type === 'text' ? c.text : '')).join('\n');
}
```

### 4. Remove/disable the old manual fallback (optional but safe)
```typescript
// innomcp-node/src/claude/session.ts: fallbackFileReader()
// Either delete the fallback import for innova-bot tools, or gate it:
if (!mcpClients.has('innovabot')) {
  // fallback to .planning/loop-peek-*.md
} else {
  // never use fallback – this ensures live tools
}
```

## Verification

1. **Start the innova-bot MCP server** standalone (or confirm it’s already built):  
   `npm -w innomcp-server-node run build && node dist/servers/innovabot/run.js`

2. **Start the agent backend** with the config change:  
   `npm -w innomcp-node run dev`

3. **Check logs** for:
   - *“Connected to MCP server: innovabot”*
   - List of registered tools includes `mcp_innovabot_*`

4. **Smoke test**: Send a Claude message that triggers an innova-bot tool, e.g.:  
   `“Use innovabot to generate a summary of the current plan.”`  
   Observe that:
   - The tool call is executed against the live server (not a .md file)
   - Response contains fresh, computed data
   - No error about missing .planning file

5. **Inspect Claude session trace** (if available) to confirm the tool call backtrace goes to the MCP transport.
