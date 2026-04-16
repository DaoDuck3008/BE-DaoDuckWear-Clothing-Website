import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  checkHealth() {
    return {
      status: 'ok',
      message: 'Server is running',
      timestamp: new Date().toISOString(),
    };
  }
}
