import { randomUUID } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

export function correlationIdHook(
  request: FastifyRequest,
  reply: FastifyReply,
  done: () => void,
): void {
  request.headers['x-correlation-id'] = request.id;
  reply.header('x-correlation-id', request.id);
  done();
}

export function generateCorrelationId(request: { headers: Record<string, unknown> }): string {
  const supplied = request.headers['x-correlation-id'];
  return typeof supplied === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(supplied)
    ? supplied
    : randomUUID();
}
