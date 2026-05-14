import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Color, ColorDocument } from './schemas/color.schema';
import { RedisService } from '../redis/redis.service';

const COLORS_ALL_KEY = 'colors:all';
const COLORS_ALL_TTL = 86400; // 24 giờ

@Injectable()
export class ColorsService {
  constructor(
    @InjectModel(Color.name) private readonly colorModel: Model<ColorDocument>,
    private readonly redis: RedisService,
  ) {}

  async findAll() {
    return this.redis.cacheable(COLORS_ALL_KEY, COLORS_ALL_TTL, () =>
      this.colorModel.find().sort({ name: 1 }).lean(),
    );
  }
}
