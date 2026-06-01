import { ThrottlerModuleOptions } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';

export const createThrottlerOptions = (): ThrottlerModuleOptions => {
  const redis = new Redis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: +(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    keyPrefix: 'throttle:',
    lazyConnect: true,
    maxRetriesPerRequest: 0, // Fail fast thay vì đợi 20 retries mỗi request
    enableOfflineQueue: false, // Reject command ngay khi offline, không queue
    retryStrategy: (times) => Math.min(times * 500, 5000), // Vẫn reconnect ngầm
  });

  // Không thông báo lỗi do đã được resilientGuard xử lý
  redis.on('error', () => {});

  return {
    throttlers: [{ name: 'global', ttl: 60_000, limit: 60 }],
    storage: new ThrottlerStorageRedisService(redis),
    // Tạo key dễ đọc khi debug: IP + METHOD + path
    generateKey: (context, tracker, throttlerName) => {
      const req = context.switchToHttp().getRequest();
      const route = req.route?.path ?? req.url;
      return `${tracker}:${req.method}:${route}:${throttlerName}`;
    },
  };
};
