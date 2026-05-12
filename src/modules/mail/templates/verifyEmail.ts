export const getVerifyEmailHtml = (code: string): string => `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Xác thực tài khoản — DaoDuck Wear</title>
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
                      Xác thực tài khoản
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
                Chào mừng bạn đến với<br/>DaoDuck Wear
              </h1>
              <p style="margin:0 0 12px;font-size:14px;color:#555555;line-height:1.8;">
                Cảm ơn bạn đã đăng ký tài khoản. Chỉ còn một bước nữa để bắt đầu
                khám phá những bộ sưu tập thời trang editorial độc đáo của chúng tôi.
              </p>
              <p style="margin:0 0 32px;font-size:14px;color:#555555;line-height:1.8;">
                Sử dụng mã xác thực bên dưới để kích hoạt tài khoản của bạn.
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

              <table width="100%" cellpadding="0" cellspacing="0"
                style="border-left:3px solid #b91446;padding-left:0;margin-bottom:0;">
                <tr>
                  <td style="padding-left:16px;">
                    <p style="margin:0;font-size:12px;color:#888888;line-height:1.7;">
                      Nếu bạn không thực hiện đăng ký này, hãy bỏ qua email.<br/>
                      Tài khoản của bạn vẫn <strong style="color:#555555;">hoàn toàn an toàn</strong>
                      và không có thay đổi nào được thực hiện.
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
