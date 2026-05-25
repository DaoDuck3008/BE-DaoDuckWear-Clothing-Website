import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import { BusinessException } from 'src/common/exceptions/business.exception';
import {
  Voucher,
  VoucherDocument,
  DiscountType,
} from '../orders/schemas/voucher.schema';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';
import { ListVouchersDto } from './dto/list-vouchers.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class VouchersService {
  constructor(
    @InjectModel(Voucher.name) private voucherModel: Model<VoucherDocument>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async validateAndPreview(
    code: string,
    orderTotal: number,
    userId: string,
  ): Promise<{ discountAmount: number; message: string }> {
    const voucher = await this.voucherModel
      .findOne({ code: code.toUpperCase().trim() })
      .lean();

    if (!voucher || voucher.deletedAt) {
      throw new BusinessException(
        'Mã giảm giá không tồn tại',
        'VOUCHER_NOT_FOUND',
      );
    }

    if (voucher.expiredAt && new Date() > new Date(voucher.expiredAt)) {
      throw new BusinessException(
        'Mã giảm giá đã hết hạn',
        'VOUCHER_EXPIRED',
      );
    }

    if (
      voucher.usageLimit !== null &&
      voucher.usageLimit !== undefined &&
      voucher.usedCount >= voucher.usageLimit
    ) {
      throw new BusinessException(
        'Mã giảm giá đã được sử dụng hết lượt',
        'VOUCHER_USAGE_LIMIT_REACHED',
      );
    }

    const alreadyUsed = voucher.usedByUsers.some(
      (id) => id.toString() === userId,
    );
    if (alreadyUsed) {
      throw new BusinessException(
        'Bạn đã sử dụng mã giảm giá này rồi',
        'VOUCHER_ALREADY_USED',
      );
    }

    if (
      voucher.minOrderValue !== null &&
      voucher.minOrderValue !== undefined &&
      orderTotal < voucher.minOrderValue
    ) {
      throw new BusinessException(
        `Đơn hàng tối thiểu ${new Intl.NumberFormat('vi-VN').format(voucher.minOrderValue)}₫ để dùng mã này`,
        'VOUCHER_MIN_ORDER_NOT_MET',
      );
    }

    const discountAmount = this.calculateDiscount(voucher, orderTotal);

    return {
      discountAmount,
      message: `Áp dụng thành công, giảm ${new Intl.NumberFormat('vi-VN').format(discountAmount)}₫`,
    };
  }

  async applyVoucher(
    code: string,
    userId: string,
    session: ClientSession,
  ): Promise<void> {
    const result = await this.voucherModel.updateOne(
      {
        code: code.toUpperCase().trim(),
        deletedAt: null,
        usedByUsers: { $ne: new Types.ObjectId(userId) },
        $or: [
          { usageLimit: null },
          { usageLimit: { $exists: false } },
          { $expr: { $lt: ['$usedCount', '$usageLimit'] } },
        ],
      },
      {
        $inc: { usedCount: 1 },
        $addToSet: { usedByUsers: new Types.ObjectId(userId) },
      },
      { session },
    );

    if (result.matchedCount === 0) {
      throw new BusinessException(
        'Mã giảm giá không còn khả dụng (đã hết lượt hoặc bạn đã sử dụng)',
        'VOUCHER_APPLY_FAILED',
      );
    }
  }

  async create(dto: CreateVoucherDto, actingUserId?: string): Promise<VoucherDocument> {
    const existing = await this.voucherModel.findOne({
      code: dto.code,
      deletedAt: null,
    });
    if (existing) {
      throw new ConflictException('Mã voucher đã tồn tại');
    }

    const voucher = await this.voucherModel.create({
      ...dto,
      code: dto.code.toUpperCase().trim(),
      expiredAt: dto.expiredAt ? new Date(dto.expiredAt) : null,
    });
    void this.auditLogsService.log({
      userId: actingUserId,
      action: 'CREATE_VOUCHER',
      entityName: 'Voucher',
      entityId: voucher._id,
      newData: { code: voucher.code, discountType: voucher.discountType, discountValue: voucher.discountValue },
    });
    return voucher;
  }

  async list(query: ListVouchersDto) {
    const { page = '1', limit = '20', search, status } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const now = new Date();

    const filter: any = {};

    if (search) {
      filter.code = { $regex: search.toUpperCase(), $options: 'i' };
    }

    if (status === 'DELETED') {
      filter.deletedAt = { $ne: null };
    } else {
      filter.deletedAt = null;
      if (status === 'EXPIRED') {
        filter.expiredAt = { $lte: now };
      } else if (status === 'USED_UP') {
        filter.$expr = { $gte: ['$usedCount', '$usageLimit'] };
        filter.usageLimit = { $ne: null };
      } else if (status === 'ACTIVE') {
        filter.$and = [
          { $or: [{ expiredAt: null }, { expiredAt: { $gt: now } }] },
          {
            $or: [
              { usageLimit: null },
              { $expr: { $lt: ['$usedCount', '$usageLimit'] } },
            ],
          },
        ];
      }
    }

    const [data, total] = await Promise.all([
      this.voucherModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      this.voucherModel.countDocuments(filter),
    ]);

    return {
      data,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
      totalItems: total,
    };
  }

  async update(id: string, dto: UpdateVoucherDto, actingUserId?: string): Promise<VoucherDocument> {
    const voucher = await this.voucherModel.findOne({ _id: id, deletedAt: null });
    if (!voucher) throw new NotFoundException('Voucher không tồn tại');

    const updateData: any = { ...dto };
    if (dto.expiredAt !== undefined) {
      updateData.expiredAt = dto.expiredAt ? new Date(dto.expiredAt) : null;
    }

    Object.assign(voucher, updateData);
    await voucher.save();
    void this.auditLogsService.log({
      userId: actingUserId,
      action: 'UPDATE_VOUCHER',
      entityName: 'Voucher',
      entityId: voucher._id,
      newData: dto,
    });
    return voucher;
  }

  async softDelete(id: string, actingUserId?: string): Promise<void> {
    const voucher = await this.voucherModel.findOne({ _id: id, deletedAt: null });
    if (!voucher) throw new NotFoundException('Voucher không tồn tại');
    voucher.deletedAt = new Date();
    await voucher.save();
    void this.auditLogsService.log({
      userId: actingUserId,
      action: 'DELETE_VOUCHER',
      entityName: 'Voucher',
      entityId: voucher._id,
      oldData: { code: voucher.code },
    });
  }

  private calculateDiscount(voucher: Voucher, orderTotal: number): number {
    let discount = 0;

    if (voucher.discountType === DiscountType.FIXED) {
      discount = voucher.discountValue;
    } else {
      discount = (orderTotal * voucher.discountValue) / 100;
      if (voucher.maxDiscountAmount) {
        discount = Math.min(discount, voucher.maxDiscountAmount);
      }
    }

    return Math.min(discount, orderTotal);
  }
}
