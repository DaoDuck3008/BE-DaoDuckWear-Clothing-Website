import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const isProd = configService.get<string>('NODE_ENV') === 'production';

  // MIDDLEWARE
  app.use(cookieParser());
  app.use(
    helmet({
      contentSecurityPolicy: false, // CSP được config ở frontend (next.config.ts)
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // Cho phép browser load ảnh Cloudinary
      strictTransportSecurity: isProd
        ? { maxAge: 31536000, includeSubDomains: true }
        : false,
    }),
  );

  // Bật CORS
  app.enableCors({
    origin: [
      configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, // Cho phép gửi cookie
  });

  // GLOBAL CONFIG
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new LoggingInterceptor()); // Bật LoggingInterceptor
  app.useGlobalFilters(new HttpExceptionFilter(configService)); // Bật HttpExceptionFilter

  app.enableShutdownHooks(); // Cho phép onApplicationShutdown() chạy (Như đóng kết nối Redis)

  const port = configService.get<number>('PORT') ?? 5000;
  await app.listen(port);
  console.log(`Backend is running on: http://localhost:${port}`);
}
bootstrap();
