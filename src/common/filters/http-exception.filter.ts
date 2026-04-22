import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';

/**
 * Filter này dùng để chuẩn hóa mọi phản hồi lỗi của API theo chuẩn RESTful.
 * Giúp Frontend nhận được cấu trúc JSON thống nhất cho mọi loại lỗi.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly configService: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp(); // Lấy context của HTTP request
    const response = ctx.getResponse<Response>(); // Lấy response object
    const request = ctx.getRequest<Request>(); // Lấy request object

    const isDev = this.configService.get<string>('ENV') === 'development';

    // 1. Xác định Status Code (Mặc định 500 nếu lỗi không xác định)
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // 2. Lấy dữ liệu phản hồi thô từ Exception
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    // 3. Khởi tạo các giá trị mặc định cho Response
    let message = 'Máy chủ đang bận, vui lòng thử lại sau!';
    let errors: any = null;
    let errorCode = 'INTERNAL_SERVER_ERROR';

    // 4. Phân tích nội dung Exception để trích xuất Message và Errors chi tiết
    if (typeof exceptionResponse === 'string') {
      // Trường hợp ném lỗi: throw new BadRequestException('Lỗi gì đó');
      message = exceptionResponse;
    } else if (exceptionResponse && typeof exceptionResponse === 'object') {
      const res = exceptionResponse as any;

      // Xử lý lỗi Validation từ ValidationPipe (thường trả về mảng message)
      if (Array.isArray(res.message)) {
        message = 'Validation failed';
        errors = res.message; // Đây là danh sách các lỗi trên từng field
      } else {
        message = res.message || message;
      }

      // Trích xuất errorCode: Ưu tiên mã lỗi tùy chỉnh từ hệ thống
      errorCode = res.errorCode || res.error || errorCode;
    } else if (exception instanceof Error) {
      // Các lỗi runtime thông thường
      message = exception.message;
    }

    // 5. Tạo cấu trúc Body Response chuẩn RESTful
    const responseBody = {
      success: false,
      statusCode: status,
      // Chuẩn hóa code UPPERCASE: "Bad Request" -> "BAD_REQUEST"
      errorCode: errorCode.toString().toUpperCase().replace(/\s+/g, '_'),
      message: message,
      errors: errors, // Trả về danh sách chi tiết (ví dụ validation) hoặc null
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
      method: request.method,
      // Stack trace chỉ quan trọng khi debug, tuyệt đối không trả về ở Production
      stack: isDev ? (exception as any)?.stack : undefined,
    };

    // 6. Ghi log lỗi để dev theo dõi qua terminal/cloud logs
    this.logger.error(
      `${request.method} ${request.originalUrl} ${status} - ${message}`,
      isDev ? (exception as any)?.stack : '',
    );

    // Hiển thị chi tiết lỗi trong môi trường dev
    if (isDev) {
      console.error('--- [RESTFUL API EXCEPTION] ---');
      console.error(exception);
    }

    // 7. Gửi phản hồi JSON về client
    response.status(status).json(responseBody);
  }
}
