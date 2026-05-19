interface OrderCompletedItem {
  name: string;
  image?: string;
  price: number;
  quantity: number;
  color: string;
  size: string;
}

interface OrderCompletedParams {
  username: string;
  orderCode: string;
  orderId: string;
  items: OrderCompletedItem[];
  finalTotal: number;
  reviewUrl: string;
}

const formatPrice = (p: number) =>
  p.toLocaleString('vi-VN') + '₫';

export const getOrderCompletedHtml = ({
  username,
  orderCode,
  orderId,
  items,
  finalTotal,
  reviewUrl,
}: OrderCompletedParams): string => {
  const itemRows = items
    .map(
      (item) => `
      <tr>
        <td style="padding:16px 0;border-bottom:1px solid #f0f0f0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              ${
                item.image
                  ? `<td width="64" valign="top" style="padding-right:16px;">
                      <img src="${item.image}" alt="${item.name}"
                        width="64" height="80"
                        style="display:block;width:64px;height:80px;object-fit:cover;" />
                    </td>`
                  : ''
              }
              <td valign="top">
                <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#111111;text-transform:uppercase;letter-spacing:0.02em;">
                  ${item.name}
                </p>
                <p style="margin:0 0 8px;font-size:11px;color:#888888;letter-spacing:0.05em;">
                  Màu: ${item.color} &nbsp;|&nbsp; Size: ${item.size} &nbsp;|&nbsp; SL: ${item.quantity}
                </p>
                <p style="margin:0;font-size:13px;font-weight:700;color:#111111;">
                  ${formatPrice(item.price * item.quantity)}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `,
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Đơn hàng hoàn thành — DaoDuck Wear</title>
</head>
<body style="margin:0;padding:0;background:#f3f3f3;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f3f3;padding:48px 0;">
    <tr>
      <td align="center">
        <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;">

          <!-- Accent bar -->
          <tr>
            <td style="background:#b91446;height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding:36px 52px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:#111111;">
                      DAODUCK WEAR
                    </p>
                    <p style="margin:4px 0 0;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#b91446;">
                      Editorial Fashion
                    </p>
                  </td>
                  <td align="right">
                    <p style="margin:0;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#cccccc;">
                      Xác nhận giao hàng
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 52px;">
              <div style="border-top:1px solid #e8e8e8;"></div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 52px 8px;">
              <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:#111111;letter-spacing:-0.02em;line-height:1.2;">
                Cảm ơn bạn, ${username}!
              </h1>
              <p style="margin:0 0 24px;font-size:14px;color:#555555;line-height:1.8;">
                Đơn hàng <strong style="color:#111111;">#${orderCode}</strong> đã được giao thành công.
                Hy vọng bạn hài lòng với những sản phẩm của chúng tôi.
              </p>

              <!-- Items -->
              <table width="100%" cellpadding="0" cellspacing="0">
                ${itemRows}
              </table>

              <!-- Total -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-top:2px solid #111111;padding-top:16px;">
                <tr>
                  <td>
                    <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#888888;">
                      Tổng thanh toán
                    </p>
                  </td>
                  <td align="right">
                    <p style="margin:0;font-size:18px;font-weight:700;color:#111111;">
                      ${formatPrice(finalTotal)}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Review CTA -->
          <tr>
            <td style="padding:32px 52px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-left:3px solid #b91446;">
                <tr>
                  <td style="padding:24px 28px;">
                    <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#111111;">
                      Trải nghiệm của bạn có ý nghĩa với chúng tôi
                    </p>
                    <p style="margin:0 0 20px;font-size:12px;color:#666666;line-height:1.7;">
                      Hãy chia sẻ cảm nhận về sản phẩm để giúp những khách hàng khác
                      có lựa chọn tốt hơn.
                    </p>
                    <a href="${reviewUrl}"
                      style="display:inline-block;background:#111111;color:#ffffff;
                             text-decoration:none;font-size:11px;font-weight:700;
                             letter-spacing:0.2em;text-transform:uppercase;
                             padding:14px 32px;">
                      Đánh giá sản phẩm
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 52px;">
              <div style="border-top:1px solid #e8e8e8;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:28px 52px;background:#f9f9f9;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#111111;">
                      DAODUCK WEAR
                    </p>
                    <p style="margin:0;font-size:10px;color:#aaaaaa;letter-spacing:0.05em;line-height:1.6;">
                      Phong cách · Đẳng cấp · Tự tin<br/>
                      Email tự động — vui lòng không trả lời trực tiếp.
                    </p>
                  </td>
                  <td align="right" valign="top">
                    <p style="margin:0;font-size:10px;color:#cccccc;">© 2025</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};
