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
  const origins =
    process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()).filter(Boolean) ??
    [];
  app.enableCors({
    origin: origins.length ? origins : ['http://localhost:3000'],
    credentials: true,
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
  await app.listen(port);
}
bootstrap();
