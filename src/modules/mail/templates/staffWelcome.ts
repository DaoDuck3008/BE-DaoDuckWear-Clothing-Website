interface StaffMailParams {
  username: string;
  email: string;
  password: string;
  loginUrl: string;
  isReset?: boolean;
}

export const getStaffCredentialsHtml = ({
  username,
  email,
  password,
  loginUrl,
  isReset = false,
}: StaffMailParams): string => `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${
    isReset ? 'Đặt lại mật khẩu nhân viên' : 'Chào mừng nhân viên mới'
  } — DaoDuck Wear</title>
</head>
<body style="margin:0;padding:0;background:#f3f3f3;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f3f3;padding:48px 0;">
    <tr>
      <td align="center">
        <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;">

          <tr>
            <td style="background:#b91446;height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

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
                      ${isReset ? 'Đặt lại mật khẩu' : 'Tài khoản nhân viên'}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 52px;">
              <div style="border-top:1px solid #e8e8e8;"></div>
            </td>
          </tr>

          <tr>
            <td style="padding:40px 52px 32px;">
              <h1 style="margin:0 0 20px;font-size:26px;font-weight:700;color:#111111;letter-spacing:-0.02em;line-height:1.2;">
                ${
                  isReset
                    ? `Mật khẩu của bạn đã được<br/>đặt lại`
                    : `Chào mừng ${username}<br/>gia nhập DaoDuck Wear`
                }
              </h1>
              <p style="margin:0 0 12px;font-size:14px;color:#555555;line-height:1.8;">
                ${
                  isReset
                    ? 'Quản trị viên vừa đặt lại mật khẩu cho tài khoản của bạn. Vui lòng sử dụng thông tin bên dưới để đăng nhập và đổi mật khẩu mới ngay lập tức để đảm bảo an toàn.'
                    : 'Tài khoản nhân viên của bạn đã được khởi tạo. Vui lòng sử dụng thông tin đăng nhập bên dưới và đổi mật khẩu ngay sau lần đăng nhập đầu tiên.'
                }
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 28px;background:#111111;">
                <tr>
                  <td style="padding:28px 32px;">
                    <p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:0.3em;text-transform:uppercase;color:#999999;">
                      Email đăng nhập
                    </p>
                    <p style="margin:0 0 18px;font-size:16px;font-weight:600;color:#ffffff;letter-spacing:0.02em;">
                      ${email}
                    </p>
                    <p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:0.3em;text-transform:uppercase;color:#999999;">
                      Mật khẩu tạm
                    </p>
                    <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:4px;font-family:'Courier New',Courier,monospace;">
                      ${password}
                    </p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${loginUrl}"
                       style="display:inline-block;padding:14px 40px;background:#b91446;color:#ffffff;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;">
                      Đăng nhập ngay
                    </a>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0"
                style="margin-top:32px;border-left:3px solid #b91446;">
                <tr>
                  <td style="padding-left:16px;">
                    <p style="margin:0;font-size:12px;color:#888888;line-height:1.7;">
                      Vì lý do bảo mật, hãy đổi mật khẩu ngay sau khi đăng nhập.
                      Không chia sẻ thông tin này cho bất kỳ ai. Nếu bạn không phải
                      người nhận dự kiến, vui lòng bỏ qua email này.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 52px;">
              <div style="border-top:1px solid #e8e8e8;"></div>
            </td>
          </tr>

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
