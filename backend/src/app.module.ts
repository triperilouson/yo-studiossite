import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { Environment } from './config/env';
import { HealthModule } from './health/health.module';
import { OrdersModule } from './orders/orders.module';
import { ProductsModule } from './products/products.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CartModule } from './cart/cart.module';
import { PaymentsModule } from './payments/payments.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AppConfigModule } from './config/config.module';
import { CommonModule } from './common/common.module';
import { generateCorrelationId } from './common/logging/correlation-id.hook';
import { AdminSecurityModule } from './admin-security/admin-security.module';
import { SeasonsModule } from './seasons/seasons.module';
import { ShippingModule } from './shipping/shipping.module';
import { GameEditorModule } from './game-editor/game-editor.module';

@Module({
  imports: [
    AppConfigModule,
    CommonModule,
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL', { infer: true }),
          genReqId: generateCorrelationId,
          redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'],
        },
      }),
    }),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 120 },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    HealthModule,
    ProductsModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
    AdminSecurityModule,
    SeasonsModule,
    ShippingModule,
    GameEditorModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
