import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../../common/utils/jwt.util';
import { ChatService, ChatUser } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { isChatStaffRole } from './chat.constants';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  },
})
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(private readonly chatService: ChatService) {}

  // Xác thực JWT ngay khi socket kết nối
  handleConnection(socket: Socket) {
    try {
      const token =
        (socket.handshake.auth?.token as string) ||
        (socket.handshake.query?.token as string);

      if (!token) {
        socket.disconnect();
        return;
      }

      const payload = verifyAccessToken(token) as unknown as ChatUser;
      socket.data.user = payload;

      // Nhân viên (lễ tân/quản lý) join room chi nhánh để nhận mọi hội thoại của shop
      if (isChatStaffRole(payload.role) && payload.shopId) {
        socket.join(this.shopRoom(payload.shopId));
      }
    } catch {
      socket.disconnect();
    }
  }

  // Khách (hoặc nhân viên đang mở 1 hội thoại) tham gia room hội thoại cụ thể
  @SubscribeMessage('conversation:join')
  async handleJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { conversationId: string },
  ) {
    const user = socket.data.user as ChatUser;
    if (!user || !body?.conversationId) return;

    const conversation = await this.chatService.findById(body.conversationId);
    if (!conversation) return;

    try {
      this.chatService.assertMembership(conversation, user);
      socket.join(this.conversationRoom(body.conversationId));
    } catch {
      // Không có quyền → bỏ qua
    }
  }

  @SubscribeMessage('message:send')
  async handleSend(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: SendMessageDto,
  ) {
    const user = socket.data.user as ChatUser;
    if (!user) {
      socket.emit('chat:error', { message: 'Phiên đăng nhập không hợp lệ' });
      return;
    }

    try {
      const { message, conversation } = await this.chatService.saveMessage(
        body.conversationId,
        body.content,
        user,
      );

      // Đảm bảo người gửi cũng đang ở trong room hội thoại
      socket.join(this.conversationRoom(body.conversationId));

      this.server
        .to(this.conversationRoom(body.conversationId))
        .to(this.shopRoom(conversation.shopId.toString()))
        .emit('message:new', message);
    } catch (error) {
      this.logger.warn(`message:send failed: ${(error as Error).message}`);
      socket.emit('chat:error', {
        message: (error as Error).message ?? 'Không gửi được tin nhắn',
      });
    }
  }

  private conversationRoom(id: string) {
    return `conversation:${id}`;
  }

  private shopRoom(shopId: string) {
    return `shop:${shopId}`;
  }
}
