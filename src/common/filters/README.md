# Documentation: Error Handling System

Hệ thống xử lý lỗi tập trung được thiết kế để chuẩn hóa mọi phản hồi lỗi từ Backend về Client (Frontend/Mobile) theo chuẩn RESTful.

## 1. Cấu trúc Response Lỗi (Chuẩn hóa)

Mọi lỗi ném ra từ hệ thống sẽ được `HttpExceptionFilter` đóng gói về dạng:

```json
{
  "success": false,
  "statusCode": number,
  "errorCode": "STRING_CODE",
  "message": "Thông báo thân thiện",
  "errors": [] | null,
  "timestamp": "ISO Date",
  "path": "/api/v1/...",
  "method": "GET/POST...",
  "stack": "Chỉ có ở môi trường Development"
}
```

## 2. Bảng ánh xạ các loại Exception

| Loại Exception | Mục đích sử dụng | StatusCode mặc định | Cách truyền tham số |
| :--- | :--- | :--- | :--- |
| **`BusinessException`** | Lỗi logic nghiệp vụ (ví dụ: hết hàng, sai mã giảm giá) | `400 (Bad Request)` | `BusinessException(message, errorCode, status?)` |
| `BadRequestException` | Lỗi dữ liệu đầu vào không hợp lệ | `400` | `BadRequestException(message)` |
| `UnauthorizedException` | Chưa đăng nhập hoặc Token lỗi | `401` | `UnauthorizedException(message?)` |
| `ForbiddenException` | Không có quyền truy cập (Role không đủ) | `403` | `ForbiddenException(message?)` |
| `NotFoundException` | Không tìm thấy tài nguyên (User, Product...) | `404` | `NotFoundException(message?)` |
| `InternalServerErrorException` | Lỗi hệ thống không xác định | `500` | Tự động bắt từ lỗi runtime |

## 3. Hướng dẫn sử dụng

### 3.1. Sử dụng BusinessException (Khuyên dùng cho Logic)
Dùng khi bạn muốn định nghĩa mã lỗi riêng để Frontend dựa vào đó xử lý logic hoặc hiển thị thông báo đặc thù.

```typescript
// Trong file service
throw new BusinessException(
  'Voucher này đã hết hạn sử dụng', 
  'VOUCHER_EXPIRED'
);
```

### 3.2. Sử dụng Built-in NestJS Exception
Dùng cho các trường hợp lỗi kỹ thuật cơ bản hoặc các chuẩn HTTP thông dụng.

```typescript
throw new NotFoundException('Không tìm thấy sản phẩm này');
```

### 3.3. Xử lý lỗi Validation (DTO)
Các lỗi từ `ValidationPipe` sẽ tự động được Filter chuyển thành format:
- `message`: "Validation failed"
- `errors`: Mảng các lỗi chi tiết (ví dụ: `["email must be an email", "password too short"]`)

## 4. Lưu ý quan trọng
- **errorCode**: Luôn nên đặt ở dạng `UPPER_SNAKE_CASE` (Ví dụ: `USER_NOT_FOUND`). Filter sẽ tự động chuẩn hóa (viết hoa và thay khoảng trắng bằng gạch dưới) nếu bạn truyền vào định dạng khác.
- **Bảo mật**: Thông tin chi tiết kỹ thuật (`stack`) chỉ xuất hiện ở môi trường `development`.
