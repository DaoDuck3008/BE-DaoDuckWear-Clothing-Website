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

@Injectable()
export class BannersService {
  constructor(
    @InjectModel(Banner.name)
    private readonly bannerModel: Model<BannerDocument>,
    private readonly cloudinaryService: CloudinaryService,
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

    return this.bannerModel
      .find(filter)
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean();
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

    return banner.toJSON();
  }

  async update(
    id: string,
    dto: UpdateBannerDto,
    files: {
      image?: Express.Multer.File[];
      mobileImage?: Express.Multer.File[];
    },
  ) {
    const banner = await this.bannerModel.findOne({ _id: id, deletedAt: null });
    if (!banner) throw new NotFoundException('Không tìm thấy banner');

    const updateData: Record<string, any> = { ...dto };

    const imageFile = files.image?.[0];
    if (imageFile) {
      if (banner.publicId) {
        await this.cloudinaryService.deleteBannerImage(banner.publicId);
      }
      const { url, publicId } =
        await this.cloudinaryService.uploadBannerImage(imageFile, 'desktop');
      updateData.imageUrl = url;
      updateData.publicId = publicId;
    }

    const mobileFile = files.mobileImage?.[0];
    if (mobileFile) {
      if (banner.mobilePublicId) {
        await this.cloudinaryService.deleteBannerImage(banner.mobilePublicId);
      }
      const { url, publicId } =
        await this.cloudinaryService.uploadBannerImage(mobileFile, 'mobile');
      updateData.mobileImageUrl = url;
      updateData.mobilePublicId = publicId;
    }

    return this.bannerModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .lean();
  }

  async remove(id: string) {
    const banner = await this.bannerModel.findOne({ _id: id, deletedAt: null });
    if (!banner) throw new NotFoundException('Không tìm thấy banner');
    await this.bannerModel.findByIdAndUpdate(id, { deletedAt: new Date() });
  }

  async toggleStatus(id: string) {
    const banner = await this.bannerModel.findOne({ _id: id, deletedAt: null });
    if (!banner) throw new NotFoundException('Không tìm thấy banner');
    return this.bannerModel
      .findByIdAndUpdate(id, { isActive: !banner.isActive }, { new: true })
      .lean();
  }
}
