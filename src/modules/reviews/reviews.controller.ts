import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto, UpdateReviewDto } from './dto/review.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  getProductReviews(
    @Query('productId') productId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    return this.reviewsService.getProductReviews(productId, +page, +limit);
  }

  @Get('stats')
  getProductRatingStats(@Query('productId') productId: string) {
    return this.reviewsService.getProductRatingStats(productId);
  }

  @Get('my-review')
  @UseGuards(AuthGuard)
  getMyReview(@Query('productId') productId: string, @CurrentUser() user: any) {
    return this.reviewsService.getMyReview(user.id, productId);
  }

  @Post()
  @UseGuards(AuthGuard)
  createReview(@Body() dto: CreateReviewDto, @CurrentUser() user: any) {
    return this.reviewsService.createReview(user.id, dto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  updateReview(
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
    @CurrentUser() user: any,
  ) {
    return this.reviewsService.updateReview(user.id, id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  deleteReview(@Param('id') id: string, @CurrentUser() user: any) {
    return this.reviewsService.deleteReview(user.id, id);
  }
}
