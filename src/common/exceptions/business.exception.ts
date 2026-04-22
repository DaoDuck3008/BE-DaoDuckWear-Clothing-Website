import { HttpException, HttpStatus } from '@nestjs/common';

export class BusinessException extends HttpException {
  constructor(
    message: string,
    errorCode: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super(
      {
        message: message,
        errorCode: errorCode,
        statusCode: statusCode,
      },
      statusCode,
    );
  }
}
