import { Global, Module } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { AdminAuditService } from './admin-audit.service';

@Global()
@Module({
  providers: [JwtAuthGuard, RolesGuard, AdminAuditService],
  exports: [JwtAuthGuard, RolesGuard, AdminAuditService],
})
export class CommonModule {}
