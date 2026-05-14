import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  RegisterDto,
  LoginDto,
  UpdateProfileDto,
  ChangePasswordDto,
} from './dto/auth.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { MailService } from '../mail/mail.service';
import { RedisService } from '../redis/redis.service';
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
import { OAuth2Client } from 'google-auth-library';

const VERIFY_TTL = 600; // 10 phút

const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<any>,
    @InjectModel(Role.name) private readonly roleModel: Model<any>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly mailService: MailService,
    private readonly redisService: RedisService,
  ) {}

  private async sendOtp(userId: string, email: string) {
    const code = generateOtp();
    await this.redisService.set(
      `email_verify:user:${userId}`,
      code,
      VERIFY_TTL,
    );
    await this.mailService.sendVerifyEmail(email, code);
  }

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

    const isEmailVerifyEnabled = process.env.IS_VERIFY_EMAIL === 'true';

    const userCreated = await this.userModel.create({
      email,
      username,
      password: hashedPassword,
      roleId: role._id,
      isVerified: !isEmailVerifyEnabled,
    });

    if (isEmailVerifyEnabled) {
      await this.sendOtp(userCreated._id.toString(), email);
    }

    return {
      user: {
        ...userCreated.toJSON(),
        role: role.toJSON(),
      },
      requiresVerification: isEmailVerifyEnabled,
      email,
    };
  }

  async login(body: LoginDto) {
    const { email, password } = body;

    const user = await this.userModel
      .findOne({ email })
      .populate('shopId', 'name _id')
      .populate('roleId', 'name _id');

    if (!user) {
      throw new NotFoundException('Email hoặc mật khẩu không chính xác');
    }

    if (!user.password || user.provider === 'google') {
      throw new UnauthorizedException(
        'Tài khoản của bạn được đăng nhập bởi Google. Hãy sử dụng Google để đăng nhập',
      );
    }

    const isPasswordValid = await comparePassword(password, user.password!);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    if (process.env.IS_VERIFY_EMAIL === 'true' && !user.isVerified) {
      await this.sendOtp(user._id.toString(), user.email);
      return {
        requiresVerification: true,
        email: user.email,
        message:
          'Email chưa được xác thực. Mã xác thực đã được gửi đến hộp thư của bạn',
      };
    }

    if (user.isLocked) {
      throw new UnauthorizedException(
        'Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ quản trị viên',
      );
    }

    const role = user.roleId as any;
    if (!role) {
      throw new UnauthorizedException('Tài khoản chưa được gán vai trò');
    }

    const accessToken = signAccessToken({
      id: user.id,
      role: role.name,
      shopId: user.shopId?.id || null,
    });
    const refreshToken = signRefreshToken({ id: user.id });

    return {
      user: {
        ...user.toJSON(),
        role: role.toJSON(),
      },
      accessToken,
      refreshToken,
    };
  }

  async verifyEmail(email: string, code: string) {
    const user = await this.userModel.findOne({ email }).lean();

    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản với email này');
    }

    const userId = user._id.toString();
    const storedCode = await this.redisService.get(
      `email_verify:user:${userId}`,
    );

    if (!storedCode || storedCode !== code) {
      throw new BadRequestException('Mã xác thực không hợp lệ hoặc đã hết hạn');
    }

    await this.userModel.findByIdAndUpdate(userId, { isVerified: true });
    await this.redisService.del(`email_verify:user:${userId}`);

    return { success: true, message: 'Xác thực email thành công' };
  }

  async forgotPassword(email: string) {
    const user = await this.userModel.findOne({ email }).lean();

    if (!user) {
      return {
        success: true,
        message:
          'Nếu email tồn tại, mã đặt lại mật khẩu sẽ được gửi đến hộp thư của bạn',
      };
    }

    if (user.provider === 'google') {
      throw new BadRequestException(
        'Tài khoản Google không hỗ trợ đặt lại mật khẩu. Hãy đăng nhập bằng Google',
      );
    }

    const userId = user._id.toString();
    const code = generateOtp();
    await this.redisService.set(`pwd_reset:user:${userId}`, code, VERIFY_TTL);
    await this.mailService.sendResetPasswordEmail(email, code);

    return {
      success: true,
      message:
        'Nếu email tồn tại, mã đặt lại mật khẩu sẽ được gửi đến hộp thư của bạn',
    };
  }

  async resetPassword(email: string, code: string, newPassword: string) {
    const user = await this.userModel.findOne({ email }).lean();

    if (!user) {
      throw new BadRequestException('Mã xác thực không hợp lệ hoặc đã hết hạn');
    }

    const userId = user._id.toString();
    const storedCode = await this.redisService.get(`pwd_reset:user:${userId}`);

    if (!storedCode || storedCode !== code) {
      throw new BadRequestException('Mã xác thực không hợp lệ hoặc đã hết hạn');
    }

    const hashedPassword = await hashPassword(newPassword);
    await this.userModel.findByIdAndUpdate(userId, {
      password: hashedPassword,
    });
    await this.redisService.del(`pwd_reset:user:${userId}`);

    return { success: true, message: 'Đặt lại mật khẩu thành công' };
  }

  async resendVerifyEmail(email: string) {
    const user = await this.userModel.findOne({ email });

    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản với email này');
    }

    if (user.isVerified) {
      throw new BadRequestException('Email đã được xác thực trước đó');
    }

    await this.sendOtp(user._id.toString(), email);

    return {
      success: true,
      message: 'Mã xác thực mới đã được gửi đến email của bạn',
    };
  }

  async refresh(refreshToken: string) {
    const decodedToken = verifyRefreshToken(refreshToken);
    const user = await this.userModel
      .findById(decodedToken.id)
      .populate('roleId', 'name _id')
      .populate('shopId', 'name _id');

    if (!user) {
      throw new UnauthorizedException('Không tìm thấy tài khoản');
    }

    if (user.isLocked) {
      throw new UnauthorizedException(
        'Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ quản trị viên',
      );
    }

    const role = user.roleId as any;
    if (!role) {
      throw new UnauthorizedException('Tài khoản chưa được gán vai trò');
    }

    const accessToken = signAccessToken({
      id: user.id,
      role: role.name,
      shopId: user.shopId?.id || null,
    });
    const newRefreshToken = signRefreshToken({ id: user.id });

    return {
      user: {
        ...user.toJSON(),
        role: role.toJSON(),
      },
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  async googleLogin(credential: string) {
    const client = new OAuth2Client(process.env.GOOGLE_OAUTH_CLIENT_ID);

    try {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_OAUTH_CLIENT_ID,
      });
      const payload = ticket.getPayload();

      if (!payload) {
        throw new UnauthorizedException('Google token không hợp lệ');
      }

      const { email, name, picture } = payload;

      let user = await this.userModel
        .findOne({ email, provider: 'google' })
        .populate('roleId', 'name _id')
        .populate('shopId', 'name _id');

      if (!user) {
        const role = await this.roleModel.findOne({ name: 'USER' });
        if (!role) {
          throw new NotFoundException('Không tìm thấy vai trò USER');
        }

        const randomPassword = Math.random().toString(36).slice(-10);
        const hashedPassword = await hashPassword(randomPassword);

        const newUser = await this.userModel.create({
          email,
          username: name || email!.split('@')[0],
          password: hashedPassword,
          roleId: role._id,
          provider: 'google',
          providerId: payload.sub,
          avatar: picture,
          isVerified: true,
        });

        user = await this.userModel
          .findById(newUser._id)
          .populate('roleId', 'name _id')
          .populate('shopId', 'name _id');
      }

      if (user.isLocked) {
        throw new UnauthorizedException(
          'Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ quản trị viên',
        );
      }

      const role = user.roleId as any;
      if (!role) {
        throw new UnauthorizedException('Tài khoản chưa được gán vai trò');
      }

      const accessToken = signAccessToken({
        id: user.id,
        role: role.name,
        shopId: user.shopId?.id || null,
      });
      const refreshToken = signRefreshToken({ id: user.id });

      return {
        user: {
          ...user.toJSON(),
          role: role.toJSON(),
        },
        accessToken,
        refreshToken,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      console.error('Google Auth Error:', error);
      throw new UnauthorizedException('Xác thực Google thất bại');
    }
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');

    if (dto.username !== undefined) {
      const conflict = await this.userModel
        .findOne({ username: dto.username, _id: { $ne: userId } })
        .lean();
      if (conflict) throw new BadRequestException('Tên người dùng đã tồn tại');
    }

    const setFields: Record<string, any> = {};
    if (dto.username !== undefined) setFields.username = dto.username;

    if (dto.phone !== undefined) {
      if (user.addresses && user.addresses.length > 0) {
        setFields['addresses.0.phone'] = dto.phone;
      }
    }

    const updateQuery: Record<string, any> = {};
    if (Object.keys(setFields).length > 0) updateQuery.$set = setFields;
    if (
      dto.phone !== undefined &&
      !(user.addresses && user.addresses.length > 0)
    ) {
      updateQuery.$push = { addresses: { phone: dto.phone, address: '' } };
    }

    const updated = await this.userModel
      .findByIdAndUpdate(userId, updateQuery, { new: true })
      .populate('roleId');

    const role = updated.roleId as any;
    return {
      id: updated._id,
      username: updated.username,
      email: updated.email,
      avatar: updated.avatar || '',
      role: role?.name,
      phone: updated.addresses?.[0]?.phone || '',
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');

    if (user.provider === 'google') {
      throw new BadRequestException('Tài khoản Google không thể đổi mật khẩu');
    }

    // So sánh mật khẩu hiện tại
    const isMatch = await comparePassword(dto.currentPassword, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
    }

    // Hash mật khẩu mới
    const hashed = await hashPassword(dto.newPassword);
    await this.userModel.findByIdAndUpdate(userId, { password: hashed });

    return { success: true, message: 'Đổi mật khẩu thành công' };
  }

  async uploadAvatar(userId: string, file: Express.Multer.File) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');

    const { url } = await this.cloudinaryService.uploadAvatarImage(
      file,
      userId,
    );
    await this.userModel.findByIdAndUpdate(userId, { avatar: url });

    return { avatar: url };
  }

  async getProfile(userId: string) {
    const user = await this.userModel.findById(userId).populate('roleId');

    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }

    const role = user.roleId as any;
    if (!role) {
      throw new UnauthorizedException('Tài khoản chưa được gán vai trò');
    }

    return {
      id: user._id,
      username: user.username,
      fullName: user.username,
      email: user.email,
      role: role.name,
      provider: user.provider || 'local',
      address: user.addresses?.length > 0 ? user.addresses[0].address : '',
      phone: user.addresses?.length > 0 ? user.addresses[0].phone : '',
      createdAt: user.createdAt,
    };
  }
}
