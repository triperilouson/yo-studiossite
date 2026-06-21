import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import type { FastifyPluginCallback } from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import type { Environment } from './config/env';
import { correlationIdHook, generateCorrelationId } from './common/logging/correlation-id.hook';
import { setupSwagger } from './docs/swagger';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

interface ApiHelmetOptions {
  contentSecurityPolicy: boolean;
  crossOriginResourcePolicy: { policy: 'same-site' };
}

async function bootstrap(): Promise<void> {
  const trustProxy = process.env.TRUST_PROXY === 'true';
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy, bodyLimit: 1_048_576, genReqId: generateCorrelationId }),
    { bufferLogs: true, rawBody: true },
  );

  const config = app.get(ConfigService<Environment, true>);
  const allowedOrigins = config
    .get('CORS_ORIGINS', { infer: true })
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const helmetPlugin = helmet as unknown as FastifyPluginCallback<ApiHelmetOptions>;
  const cookiePlugin = cookie as unknown as FastifyPluginCallback;
  await app.register(helmetPlugin, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-site' },
  });
  await app.register(cookiePlugin);
  app.getHttpAdapter().getInstance().addHook('onRequest', correlationIdHook);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'],
    maxAge: 600,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      stopAtFirstError: false,
    }),
  );
  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });
  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new HttpExceptionFilter(app.get(Logger)));
  if (
    config.get('NODE_ENV', { infer: true }) === 'development' &&
    config.get('ENABLE_SWAGGER', { infer: true }) === 'true'
  ) setupSwagger(app);
  app.enableShutdownHooks();

  await app.listen({
    port: config.get('PORT', { infer: true }),
    host: '0.0.0.0',
  });
}

void bootstrap();
