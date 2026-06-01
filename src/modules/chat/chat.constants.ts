// Các role phía cửa hàng được phép tham gia chat với khách.
// Chỉ lễ tân và quản lý của đúng chi nhánh mới đọc/trả lời hội thoại.
export const CHAT_STAFF_ROLES = ['MANAGER', 'RECEPTIONIST'] as const;

export function isChatStaffRole(role?: string | null): boolean {
  return !!role && (CHAT_STAFF_ROLES as readonly string[]).includes(role);
}
