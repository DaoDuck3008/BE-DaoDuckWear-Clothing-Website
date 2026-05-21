import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
  ServiceUnavailableException,
} from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject('REDIS_CLIENT') private readonly client: Redis) {}

  async onApplicationBootstrap() {
    const host = this.client.options.host;
    const port = this.client.options.port;
    const start = Date.now();
    try {
      // lazyConnect: true nên phải gọi connect() tường minh trước khi ra lệnh
      await this.client.connect();
      const pong = await this.client.ping();
      const ms = Date.now() - start;
      if (pong === 'PONG') {
        this.logger.log(`[Redis] Connected to ${host}:${port} (PING ${ms}ms)`);
      } else {
        this.logger.warn(
          `[Redis] Unexpected PING response from ${host}:${port}: ${pong}`,
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[Redis] Failed to connect to ${host}:${port} — ${message}`,
      );
    }
  }

  async onApplicationShutdown() {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } catch (err) {
      this.logger.error(`[Redis] set failed for "${key}": ${(err as Error).message}`);
      throw new ServiceUnavailableException('Hệ thống gặp sự cố, vui lòng thử lại sau');
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (err) {
      this.logger.error(`[Redis] get failed for "${key}": ${(err as Error).message}`);
      throw new ServiceUnavailableException('Hệ thống gặp sự cố, vui lòng thử lại sau');
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    try {
      await this.client.del(...keys);
    } catch (err) {
      this.logger.warn(`[Redis] del failed for "${keys.join(', ')}": ${(err as Error).message}`);
    }
  }

  // Hàm này dùng để lấy dữ liệu từ cache, nếu cache bị hỏng thì xoá để tránh poison
  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T; // Kiểu dữ liệu T là kiểu dữ liệu mà user truyền vào
    } catch {
      // Cache bị hỏng thì xoá để tránh poison
      await this.client.del(key);
      return null;
    }
  }

  // Hàm này dùng để lưu dữ liệu vào cache
  async setJson<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  // Hàm này dùng để lấy dữ liệu từ cache, nếu cache bị hỏng thì xoá để tránh poison
  // Nếu Redis lỗi, vẫn fallback gọi loader để không làm sập request.
  async cacheable<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    try {
      const cached = await this.getJson<T>(key);
      if (cached !== null) return cached;
    } catch (err) {
      this.logger.warn(
        `[Redis] cacheable GET failed for "${key}": ${(err as Error).message}`,
      );
    }

    const fresh = await loader();
    try {
      await this.setJson(key, fresh, ttlSeconds);
    } catch (err) {
      this.logger.warn(
        `[Redis] cacheable SET failed for "${key}": ${(err as Error).message}`,
      );
    }
    return fresh;
  }

  // Xoá tất cả key có cùng prefix, dùng SCAN để không block Redis.
  async delByPrefix(prefix: string): Promise<number> {
    const pattern = `${prefix}*`;
    let cursor = '0';
    let total = 0;
    try {
      do {
        const [next, keys] = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          200,
        );
        cursor = next;
        if (keys.length > 0) {
          total += await this.client.del(...keys);
        }
      } while (cursor !== '0');
    } catch (err) {
      this.logger.warn(`[Redis] delByPrefix failed for "${prefix}": ${(err as Error).message}`);
    }
    return total;
  }
}
