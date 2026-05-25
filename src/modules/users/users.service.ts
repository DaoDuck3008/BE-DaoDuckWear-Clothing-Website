import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomBytes } from 'crypto';
import { User, UserDocument } from './schemas/user.schema';
import { Role, RoleDocument } from '../roles/schemas/role.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { MailService } from '../mail/mail.service';
import { hashPassword } from '../../common/utils/password.util';
import {
  CreateStaffDto,
  ListStaffQueryDto,
  STAFF_ROLES,
  StaffRoleName,
  UpdateStaffDto,
} from './dto/staff.dto';
import { ListCustomerQueryDto } from './dto/customer.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

interface AuthUser {
  id: string;
  role: string;
  shopId: string | null;
}

const STAFF_PASSWORD_LEN = 10;

const generateRandomPassword = (length = STAFF_PASSWORD_LEN) => {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += charset[bytes[i] % charset.length];
  }
  return out;
};

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly mailService: MailService,
    private readonly auditLogsService: AuditLogsService,
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

  private async getStaffRoleMap() {
    const roles = await this.roleModel.find({
      name: { $in: STAFF_ROLES as unknown as string[] },
    });
    const byName = new Map<string, RoleDocument>();
    const byId = new Map<string, RoleDocument>();
    for (const r of roles) {
      byName.set(r.name, r);
      byId.set(r._id.toString(), r);
    }
    return { byName, byId, allIds: roles.map((r) => r._id) };
  }

  // Cho phép xem chi tiết: ADMIN xem mọi user; MANAGER chỉ xem MANAGER/STAFF trong shop của mình.
  private assertCanViewStaff(
    actor: AuthUser,
    targetRole: StaffRoleName,
    targetShopId: string | null,
  ) {
    if (actor.role === 'ADMIN') return;
    if (actor.role === 'MANAGER') {
      if (targetRole === 'ADMIN') {
        throw new ForbiddenException('Bạn không có quyền xem thông tin ADMIN');
      }
      if (!actor.shopId) {
        throw new ForbiddenException(
          'Tài khoản MANAGER chưa được gán chi nhánh',
        );
      }
      if (!targetShopId || targetShopId !== actor.shopId) {
        throw new ForbiddenException(
          'Bạn chỉ có thể xem nhân viên thuộc chi nhánh của mình',
        );
      }
      return;
    }
    throw new ForbiddenException('Bạn không có quyền truy cập');
  }

  // Defense in depth: chỉ ADMIN được thực hiện thao tác ghi. Controller cũng đã chặn bằng @Roles.
  private assertCanWriteStaff(actor: AuthUser) {
    if (actor.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Chỉ ADMIN mới có quyền thực hiện thao tác này',
      );
    }
  }

  private serializeStaff(user: any) {
    const role = user.roleId as any;
    const shop = user.shopId as any;
    return {
      id: user._id?.toString?.() ?? user.id,
      username: user.username,
      email: user.email,
      role: role
        ? { id: role._id?.toString?.() ?? role.id, name: role.name }
        : null,
      shop: shop
        ? { id: shop._id?.toString?.() ?? shop.id, name: shop.name }
        : null,
      fullName: user.fullName ?? null,
      dateOfBirth: user.dateOfBirth ?? null,
      gender: user.gender ?? null,
      nationalId: user.nationalId ?? null,
      phone: user.phone ?? null,
      hometown: user.hometown ?? null,
      permanentAddress: user.permanentAddress ?? null,
      currentAddress: user.currentAddress ?? null,
      hireDate: user.hireDate ?? null,
      employmentStatus: user.employmentStatus ?? null,
      position: user.position ?? null,
      provider: user.provider,
      isVerified: user.isVerified,
      avatar: user.avatar ?? null,
      createdAt: user.createdAt,
    };
  }

  async findAllStaff(query: ListStaffQueryDto, actor: AuthUser) {
    const { byName, allIds } = await this.getStaffRoleMap();

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 10));

    const filter: Record<string, any> = { deletedAt: null };

    let roleIdsScope: Types.ObjectId[] = allIds;

    if (actor.role === 'MANAGER') {
      if (!actor.shopId) {
        throw new ForbiddenException(
          'Tài khoản MANAGER chưa được gán chi nhánh',
        );
      }
      // MANAGER chỉ thấy MANAGER + STAFF trong chính shop của họ
      roleIdsScope = (['MANAGER', 'STAFF'] as StaffRoleName[])
        .map((n) => byName.get(n)?._id)
        .filter(Boolean) as Types.ObjectId[];
      filter.shopId = new Types.ObjectId(actor.shopId);

      if (query.shopId && query.shopId !== actor.shopId) {
        throw new ForbiddenException(
          'Bạn chỉ có thể xem nhân viên thuộc chi nhánh của mình',
        );
      }
      if (query.role === 'ADMIN') {
        throw new ForbiddenException('Bạn không có quyền xem danh sách ADMIN');
      }
    } else if (actor.role === 'ADMIN') {
      if (query.shopId) {
        filter.shopId = new Types.ObjectId(query.shopId);
      }
    } else {
      throw new ForbiddenException('Bạn không có quyền truy cập');
    }

    if (query.role) {
      const roleDoc = byName.get(query.role);
      if (!roleDoc) {
        throw new BadRequestException('Vai trò không tồn tại');
      }
      // Nếu là MANAGER, query.role chỉ có thể là MANAGER/STAFF (đã chặn ADMIN ở trên)
      filter.roleId = roleDoc._id;
    } else {
      filter.roleId = { $in: roleIdsScope };
    }

    if (query.search?.trim()) {
      const q = query.search.trim();
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { username: regex },
        { email: regex },
        { fullName: regex },
        { phone: regex },
        { nationalId: regex },
      ];
    }

    const [items, total] = await Promise.all([
      this.userModel
        .find(filter)
        .populate('roleId', 'name _id')
        .populate('shopId', 'name _id')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.userModel.countDocuments(filter),
    ]);

    return {
      data: items.map((u) => this.serializeStaff(u)),
      total,
      page,
      limit,
    };
  }

  async findStaffById(id: string, actor: AuthUser) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Mã nhân viên không hợp lệ');
    }

    const user = await this.userModel
      .findOne({ _id: id, deletedAt: null })
      .populate('roleId', 'name _id')
      .populate('shopId', 'name _id')
      .lean();

    if (!user) {
      throw new NotFoundException('Không tìm thấy nhân viên');
    }

    const role = (user.roleId as any)?.name as StaffRoleName | undefined;
    if (!role || !STAFF_ROLES.includes(role)) {
      throw new NotFoundException('Không tìm thấy nhân viên');
    }

    const shopId = (user.shopId as any)?._id?.toString?.() ?? null;
    this.assertCanViewStaff(actor, role, shopId);

    return this.serializeStaff(user);
  }

  async createStaff(dto: CreateStaffDto, actor: AuthUser) {
    this.assertCanWriteStaff(actor);

    const { byName } = await this.getStaffRoleMap();

    const targetRole: StaffRoleName = dto.role;
    let targetShopId: string | null = dto.shopId ?? null;

    if (targetRole === 'ADMIN') {
      targetShopId = null;
    } else if (!targetShopId) {
      throw new BadRequestException('Vui lòng chọn chi nhánh cho nhân viên');
    }

    const roleDoc = byName.get(targetRole);
    if (!roleDoc) {
      throw new NotFoundException('Vai trò không tồn tại');
    }

    const conflict = await this.userModel
      .findOne({
        $or: [{ email: dto.email.toLowerCase() }, { username: dto.username }],
      })
      .lean();
    if (conflict) {
      throw new ConflictException('Email hoặc tên đăng nhập đã tồn tại');
    }

    const plainPassword = generateRandomPassword();
    const hashed = await hashPassword(plainPassword);

    const created = await this.userModel.create({
      username: dto.username,
      email: dto.email.toLowerCase(),
      password: hashed,
      provider: 'local',
      roleId: roleDoc._id,
      shopId: targetShopId ? new Types.ObjectId(targetShopId) : null,
      isVerified: true,
      fullName: dto.fullName ?? null,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
      gender: dto.gender ?? null,
      nationalId: dto.nationalId ?? null,
      phone: dto.phone ?? null,
      hometown: dto.hometown ?? null,
      permanentAddress: dto.permanentAddress ?? null,
      currentAddress: dto.currentAddress ?? null,
      hireDate: dto.hireDate ? new Date(dto.hireDate) : null,
      employmentStatus: dto.employmentStatus ?? 'active',
      position: dto.position ?? null,
    });

    // Gửi mail không chặn flow chính nếu lỗi SMTP
    this.mailService
      .sendStaffWelcomeEmail(created.email, created.username, plainPassword)
      .catch((err) => {
        console.error('[staff welcome mail] failed:', err?.message ?? err);
      });

    const populated = await this.userModel
      .findById(created._id)
      .populate('roleId', 'name _id')
      .populate('shopId', 'name _id')
      .lean();

    void this.auditLogsService.log({
      userId: actor.id,
      action: 'CREATE_STAFF',
      entityName: 'User',
      entityId: created._id,
      newData: { username: created.username, email: created.email, role: dto.role, shopId: dto.shopId ?? null },
    });

    return this.serializeStaff(populated);
  }

  async updateStaff(id: string, dto: UpdateStaffDto, actor: AuthUser) {
    this.assertCanWriteStaff(actor);

    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Mã nhân viên không hợp lệ');
    }

    const target = await this.userModel
      .findOne({ _id: id, deletedAt: null })
      .populate('roleId', 'name _id')
      .populate('shopId', 'name _id');

    if (!target) {
      throw new NotFoundException('Không tìm thấy nhân viên');
    }

    const currentRole = (target.roleId as any)?.name as StaffRoleName;

    const { byName } = await this.getStaffRoleMap();
    const updates: Record<string, any> = {};

    if (dto.username !== undefined && dto.username !== target.username) {
      const conflict = await this.userModel
        .findOne({ username: dto.username, _id: { $ne: target._id } })
        .lean();
      if (conflict) {
        throw new ConflictException('Tên đăng nhập đã tồn tại');
      }
      updates.username = dto.username;
    }

    // Cập nhật role
    if (dto.role && dto.role !== currentRole) {
      const newRoleDoc = byName.get(dto.role);
      if (!newRoleDoc) {
        throw new BadRequestException('Vai trò không tồn tại');
      }
      updates.roleId = newRoleDoc._id;

      if (dto.role === 'ADMIN') {
        updates.shopId = null;
      }
    }

    // Cập nhật shopId
    if (dto.shopId !== undefined) {
      const finalRole = (updates.roleId && dto.role) || currentRole;
      if (finalRole === 'ADMIN') {
        updates.shopId = null;
      } else {
        if (!dto.shopId) {
          throw new BadRequestException(
            'Vui lòng chọn chi nhánh cho nhân viên',
          );
        }
        updates.shopId = new Types.ObjectId(dto.shopId);
      }
    }

    // Profile fields
    const profileFields: Array<keyof UpdateStaffDto> = [
      'fullName',
      'gender',
      'nationalId',
      'phone',
      'hometown',
      'permanentAddress',
      'currentAddress',
      'employmentStatus',
      'position',
    ];
    for (const f of profileFields) {
      if (dto[f] !== undefined) {
        updates[f] = dto[f] === '' ? null : dto[f];
      }
    }
    if (dto.dateOfBirth !== undefined) {
      updates.dateOfBirth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : null;
    }
    if (dto.hireDate !== undefined) {
      updates.hireDate = dto.hireDate ? new Date(dto.hireDate) : null;
    }

    if (Object.keys(updates).length === 0) {
      return this.serializeStaff(target.toJSON());
    }

    const updated = await this.userModel
      .findByIdAndUpdate(target._id, { $set: updates }, { new: true })
      .populate('roleId', 'name _id')
      .populate('shopId', 'name _id')
      .lean();

    void this.auditLogsService.log({
      userId: actor.id,
      action: 'UPDATE_STAFF',
      entityName: 'User',
      entityId: target._id,
      oldData: { username: target.username, role: (target.roleId as any)?.name, shopId: (target.shopId as any)?._id?.toString?.() ?? null },
      newData: updates,
    });

    return this.serializeStaff(updated);
  }

  async removeStaff(id: string, actor: AuthUser) {
    this.assertCanWriteStaff(actor);

    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Mã nhân viên không hợp lệ');
    }
    if (id === actor.id) {
      throw new BadRequestException('Bạn không thể tự xóa tài khoản của mình');
    }

    const target = await this.userModel.findOne({
      _id: id,
      deletedAt: null,
    });

    if (!target) {
      throw new NotFoundException('Không tìm thấy nhân viên');
    }

    await this.userModel.findByIdAndUpdate(target._id, {
      $set: { deletedAt: new Date() },
    });

    void this.auditLogsService.log({
      userId: actor.id,
      action: 'DELETE_STAFF',
      entityName: 'User',
      entityId: target._id,
      oldData: { username: target.username, email: target.email },
    });

    return { success: true };
  }

  async resetStaffPassword(id: string, actor: AuthUser) {
    this.assertCanWriteStaff(actor);

    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Mã nhân viên không hợp lệ');
    }

    const target = await this.userModel.findOne({
      _id: id,
      deletedAt: null,
    });

    if (!target) {
      throw new NotFoundException('Không tìm thấy nhân viên');
    }

    if (target.provider !== 'local') {
      throw new BadRequestException(
        'Không thể đặt lại mật khẩu cho tài khoản đăng nhập bằng nhà cung cấp bên ngoài',
      );
    }

    const newPassword = generateRandomPassword();
    const hashed = await hashPassword(newPassword);

    await this.userModel.findByIdAndUpdate(target._id, {
      $set: { password: hashed },
    });

    this.mailService
      .sendStaffResetByAdminEmail(target.email, target.username, newPassword)
      .catch((err) => {
        console.error('[staff reset mail] failed:', err?.message ?? err);
      });

    void this.auditLogsService.log({
      userId: actor.id,
      action: 'RESET_STAFF_PASSWORD',
      entityName: 'User',
      entityId: target._id,
      newData: { email: target.email, username: target.username },
    });

    return { success: true };
  }

  // ======================== CUSTOMER METHODS ========================

  private async getCustomerRoleId(): Promise<Types.ObjectId> {
    const role = await this.roleModel.findOne({ name: 'USER' }).lean();
    if (!role) {
      throw new NotFoundException('Không tìm thấy vai trò USER');
    }
    return role._id;
  }

  private serializeCustomer(user: any) {
    return {
      id: user._id?.toString?.() ?? user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar ?? null,
      provider: user.provider,
      isVerified: !!user.isVerified,
      isLocked: !!user.isLocked,
      addresses: (user.addresses ?? [])
        .filter((a: any) => !a.deletedAt)
        .map((a: any) => ({
          id: a._id?.toString?.() ?? '',
          address: a.address,
          phone: a.phone ?? null,
        })),
      createdAt: user.createdAt,
    };
  }

  async findAllCustomers(query: ListCustomerQueryDto) {
    const userRoleId = await this.getCustomerRoleId();

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 10));

    const filter: Record<string, any> = {
      deletedAt: null,
      roleId: userRoleId,
    };

    if (query.provider) {
      filter.provider = query.provider;
    }
    if (query.isVerified === '1' || query.isVerified === '0') {
      filter.isVerified = query.isVerified === '1';
    }
    if (query.isLocked === '1' || query.isLocked === '0') {
      filter.isLocked = query.isLocked === '1';
    }

    if (query.search?.trim()) {
      const q = query.search.trim();
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { username: regex },
        { email: regex },
        { 'addresses.phone': regex },
      ];
    }

    const [items, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select(
          'username email avatar provider isVerified isLocked addresses createdAt',
        )
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.userModel.countDocuments(filter),
    ]);

    return {
      data: items.map((u) => this.serializeCustomer(u)),
      total,
      page,
      limit,
    };
  }

  async findCustomerById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Mã khách hàng không hợp lệ');
    }

    const userRoleId = await this.getCustomerRoleId();
    const user = await this.userModel
      .findOne({ _id: id, roleId: userRoleId, deletedAt: null })
      .select(
        'username email avatar provider isVerified isLocked addresses createdAt',
      )
      .lean();

    if (!user) {
      throw new NotFoundException('Không tìm thấy khách hàng');
    }

    return this.serializeCustomer(user);
  }

  async findCustomerOrders(
    id: string,
    page = 1,
    limit = 5,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Mã khách hàng không hợp lệ');
    }

    // Đảm bảo user tồn tại & là khách hàng
    const userRoleId = await this.getCustomerRoleId();
    const exists = await this.userModel
      .exists({ _id: id, roleId: userRoleId, deletedAt: null });
    if (!exists) {
      throw new NotFoundException('Không tìm thấy khách hàng');
    }

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));

    const filter = {
      userId: new Types.ObjectId(id),
      deletedAt: null,
    };

    const [items, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .select(
          'orderCode finalTotal status paymentStatus paymentMethod createdAt items',
        )
        .sort({ createdAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .lean(),
      this.orderModel.countDocuments(filter),
    ]);

    return {
      data: items.map((o: any) => ({
        id: o._id.toString(),
        orderCode: o.orderCode,
        finalTotal: o.finalTotal,
        status: o.status,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        createdAt: o.createdAt,
        itemCount: Array.isArray(o.items) ? o.items.length : 0,
      })),
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  async setCustomerLock(id: string, locked: boolean, actingUserId?: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Mã khách hàng không hợp lệ');
    }

    const userRoleId = await this.getCustomerRoleId();
    const updated = await this.userModel
      .findOneAndUpdate(
        { _id: id, roleId: userRoleId, deletedAt: null },
        { $set: { isLocked: locked } },
        { new: true },
      )
      .select(
        'username email avatar provider isVerified isLocked addresses createdAt',
      )
      .lean();

    if (!updated) {
      throw new NotFoundException('Không tìm thấy khách hàng');
    }

    void this.auditLogsService.log({
      userId: actingUserId,
      action: locked ? 'LOCK_CUSTOMER' : 'UNLOCK_CUSTOMER',
      entityName: 'User',
      entityId: updated._id,
      oldData: { isLocked: !locked },
      newData: { isLocked: locked },
    });

    return this.serializeCustomer(updated);
  }
}
