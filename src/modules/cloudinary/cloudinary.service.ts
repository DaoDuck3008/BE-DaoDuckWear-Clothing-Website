import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { ConfigService } from '@nestjs/config';
import 'multer'; // Load type Express.Multer.File

@Injectable()
export class CloudinaryService {
  constructor(private readonly configService: ConfigService) {}

  private async uploadImage(
    file: Express.Multer.File,
    folder: string,
    public_id: string,
  ): Promise<any> {
    const rootFolder = this.configService.get<string>(
      'CLOUDINARY_ROOT_FOLDER_IMAGES',
    );
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: `${rootFolder}/${folder}`,
            resource_type: 'image',
            public_id: public_id,
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          },
        )
        .end(file.buffer);
    });
  }

  private async destroyImage(folder: string, public_id: string): Promise<any> {
    const rootFolder = this.configService.get<string>(
      'CLOUDINARY_ROOT_FOLDER_IMAGES',
    );
    return new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(
        `${rootFolder}/${folder}/${public_id}`,
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );
    });
  }

  private async destroyImages(
    folder: string,
    public_ids: string[],
  ): Promise<any> {
    if (!public_ids || public_ids.length === 0) return;

    const rootFolder = this.configService.get<string>(
      'CLOUDINARY_ROOT_FOLDER_IMAGES',
    );
    const full_public_ids = public_ids.map(
      (id) => `${rootFolder}/${folder}/${id}`,
    );

    return new Promise((resolve, reject) => {
      cloudinary.api.delete_resources(full_public_ids, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
    });
  }

  public async uploadProductImages(files: Express.Multer.File[], slug: string) {
    if (!files || files.length === 0) return [];

    const uploadPromises = files.map(async (file, i) => {
      const fieldname = Buffer.from(file.fieldname, 'latin1').toString(
        'utf8',
      ); // Lấy tên file từ form-data. Đổi kiểu latin1 -> utf8 để tránh lỗi tiếng Việt

      let color: string | null = null;
      let isMain = false;

      // file ảnh gửi về thường có fieldname dạng color:RED_0, color:RED_1, common_0, common_1,...

      if (fieldname.startsWith('color:')) {
        // Nếu tên file bắt đầu bằng 'color:', tức là ảnh có màu
        const parts = fieldname.split(':'); // Tách chuỗi dựa trên ký tự ':'
        const colorPart = parts[1].split('_')[0]; // Tách chuỗi dựa trên ký tự '_', lấy phần tử đầu tiên
        color = colorPart; // Gán màu cho biến color
        if (fieldname.endsWith('_0')) isMain = true; // Nếu tên file kết thúc bằng '_0', tức là ảnh chính
      } else if (fieldname.startsWith('common_')) {
        // Nếu tên file bắt đầu bằng 'common_', tức là ảnh chung
        if (fieldname === 'common_0') isMain = true; // Nếu tên file kết thúc bằng '_0', tức là ảnh chính
      }

      // Đặt tên public_id có cấu trúc: slug/loai_mau_timestamp_index
      const typePrefix = color ? `color_${color.toLowerCase()}` : 'common';
      const publicId = `${slug}/${typePrefix}_${Date.now()}_${i}`;

      const uploadRes = await this.uploadImage(file, 'products', publicId);

      return {
        url: uploadRes.secure_url,
        publicId: uploadRes.public_id,
        color: color?.toUpperCase(),
        isMain,
        isThumbnail: file.fieldname === 'common_0',
      };
    });

    return await Promise.all(uploadPromises);
  }

  public async uploadBannerImage(
    file: Express.Multer.File,
    type: 'desktop' | 'mobile',
  ): Promise<{ url: string; publicId: string }> {
    // public_id: banner_desktop_<timestamp> hoặc banner_mobile_<timestamp>
    const publicId = `banner_${type}_${Date.now()}`;
    const result = await this.uploadImage(file, 'banners', publicId);
    return { url: result.secure_url, publicId: result.public_id };
  }

  public async uploadAvatarImage(
    file: Express.Multer.File,
    userId: string,
  ): Promise<{ url: string; publicId: string }> {
    const publicId = `avatar_${userId}_${Date.now()}`;
    const result = await this.uploadImage(file, 'avatars', publicId);
    return { url: result.secure_url, publicId: result.public_id };
  }

  public async deleteBannerImage(fullPublicId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(fullPublicId, (error) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }
}
