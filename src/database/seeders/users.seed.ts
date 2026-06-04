import 'dotenv/config';
import mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import { UserSchema } from '../../modules/users/schemas/user.schema';
import { RoleSchema } from '../../modules/roles/schemas/role.schema';

const UserModel = mongoose.model('User', UserSchema);
const RoleModel = mongoose.model('Role', RoleSchema);

const USERS: { fullName: string; username: string; gender: 'male' | 'female' }[] = [
  { fullName: 'Nguyễn Văn An', username: 'nguyenvanan', gender: 'male' },
  { fullName: 'Trần Thị Bích', username: 'thanthibich', gender: 'female' },
  { fullName: 'Lê Văn Cường', username: 'levancuong', gender: 'male' },
  { fullName: 'Phạm Thị Dung', username: 'phamthidung', gender: 'female' },
  { fullName: 'Hoàng Văn Đức', username: 'hoangvanduc', gender: 'male' },
  { fullName: 'Vũ Thị Hà', username: 'vuthiha', gender: 'female' },
  { fullName: 'Đặng Văn Hùng', username: 'dangvanhung', gender: 'male' },
  { fullName: 'Bùi Thị Hương', username: 'buithihuong', gender: 'female' },
  { fullName: 'Phan Văn Khoa', username: 'phanvankhoa', gender: 'male' },
  { fullName: 'Ngô Thị Lan', username: 'ngothilan', gender: 'female' },
  { fullName: 'Đinh Văn Lâm', username: 'dinhvanlam', gender: 'male' },
  { fullName: 'Lý Thị Mai', username: 'lythimai', gender: 'female' },
  { fullName: 'Trịnh Văn Minh', username: 'trinhvanminh', gender: 'male' },
  { fullName: 'Đỗ Thị Ngọc', username: 'dothingoc', gender: 'female' },
  { fullName: 'Võ Văn Phong', username: 'vovanphong', gender: 'male' },
  { fullName: 'Hồ Thị Quỳnh', username: 'hothiquynh', gender: 'female' },
  { fullName: 'Dương Văn Sơn', username: 'duongvanson', gender: 'male' },
  { fullName: 'Tô Thị Tâm', username: 'tothitam', gender: 'female' },
  { fullName: 'Lưu Văn Thắng', username: 'luuvanthang', gender: 'male' },
  { fullName: 'Mai Thị Xuân', username: 'maithixuan', gender: 'female' },
];

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('Missing MONGODB_URI');

  await mongoose.connect(mongoUri);
  console.log('Bắt đầu seed 20 user...');

  const userRole = await RoleModel.findOne({ name: 'USER' }).lean();
  if (!userRole) throw new Error('Không tìm thấy role USER — hãy chạy npm run seed trước');

  const passwordHash = await bcrypt.hash('123456', 10);

  const docs = USERS.map((u) => ({
    username: u.username,
    email: `${u.username}@daoduck.com`,
    password: passwordHash,
    fullName: u.fullName,
    gender: u.gender,
    roleId: userRole._id,
    addresses: [],
    isVerified: true,
  }));

  await UserModel.insertMany(docs, { ordered: false });
  console.log(`Seed thành công ${docs.length} user.`);
}

main()
  .catch((err) => {
    console.error('Seed thất bại:', err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
