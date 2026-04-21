import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { ConfigService } from '@nestjs/config';
import 'multer'; // Load type Express.Multer.File

@Injectable()
export class CloudinaryService {
  constructor(private readonly configService: ConfigService) {}

  async uploadImage(
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

  async destroyImage(folder: string, public_id: string): Promise<any> {
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

  async destroyImages(folder: string, public_ids: string[]): Promise<any> {
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
}
