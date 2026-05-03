import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './core/filters/global-exception.filter';
import { SerializeInterceptor } from './core/interceptors/serialize.interceptor';
import { normalizeCredential } from './auth/utils/env-credentials';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const adminId = normalizeCredential(process.env.SUPER_ADMIN_ID);
  const adminPw = normalizeCredential(process.env.SUPER_ADMIN_PASSWORD);
  if (!adminId || !adminPw) {
    logger.warn(
      'SUPER_ADMIN_ID and/or SUPER_ADMIN_PASSWORD missing — super admin login is disabled until both are set on the server.',
    );
  } else {
    logger.log('Super admin login is configured.');
  }

  const app = await NestFactory.create(AppModule);

  /**
   * CORS: Previously we defaulted to localhost only when CORS_ORIGIN was unset,
   * which blocked Vercel → Render and looked like a generic "network error".
   */
  const origins =
    process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()).filter(Boolean) ??
    [];

  let corsOrigin: boolean | string[];
  if (origins.includes('*')) {
    corsOrigin = true;
  } else if (origins.length > 0) {
    corsOrigin = origins;
  } else if (process.env.NODE_ENV === 'production') {
    logger.warn(
      'CORS_ORIGIN not set — allowing reflected Origin (Vercel + Render). Set CORS_ORIGIN=https://your-app.vercel.app to restrict callers.',
    );
    corsOrigin = true;
  } else {
    corsOrigin = ['http://localhost:3000'];
  }

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new SerializeInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  const port = Number(process.env.PORT) || 5000;
  await app.listen(port, '0.0.0.0');
}
bootstrap();
