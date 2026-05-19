import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Review, ReviewDocument } from './schemas/review.schema';
import { Order, OrderDocument, OrderStatus } from '../orders/schemas/order.schema';
import { CreateReviewDto, UpdateReviewDto } from './dto/review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
  ) {}

  async getProductReviews(productId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const filter = { productId: new Types.ObjectId(productId), deletedAt: null };

    const [reviews, total] = await Promise.all([
      this.reviewModel
        .find(filter)
        .populate('userId', 'username avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.reviewModel.countDocuments(filter),
    ]);

    return {
      reviews,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getProductRatingStats(productId: string) {
    const result = await this.reviewModel.aggregate([
      {
        $match: {
          productId: new Types.ObjectId(productId),
          deletedAt: null,
          rating: { $ne: null },
        },
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalCount: { $sum: 1 },
          dist1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
          dist2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
          dist3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
          dist4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
          dist5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
        },
      },
    ]);

    if (!result.length) {
      return {
        averageRating: 0,
        totalCount: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
    }

    const { averageRating, totalCount, dist1, dist2, dist3, dist4, dist5 } = result[0];
    return {
      averageRating: Math.round(averageRating * 10) / 10,
      totalCount,
      distribution: { 1: dist1, 2: dist2, 3: dist3, 4: dist4, 5: dist5 },
    };
  }

  async createReview(userId: string, dto: CreateReviewDto) {
    const { productId, rating, comment } = dto;

    const hasPurchased = await this.orderModel.exists({
      userId: new Types.ObjectId(userId),
      'items.productId': new Types.ObjectId(productId),
      status: OrderStatus.COMPLETED,
    });

    if (!hasPurchased) {
      throw new ForbiddenException('Bạn cần mua và hoàn thành đơn hàng sản phẩm này trước khi đánh giá');
    }

    const existing = await this.reviewModel.findOne({
      userId: new Types.ObjectId(userId),
      productId: new Types.ObjectId(productId),
      deletedAt: null,
    });

    if (existing) {
      throw new ConflictException('Bạn đã đánh giá sản phẩm này rồi');
    }

    const review = await this.reviewModel.create({
      userId: new Types.ObjectId(userId),
      productId: new Types.ObjectId(productId),
      rating,
      comment: comment || null,
    });

    return (await review.populate('userId', 'username avatar')).toObject();
  }

  async updateReview(userId: string, reviewId: string, dto: UpdateReviewDto) {
    const review = await this.reviewModel.findOne({
      _id: new Types.ObjectId(reviewId),
      deletedAt: null,
    });

    if (!review) {
      throw new NotFoundException('Không tìm thấy đánh giá');
    }

    if (review.userId?.toString() !== userId) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa đánh giá này');
    }

    if (dto.rating !== undefined) review.rating = dto.rating;
    if (dto.comment !== undefined) review.comment = dto.comment;
    await review.save();

    return (await review.populate('userId', 'username avatar')).toObject();
  }

  async getMyReview(userId: string, productId: string) {
    return (
      (await this.reviewModel
        .findOne({
          userId: new Types.ObjectId(userId),
          productId: new Types.ObjectId(productId),
          deletedAt: null,
        })
        .lean()) ?? null
    );
  }

  async deleteReview(userId: string, reviewId: string) {
    const review = await this.reviewModel.findOne({
      _id: new Types.ObjectId(reviewId),
      deletedAt: null,
    });

    if (!review) {
      throw new NotFoundException('Không tìm thấy đánh giá');
    }

    if (review.userId?.toString() !== userId) {
      throw new ForbiddenException('Bạn không có quyền xóa đánh giá này');
    }

    review.deletedAt = new Date();
    await review.save();
    return { message: 'Đã xóa đánh giá thành công' };
  }
}
