import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Color, ColorDocument } from './schemas/color.schema';

@Injectable()
export class ColorsService {
  constructor(
    @InjectModel(Color.name) private readonly colorModel: Model<ColorDocument>,
  ) {}

  async findAll() {
    return this.colorModel.find().sort({ name: 1 });
  }
}
