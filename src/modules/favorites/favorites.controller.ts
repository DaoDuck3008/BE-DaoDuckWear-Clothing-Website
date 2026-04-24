import { Controller, Get, Post, Delete, Param, UseGuards } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('favorites')
@UseGuards(AuthGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  getFavorites(@CurrentUser('id') userId: string) {
    return this.favoritesService.getFavorites(userId);
  }

  @Post(':productId')
  addFavorite(
    @CurrentUser('id') userId: string,
    @Param('productId') productId: string,
  ) {
    return this.favoritesService.addFavorite(userId, productId);
  }

  @Delete('clear')
  clearFavorites(@CurrentUser('id') userId: string) {
    return this.favoritesService.clearFavorites(userId);
  }

  @Delete(':productId')
  removeFavorite(
    @CurrentUser('id') userId: string,
    @Param('productId') productId: string,
  ) {
    return this.favoritesService.removeFavorite(userId, productId);
  }

  @Get('check/:productId')
  checkIsFavorite(
    @CurrentUser('id') userId: string,
    @Param('productId') productId: string,
  ) {
    return this.favoritesService.checkIsFavorite(userId, productId);
  }
}
