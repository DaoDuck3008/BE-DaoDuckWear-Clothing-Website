import { ForbiddenException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Conversation,
  ConversationDocument,
} from './schemas/conversation.schema';
import { Message, MessageDocument, SenderType } from './schemas/message.schema';
import { isChatStaffRole } from './chat.constants';
import { BusinessException } from '../../common/exceptions/business.exception';

// Payload lấy từ JWT (request.user / socket.data.user)
export interface ChatUser {
  id: string;
  role: string;
  shopId: string | null;
}

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Conversation.name)
    private conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name)
    private messageModel: Model<MessageDocument>,
  ) {}

  // Khách mở/tiếp tục hội thoại với một cửa hàng
  async getOrCreateConversation(customerId: string, shopId: string) {
    const conversation = await this.conversationModel.findOneAndUpdate(
      {
        customerId: new Types.ObjectId(customerId),
        shopId: new Types.ObjectId(shopId),
      },
      { $setOnInsert: { customerUnread: 0, shopUnread: 0 } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return conversation;
  }

  async findById(conversationId: string) {
    return this.conversationModel.findById(conversationId);
  }

  // Danh sách hội thoại của khách
  async listForCustomer(customerId: string) {
    return this.conversationModel
      .find({ customerId: new Types.ObjectId(customerId) })
      .populate('shopId', 'name cityName')
      .sort({ lastMessageAt: -1, updatedAt: -1 });
  }

  // Danh sách hội thoại của một chi nhánh (inbox phía cửa hàng)
  async listForShop(shopId: string) {
    return this.conversationModel
      .find({ shopId: new Types.ObjectId(shopId) })
      .populate('customerId', 'username avatar email')
      .sort({ lastMessageAt: -1, updatedAt: -1 });
  }

  // Lấy lịch sử tin nhắn (đã kiểm tra quyền truy cập)
  async getMessages(conversationId: string, user: ChatUser) {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) {
      throw new BusinessException(
        'Không tìm thấy hội thoại',
        'CONVERSATION_NOT_FOUND',
        HttpStatus.NOT_FOUND,
      );
    }
    this.assertMembership(conversation, user);

    // Đánh dấu đã đọc cho phía đang xem
    const staff = isChatStaffRole(user.role);
    await this.conversationModel.updateOne(
      { _id: conversation._id },
      { $set: staff ? { shopUnread: 0 } : { customerUnread: 0 } },
    );

    return this.messageModel
      .find({ conversationId: conversation._id })
      .sort({ createdAt: 1 });
  }

  // Lưu tin nhắn mới + cập nhật metadata hội thoại
  async saveMessage(conversationId: string, content: string, sender: ChatUser) {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) {
      throw new BusinessException(
        'Không tìm thấy hội thoại',
        'CONVERSATION_NOT_FOUND',
        HttpStatus.NOT_FOUND,
      );
    }
    this.assertMembership(conversation, sender);

    const senderType = isChatStaffRole(sender.role)
      ? SenderType.SHOP
      : SenderType.CUSTOMER;

    const message = await this.messageModel.create({
      conversationId: conversation._id,
      senderId: new Types.ObjectId(sender.id),
      senderType,
      content: content.trim(),
    });

    // Tăng unread cho phía nhận, cập nhật tin cuối
    const unreadField =
      senderType === SenderType.SHOP ? 'customerUnread' : 'shopUnread';
    await this.conversationModel.updateOne(
      { _id: conversation._id },
      {
        $set: {
          lastMessage: content.trim().slice(0, 200),
          lastMessageAt: new Date(),
        },
        $inc: { [unreadField]: 1 },
      },
    );

    return { message: message.toJSON(), conversation };
  }

  // Quyết định quyền: khách phải đúng là chủ hội thoại;
  // nhân viên phải là MANAGER/RECEPTIONIST của đúng chi nhánh.
  assertMembership(conversation: ConversationDocument, user: ChatUser) {
    if (isChatStaffRole(user.role)) {
      if (user.shopId && conversation.shopId.toString() === user.shopId) {
        return;
      }
      throw new ForbiddenException(
        'Bạn không có quyền truy cập hội thoại của chi nhánh này',
      );
    }

    if (conversation.customerId.toString() === user.id) {
      return;
    }

    throw new ForbiddenException('Bạn không có quyền truy cập hội thoại này');
  }
}
