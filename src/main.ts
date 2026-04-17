import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // MIDDLEWARE

  // Bật CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, // Cho phép gửi cookie
  });

  app.use(cookieParser());

  app.useGlobalInterceptors(new LoggingInterceptor()); // Bật LoggingInterceptor

  app.useGlobalFilters(new HttpExceptionFilter(configService)); // Bật HttpExceptionFilter

  await app.listen(configService.get<number>('PORT') ?? 5000);
}
bootstrap();
