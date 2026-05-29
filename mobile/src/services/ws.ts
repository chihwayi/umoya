import * as SecureStore from 'expo-secure-store';

type MessageHandler = (data: unknown) => void;

interface WsClient {
  send: (data: unknown) => void;
  close: () => void;
}

export function createWsClient(
  wsBase: string,
  path: string,
  onMessage: MessageHandler,
  onError?: (e: Event) => void
): WsClient {
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const connect = async () => {
    if (closed) return;
    const [jwt, tenantRaw] = await Promise.all([
      SecureStore.getItemAsync('umoya_jwt'),
      SecureStore.getItemAsync('umoya_tenant'),
    ]);
    const tenant = tenantRaw ? JSON.parse(tenantRaw) : null;
    const slug = tenant?.slug ?? '';
    const url = `${wsBase}${path}?tenant=${slug}&token=${jwt ?? ''}`;

    ws = new WebSocket(url);

    ws.onmessage = (e) => {
      try { onMessage(JSON.parse(e.data)); } catch { /* non-JSON frame */ }
    };

    ws.onerror = (e) => { onError?.(e); };

    ws.onclose = () => {
      if (!closed) {
        reconnectTimer = setTimeout(connect, 3000);
      }
    };
  };

  connect();

  return {
    send: (data) => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
      }
    },
    close: () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    },
  };
}
