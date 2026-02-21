'use client';

import { useEffect, useRef, useCallback } from 'react';
import { isStateMessage, serializeSetRpm, serializeReplay, ReplayPayload } from '@/lib/protocol';
import { useTwinStore } from '@/store/twinStore';

const WS_URL = 'ws://localhost:3001';
const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 8000;

export function useTwinSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelay = useRef(RECONNECT_BASE_MS);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const pushSample = useTwinStore((s) => s.pushSample);
  const setConnected = useTwinStore((s) => s.setConnected);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectDelay.current = RECONNECT_BASE_MS;
      setConnected(true);
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (isStateMessage(msg)) {
          pushSample(msg.payload);
        }
      } catch {
        // Malformed message; ignore
      }
    };

    ws.onclose = () => {
      setConnected(false);
      scheduleReconnect();
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [pushSample, setConnected]);

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return;
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);

    reconnectTimer.current = setTimeout(() => {
      reconnectDelay.current = Math.min(reconnectDelay.current * 2, RECONNECT_MAX_MS);
      connect();
    }, reconnectDelay.current);
  }, [connect]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendSetRpm = useCallback((rpm: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(serializeSetRpm(rpm));
    }
  }, []);

  const sendReplay = useCallback((mode: ReplayPayload['mode'], tMs?: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(serializeReplay(mode, tMs));
    }
  }, []);

  return { sendSetRpm, sendReplay };
}
