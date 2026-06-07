# MCP Health Check & Auto-Reconnection System

## Overview

The MCP Client now includes a professional health monitoring and automatic reconnection system that ensures tools are always available.

## Features

### 1. **Automatic Health Checks**
- Runs every **30 seconds** by default
- Monitors:
  - Connected clients count
  - Available tools count
  - Resources availability
- Logs health status to console

### 2. **Smart Auto-Reconnection**
- Triggers when:
  - No clients connected
  - No tools available
  - Missing expected clients
- **Exponential Backoff Strategy**:
  - Initial backoff: 5 seconds
  - Max backoff: 5 minutes
  - Doubles on each failed attempt
- **Max Attempts**: 10 attempts before giving up

### 3. **Event-Driven Monitoring**
The system emits events that you can listen to:

```typescript
mcpClient.on("healthCheck", (status) => {
  console.log("Health:", status);
  // { timestamp, healthy, clients, tools, resources }
});

mcpClient.on("reconnecting", (info) => {
  console.log("Reconnecting:", info);
  // { attempt, maxAttempts, backoff }
});

mcpClient.on("reconnected", (info) => {
  console.log("Reconnected:", info);
  // { clients, tools, resources }
});

mcpClient.on("reconnectionFailed", (info) => {
  console.error("Failed:", info);
  // { attempts, message }
});
```

### 4. **Manual Control**

#### Force Reconnect (Programmatic)
```typescript
await mcpClient.forceReconnect();
```

#### Stop Health Checks
```typescript
mcpClient.stopHealthCheck();
```

## API Endpoints

### Get Health Status
```bash
GET http://localhost:3011/api/chat/mcp/health
```

**Response:**
```json
{
  "healthy": true,
  "timestamp": "2026-01-06T...",
  "clients": {
    "count": 1,
    "names": ["innomcp-server"]
  },
  "tools": {
    "count": 15,
    "total": 15
  },
  "resources": {
    "count": 0
  },
  "cache": {
    "queries": 0,
    "historySize": 0
  },
  "aiMode": "local"
}
```

### Force Manual Reconnection
```bash
POST http://localhost:3011/api/chat/mcp/reconnect
```

**Response:**
```json
{
  "success": true,
  "message": "Reconnection initiated",
  "timestamp": "2026-01-06T..."
}
```

## Configuration

You can customize the health check behavior by modifying these values in `mcpclient.ts`:

```typescript
private healthCheckIntervalMs: number = 30000; // 30 seconds
private maxReconnectAttempts: number = 10;
private reconnectBackoff: number = 5000; // 5 seconds
private maxReconnectBackoff: number = 300000; // 5 minutes
```

## Logs Examples

### Healthy System
```
[MCP Client] 🏥 Health check: 1 clients, 15 tools, 0 resources
```

### Reconnection Triggered
```
[MCP Client] ⚠️  Health check failed - initiating reconnection (attempt 1/10)
[MCP Client] 🔄 Reconnection attempt 1/10 (backoff: 5000ms)
[MCP Client] Attempting to reconnect to 1 servers...
[MCP Client] ✅ Reconnected to innomcp-server
[MCP Client] ✅ Reconnection successful! 15 tools loaded
```

### Max Attempts Reached
```
[MCP Client] ❌ Max reconnection attempts (10) reached. Manual intervention required.
```

## Graceful Shutdown

The system properly cleans up when the server shuts down:

```bash
# Press Ctrl+C
SIGINT signal received: closing HTTP server and cleaning up
MCP health check stopped
HTTP server closed
```

## Troubleshooting

### Tools Not Loading After Restart

1. **Check MCP Server is Running**
   ```bash
   # Check if innomcp-server-node is running on port 3012
   curl http://localhost:3012/mcp
   ```

2. **Check Health Status**
   ```bash
   curl http://localhost:3011/api/chat/mcp/health
   ```

3. **Force Manual Reconnection**
   ```bash
   curl -X POST http://localhost:3011/api/chat/mcp/reconnect
   ```

4. **Check Logs**
   Look for these patterns in logs:
   - `[MCP Client] 🏥 Health check:` - Regular health status
   - `[MCP Client] 🔄 Reconnection attempt` - Auto-reconnection in progress
   - `[MCP Client] ✅ Reconnected` - Success
   - `[MCP Client] ❌ Failed` - Errors

### Common Issues

**Issue**: "Max reconnection attempts reached"
- **Solution**: Check if MCP server (innomcp-server-node) is running and accessible
- **Action**: Start MCP server and call manual reconnect API

**Issue**: "No tools available" but clients connected
- **Solution**: MCP server may have started without tools
- **Action**: Restart MCP server and wait for auto-reconnection

**Issue**: Health checks too frequent/slow
- **Solution**: Adjust `healthCheckIntervalMs` in code (default: 30 seconds)
- **Recommendation**: Keep between 10-60 seconds for best balance

## Benefits

✅ **Zero Downtime**: Automatically recovers from MCP server restarts  
✅ **Smart Retry**: Exponential backoff prevents overwhelming the server  
✅ **Observable**: Rich event system and API endpoints for monitoring  
✅ **Manual Control**: Force reconnect when needed  
✅ **Production Ready**: Proper cleanup and graceful shutdown  

## Technical Details

- **Language**: TypeScript
- **Event System**: Node.js EventEmitter
- **Transport**: StreamableHTTPClientTransport (HTTP-based MCP)
- **Retry Strategy**: Exponential backoff with jitter
- **Thread Safety**: Single-threaded with async/await patterns

## Version History

- **v1.0** (2026-01-06): Initial implementation with auto-reconnection and health monitoring
