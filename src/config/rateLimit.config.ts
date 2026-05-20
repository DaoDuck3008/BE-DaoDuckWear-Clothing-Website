import { ThrottlerModuleOptions } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';

export const createThrottlerOptions = (): ThrottlerModuleOptions => ({
  throttlers: [{ name: 'global', ttl: 60_000, limit: 60 }],
  storage: new ThrottlerStorageRedisService({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: +(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    keyPrefix: 'throttle:',
  }),
  // Tạo key dễ đọc khi debug: IP + METHOD + path thay vì MD5 hash
  generateKey: (context, tracker, throttlerName) => {
    const req = context.switchToHttp().getRequest();
    const route = req.route?.path ?? req.url;
    return `${tracker}:${req.method}:${route}:${throttlerName}`;
  },
});
