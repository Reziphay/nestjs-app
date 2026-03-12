import { PrismaClient } from '@prisma/client';

import { AppRole } from '../src/common/enums/app-role.enum';
import { UserStatus } from '../src/common/enums/user-status.enum';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const users = [
    {
      fullName: 'Reziphay Admin',
      email: 'admin@reziphay.local',
      phone: '+10000000001',
      roles: [AppRole.ADMIN, AppRole.UCR],
    },
    {
      fullName: 'Demo Customer',
      email: 'customer@reziphay.local',
      phone: '+10000000002',
      roles: [AppRole.UCR],
    },
    {
      fullName: 'Demo Service Owner',
      email: 'uso@reziphay.local',
      phone: '+10000000003',
      roles: [AppRole.UCR, AppRole.USO],
    },
  ];

  for (const seedUser of users) {
    const user = await prisma.user.upsert({
      where: {
        phone: seedUser.phone,
      },
      update: {
        fullName: seedUser.fullName,
        email: seedUser.email,
        phoneVerifiedAt: new Date(),
        emailVerifiedAt: new Date(),
        status: UserStatus.ACTIVE,
      },
      create: {
        fullName: seedUser.fullName,
        email: seedUser.email,
        phone: seedUser.phone,
        phoneVerifiedAt: new Date(),
        emailVerifiedAt: new Date(),
        status: UserStatus.ACTIVE,
      },
    });

    for (const role of seedUser.roles) {
      await prisma.userRole.upsert({
        where: {
          userId_role: {
            userId: user.id,
            role,
          },
        },
        update: {},
        create: {
          userId: user.id,
          role,
        },
      });
    }
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
