import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import {
  hashPassword,
  comparePassword,
} from '../../common/utils/password.util';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../common/utils/jwt.util';
import { User } from '../users/schemas/user.schema';
import { Role } from '../roles/schemas/role.schema';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<any>,
    @InjectModel(Role.name) private readonly roleModel: Model<any>,
  ) {}

  async register(body: RegisterDto) {
    const { email, username, password } = body;

    const existingUser = await this.userModel
      .findOne({ $or: [{ email }, { username }] })
      .lean();

    if (existingUser) {
      throw new UnauthorizedException('Email hoặc username đã tồn tại');
    }

    const hashedPassword = await hashPassword(password);
    const role = await this.roleModel.findOne({ name: 'USER' });

    if (!role) {
      throw new NotFoundException('Không tìm thấy vai trò USER');
    }

    const userCreated = await this.userModel.create({
      email,
      username,
      password: hashedPassword,
      roleId: role._id,
    });

    return {
      ...userCreated.toJSON(),
      role: role.toJSON(),
    };
  }

  async login(body: LoginDto) {
    const { email, password } = body;

    const user = await this.userModel.findOne({ email }).populate('roleId');

    if (!user) {
      throw new NotFoundException('Email hoặc mật khẩu không chính xác');
    }

    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    const role = user.roleId as any;
    if (!role) {
      throw new UnauthorizedException('Tài khoản chưa được gán vai trò');
    }

    const accessToken = signAccessToken({ id: user.id, role: role.name });
    const refreshToken = signRefreshToken({ id: user.id, role: role.name });

    return {
      user: {
        ...user.toJSON(),
        role: role.toJSON(),
      },
      accessToken,
      refreshToken,
    };
  }

  async refresh(refreshToken: string) {
    const decodedToken = verifyRefreshToken(refreshToken);
    const user = await this.userModel
      .findById(decodedToken.id)
      .populate('roleId');

    if (!user) {
      throw new UnauthorizedException('Không tìm thấy tài khoản');
    }

    const role = user.roleId as any;
    if (!role) {
      throw new UnauthorizedException('Tài khoản chưa được gán vai trò');
    }

    const accessToken = signAccessToken({ id: user.id, role: role.name });
    const newRefreshToken = signRefreshToken({ id: user.id, role: role.name });

    return {
      user: {
        ...user.toJSON(),
        role: role.toJSON(),
      },
      accessToken,
      refreshToken: newRefreshToken,
    };
  }
}
