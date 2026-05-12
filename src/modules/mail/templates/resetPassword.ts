export const getResetPasswordHtml = (code: string): string => `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Đặt lại mật khẩu — DaoDuck Wear</title>
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
                      Đặt lại mật khẩu
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
            <td style="padding:40px 52px 32px;">
              <h1 style="margin:0 0 20px;font-size:26px;font-weight:700;color:#111111;letter-spacing:-0.02em;line-height:1.2;">
                Yêu cầu đặt lại<br/>mật khẩu
              </h1>
              <p style="margin:0 0 12px;font-size:14px;color:#555555;line-height:1.8;">
                Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản liên kết
                với địa chỉ email này.
              </p>
              <p style="margin:0 0 32px;font-size:14px;color:#555555;line-height:1.8;">
                Nhập mã xác thực bên dưới để tiến hành tạo mật khẩu mới.
                Mã có hiệu lực trong <strong style="color:#111111;">10 phút</strong>.
              </p>

              <!-- OTP Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="background:#111111;padding:36px;text-align:center;">
                    <p style="margin:0 0 12px;font-size:10px;font-weight:700;letter-spacing:0.3em;text-transform:uppercase;color:#999999;">
                      Mã xác thực của bạn
                    </p>
                    <p style="margin:0;font-size:52px;font-weight:700;letter-spacing:18px;color:#ffffff;font-family:'Courier New',Courier,monospace;">
                      ${code}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Warning box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="background:#fff8f8;border:1px solid #f5c6cb;padding:16px 20px;">
                    <p style="margin:0;font-size:12px;color:#7a2929;line-height:1.7;">
                      ⚠️ &nbsp;<strong>Quan trọng:</strong> Nếu bạn không yêu cầu đặt lại mật khẩu,
                      hãy bỏ qua email này. Mật khẩu hiện tại của bạn
                      <strong>KHÔNG bị thay đổi</strong>.
                      Nếu bạn nghi ngờ tài khoản bị xâm phạm, hãy liên hệ hỗ trợ ngay.
                    </p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-left:3px solid #b91446;padding-left:16px;">
                    <p style="margin:0;font-size:12px;color:#888888;line-height:1.7;">
                      Vì lý do bảo mật, mã này chỉ có thể được sử dụng một lần
                      và sẽ hết hạn sau 10 phút kể từ khi email này được gửi.
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
