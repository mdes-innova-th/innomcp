<!-- cc-team deliverable
 group: P4C (Phase 4.3 â€” Wire AgentStepsView to real dispatch events)
 member: P4C-5 role=dev model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":67,"completion_tokens":3203,"total_tokens":3270,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2747,"image_tokens":0},"cache_creation_input_tokens":0} | 60s
 generated: 2026-06-12T03:45:22.397Z -->
import { useState, useEffect, useCallback } from 'react';

export interface AgentStep {
  id?: string;
  type?: string;
  content?: string;
  timestamp?: number;
  [key: string]: unknown;
}

interface SocketLike {
  on: (event: string, callback: (...args: any[]) => void) => void;
  off: (event: string, callback: (...args: any[]) => void) => void;
  connected?: boolean;
}

interface UseAgentStepsProps {
  socket: SocketLike | null | undefined;
}

interface UseAgentStepsReturn {
  steps: AgentStep[];
  clearSteps: () => void;
  isActive: boolean;
}

export function useAgentSteps({ socket }: UseAgentStepsProps): UseAgentStepsReturn {
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [isActive, setIsActive] = useState<boolean>(false);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleAgentStep = (step: AgentStep) => {
      setIsActive(true);
      setSteps((prevSteps) => [...prevSteps, step]);
    };

    const handleAgentComplete = () => {
      setIsActive(false);
    };

    socket.on('agent_step', handleAgentStep);
    socket.on('agent_done', handleAgentComplete);
    socket.on('agent_complete', handleAgentComplete);
    socket.on('agent_error', handleAgentComplete);

    return () => {
      socket.off('agent_step', handleAgentStep);
      socket.off('agent_done', handleAgentComplete);
      socket.off('agent_complete', handleAgentComplete);
      socket.off('agent_error', handleAgentComplete);
    };
  }, [socket]);

  const clearSteps = useCallback(() => {
    setSteps([]);
    setIsActive(false);
  }, []);

  return {
    steps,
    clearSteps,
    isActive,
  };
}
