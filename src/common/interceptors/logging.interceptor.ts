import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap, catchError } from 'rxjs';
import { throwError } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const method = request.method;
    const url = request.url;
    const ip = request.ip;

    return next.handle().pipe(
      tap(() => {
        const statusCode = response.statusCode;
        const responseTime = Date.now() - now;

        this.logger.log(
          `${method} ${url} ${statusCode} - ${responseTime}ms - IP: ${ip}`,
        );
      }),
      catchError((err) => {
        const statusCode = response.statusCode;
        const responseTime = Date.now() - now;

        this.logger.error(
          `${method} ${url} ${statusCode} - ${responseTime}ms - IP: ${ip}`,
        );
        return throwError(() => err);
      }),
    );
  }
}
