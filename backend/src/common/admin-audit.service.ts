import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(
    actorId: string,
    action: string,
    entityType: string,
    entityId?: string,
    metadata?: Record<string, string | number | boolean | null>,
  ): Promise<void> {
    try {
      await this.prisma.adminAuditLog.create({
        data: {
          actorId, action, entityType,
          ...(entityId ? { entityId } : {}),
          ...(metadata ? { metadata } : {}),
        },
      });
    } catch (error: unknown) {
      this.logger.error({ error, actorId, action, entityType, entityId }, 'Failed to write admin audit event');
    }
  }
}
