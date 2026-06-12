'use client';
import useWSStatus from '../../hooks/useWSStatus';
import WSStatusBanner from './WSStatusBanner';

interface Props { socket: WebSocket | null; }

export default function ChatConnectionStatus({ socket }: Props) {
  const { status, retryCount } = useWSStatus({ socket });
  return <WSStatusBanner status={status} retryCount={retryCount} />;
}
