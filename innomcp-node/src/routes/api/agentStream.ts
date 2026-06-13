import { Router, Request, Response } from 'express';
import { runAgentLoop } from '../../services/agentLoop';
import type { AgentEvent } from '../../services/agentLoop';
import { createRegistry } from '../../tools/registry';

// Mount this router in your express app (app.ts):
//   import agentStreamRouter from './routes/api/agentStream';
//   app.use('/api/agent', agentStreamRouter);

const router = Router();

interface StreamRequestBody {
  task: string;
  projectId?: string;
}

router.post('/stream', async (req: Request, res: Response) => {
  const { task, projectId } = req.body as StreamRequestBody;

  // Validate required input
  if (!task || typeof task !== 'string') {
    res.status(400).json({ error: 'task must be a non-empty string' });
    return;
  }

  // Prepare the tool registry for this execution
  const toolRegistry = createRegistry();

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');  // disable nginx buffering if applicable
  res.flushHeaders();

  // Create an AbortController tied to the client connection
  const abortController = new AbortController();
  let finished = false;

  const onClientClose = () => {
    if (!finished) {
      abortController.abort();
    }
  };
  req.on('close', onClientClose);

  try {
    // Run the agent loop – each event is streamed as an SSE data line
    for await (const event of runAgentLoop({
      task,
      tools: toolRegistry,
      llm: async () => ({ content: 'LLM not implemented' }),
      signal: abortController.signal,
    })) {
      if (req.destroyed) break; // safety net

      const payload = JSON.stringify(event);
      res.write(`data: ${payload}\n\n`);
      // Force flush by sending a meta header (most runtimes will flush after write + newlines)
      // Node.js will flush automatically when the kernel buffer fills, but an explicit flush
      // can be done via res.flush() if compression is off. Not needed in practice.
    }

    // Signal finality
    res.write(`event: done\ndata: {}\n\n`);
    res.end();
  } catch (err: unknown) {
    // If the connection is still alive, send an error event
    if (!res.writableEnded) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.write(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    }
  } finally {
    finished = true;
    req.off('close', onClientClose);
    abortController.abort(); // clean up any pending async work inside the loop
  }
});

export default router;
