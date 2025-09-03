const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('마스터 계정 생성 시도 중...');

    const existingUser = await prisma.user.findUnique({
      where: { email: process.env.MASTER_EMAIL },
    });

    if (existingUser) {
      console.log('마스터 계정이 이미 존재합니다:', existingUser.email);
    } else {
      const hashedPassword = await bcrypt.hash(process.env.MASTER_PASSWORD, 10);

      await prisma.user.create({
        data: {
          email: process.env.MASTER_EMAIL,
          passwordHash: hashedPassword,
          name: process.env.MASTER_NAME,
          role: 'MASTER',
          status: 'ACTIVE',
        },
      });

      console.log('마스터 계정 생성 완료:', process.env.MASTER_EMAIL);
    }
  } catch (error) {
    console.error('마스터 계정 생성 중 오류:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();