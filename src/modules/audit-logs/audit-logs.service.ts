import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';

export interface CreateAuditLogInput {
  userId?: string | Types.ObjectId | null;
  action: string;
  entityName: string;
  entityId?: string | Types.ObjectId | null;
  oldData?: Record<string, any> | null;
  newData?: Record<string, any> | null;
}

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>,
  ) {}

  async log(input: CreateAuditLogInput): Promise<void> {
    try {
      await this.auditLogModel.create(input);
    } catch {
      // Không để lỗi audit log làm crash luồng chính
    }
  }

  async findAll(query: QueryAuditLogDto) {
    const page = Math.max(1, parseInt(query.page || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(query.limit || '20')));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    if (query.userId && Types.ObjectId.isValid(query.userId)) {
      filter.userId = new Types.ObjectId(query.userId);
    }

    if (query.action) {
      filter.action = { $regex: query.action, $options: 'i' };
    }

    if (query.entityName) {
      filter.entityName = query.entityName;
    }

    if (query.entityId && Types.ObjectId.isValid(query.entityId)) {
      filter.entityId = new Types.ObjectId(query.entityId);
    }

    if (query.startDate || query.endDate) {
      filter.createdAt = {};
      if (query.startDate) {
        filter.createdAt.$gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const [data, totalItems] = await Promise.all([
      this.auditLogModel
        .find(filter)
        .populate('userId', 'username email avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.auditLogModel.countDocuments(filter),
    ]);

    return {
      data,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      page,
      limit,
    };
  }

  async findOne(id: string) {
    return this.auditLogModel
      .findById(id)
      .populate('userId', 'username email avatar')
      .lean();
  }
}
