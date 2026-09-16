import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';

/**
 * All six WebSocket gateways previously accepted any connection with zero
 * authentication and trusted client-supplied userId/tenantId/patientId
 * fields straight out of the message payload — meaning anyone who could
 * reach the socket port could receive real-time PHI broadcasts (critical
 * alerts, inbox items, ambient transcripts), or write real data
 * (ambient:action recording an accepted diagnosis/order) by simply naming
 * a target tenantId/sessionId in their payload. This verifies the same JWT
 * REST endpoints require, using the same secret (JwtModule.register in
 * ehr.module.ts), and returns the verified identity — callers must use
 * THIS, never a client-supplied id, for tenant resolution and room scoping.
 */
export interface WsUser {
  id: string;
  tenantId: string;
  role: string;
  email?: string;
}

export function extractWsToken(client: Socket): string | undefined {
  const authToken = client.handshake.auth?.token as string | undefined;
  if (authToken) return authToken;
  const header = client.handshake.headers?.authorization;
  if (typeof header === 'string' && header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim();
  }
  const queryToken = client.handshake.query?.token;
  if (typeof queryToken === 'string') return queryToken;
  return undefined;
}

/**
 * Verifies the socket's JWT and returns the identity, or null (and
 * disconnects the socket) if missing/invalid. Call from handleConnection.
 */
export function authenticateSocket(client: Socket, jwtService: JwtService): WsUser | null {
  const token = extractWsToken(client);
  if (!token) {
    client.disconnect(true);
    return null;
  }
  try {
    const payload = jwtService.verify(token);
    if (!payload?.sub || !payload?.tenantId) {
      client.disconnect(true);
      return null;
    }
    const user: WsUser = {
      id: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
      email: payload.email,
    };
    (client.data as any).user = user;
    return user;
  } catch {
    client.disconnect(true);
    return null;
  }
}

export function getWsUser(client: Socket): WsUser | undefined {
  return (client.data as any)?.user;
}
