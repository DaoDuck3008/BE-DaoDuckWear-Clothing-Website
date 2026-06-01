import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Banner, BannerDocument } from './schemas/banner.schema';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { RedisService } from '../redis/redis.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

const BANNERS_PREFIX = 'banners:';
const BANNERS_TTL = 600; // 10 phút

@Injectable()
export class BannersService {
  constructor(
    @InjectModel(Banner.name)
    private readonly bannerModel: Model<BannerDocument>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly redis: RedisService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async findAll(query: {
    page?: string;
    position?: string;
    isActive?: boolean;
  }) {
    const filter: Record<string, any> = { deletedAt: null };

    if (query.page) filter.page = query.page;
    if (query.position) filter.position = query.position;
    if (query.isActive !== undefined) filter.isActive = query.isActive;

    const loader = () =>
      this.bannerModel
        .find(filter)
        .sort({ sortOrder: 1, createdAt: -1 })
        .lean();

    // Chỉ cache request storefront (isActive=true). Admin gọi với
    // isActive=undefined hoặc false → đi thẳng DB để luôn thấy data mới nhất.
    if (query.isActive !== true) return loader();

    const key = `${BANNERS_PREFIX}${query.page ?? '_'}:${query.position ?? '_'}:active`;
    return this.redis.cacheable(key, BANNERS_TTL, loader);
  }

  private async invalidateBannersCache() {
    await this.redis.delByPrefix(BANNERS_PREFIX);
  }

  async findOne(id: string) {
    const banner = await this.bannerModel
      .findOne({ _id: id, deletedAt: null })
      .lean();
    if (!banner) throw new NotFoundException('Không tìm thấy banner');
    return banner;
  }

  async create(
    dto: CreateBannerDto,
    files: {
      image?: Express.Multer.File[];
      mobileImage?: Express.Multer.File[];
    },
    actingUserId?: string,
  ) {
    const imageFile = files.image?.[0];
    if (!imageFile) throw new BadRequestException('Ảnh banner là bắt buộc');

    const { url: imageUrl, publicId } =
      await this.cloudinaryService.uploadBannerImage(imageFile, 'desktop');

    let mobileImageUrl: string | null = null;
    let mobilePublicId: string | null = null;

    const mobileFile = files.mobileImage?.[0];
    if (mobileFile) {
      const res = await this.cloudinaryService.uploadBannerImage(
        mobileFile,
        'mobile',
      );
      mobileImageUrl = res.url;
      mobilePublicId = res.publicId;
    }

    const banner = await this.bannerModel.create({
      ...dto,
      imageUrl,
      publicId,
      mobileImageUrl,
      mobilePublicId,
    });

    await this.invalidateBannersCache();

    void this.auditLogsService.log({
      userId: actingUserId,
      action: 'CREATE_BANNER',
      entityName: 'Banner',
      entityId: banner._id,
      newData: {
        title: (banner as any).title,
        page: (banner as any).page,
        position: (banner as any).position,
        isActive: (banner as any).isActive,
      },
    });

    return banner.toJSON();
  }

  async update(
    id: string,
    dto: UpdateBannerDto,
    files: {
      image?: Express.Multer.File[];
      mobileImage?: Express.Multer.File[];
    },
    actingUserId?: string,
  ) {
    const banner = await this.bannerModel.findOne({ _id: id, deletedAt: null });
    if (!banner) throw new NotFoundException('Không tìm thấy banner');

    const updateData: Record<string, any> = { ...dto };

    const imageFile = files.image?.[0];
    if (imageFile) {
      if (banner.publicId) {
        await this.cloudinaryService.deleteBannerImage(banner.publicId);
      }
      const { url, publicId } = await this.cloudinaryService.uploadBannerImage(
        imageFile,
        'desktop',
      );
      updateData.imageUrl = url;
      updateData.publicId = publicId;
    }

    const mobileFile = files.mobileImage?.[0];
    if (mobileFile) {
      if (banner.mobilePublicId) {
        await this.cloudinaryService.deleteBannerImage(banner.mobilePublicId);
      }
      const { url, publicId } = await this.cloudinaryService.uploadBannerImage(
        mobileFile,
        'mobile',
      );
      updateData.mobileImageUrl = url;
      updateData.mobilePublicId = publicId;
    }

    const updated = await this.bannerModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .lean();
    await this.invalidateBannersCache();

    void this.auditLogsService.log({
      userId: actingUserId,
      action: 'UPDATE_BANNER',
      entityName: 'Banner',
      entityId: id,
      newData: updateData,
    });

    return updated;
  }

  async remove(id: string, actingUserId?: string) {
    const banner = await this.bannerModel.findOne({ _id: id, deletedAt: null });
    if (!banner) throw new NotFoundException('Không tìm thấy banner');
    await this.bannerModel.findByIdAndUpdate(id, { deletedAt: new Date() });
    await this.invalidateBannersCache();

    void this.auditLogsService.log({
      userId: actingUserId,
      action: 'DELETE_BANNER',
      entityName: 'Banner',
      entityId: id,
      oldData: { title: (banner as any).title },
    });
  }

  async toggleStatus(id: string, actingUserId?: string) {
    const banner = await this.bannerModel.findOne({ _id: id, deletedAt: null });
    if (!banner) throw new NotFoundException('Không tìm thấy banner');
    const updated = await this.bannerModel
      .findByIdAndUpdate(id, { isActive: !banner.isActive }, { new: true })
      .lean();
    await this.invalidateBannersCache();

    void this.auditLogsService.log({
      userId: actingUserId,
      action: 'TOGGLE_BANNER_STATUS',
      entityName: 'Banner',
      entityId: id,
      oldData: { isActive: banner.isActive },
      newData: { isActive: !banner.isActive },
    });

    return updated;
  }
}
