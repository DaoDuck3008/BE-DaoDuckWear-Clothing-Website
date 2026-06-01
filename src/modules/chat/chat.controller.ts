import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ChatService, ChatUser } from './chat.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { isChatStaffRole } from './chat.constants';

@Controller('chat')
@UseGuards(AuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // Khách mở/tiếp tục hội thoại với một cửa hàng
  @Post('conversations')
  async createConversation(
    @CurrentUser() user: ChatUser,
    @Body() dto: CreateConversationDto,
  ) {
    return this.chatService.getOrCreateConversation(user.id, dto.shopId);
  }

  // Danh sách hội thoại: nhân viên (MANAGER/RECEPTIONIST) thấy của chi nhánh mình,
  // khách thấy của mình.
  @Get('conversations')
  async listConversations(@CurrentUser() user: ChatUser) {
    if (isChatStaffRole(user.role)) {
      if (!user.shopId) return [];
      return this.chatService.listForShop(user.shopId);
    }
    return this.chatService.listForCustomer(user.id);
  }

  @Get('conversations/:id/messages')
  async getMessages(@Param('id') id: string, @CurrentUser() user: ChatUser) {
    return this.chatService.getMessages(id, user);
  }
}
