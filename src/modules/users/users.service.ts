import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async findAll() {
    const users = await this.userModel
      .find({ deletedAt: null })
      .select('email roleId createdAt')
      .populate('roleId');

    return users.map((user) => {
      const userJson = user.toJSON() as Record<string, any>;
      userJson.role = userJson.roleId;
      delete userJson.roleId;
      return userJson;
    });
  }
}
