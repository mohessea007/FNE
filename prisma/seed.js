const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create developer user
  const hashedPassword = await bcrypt.hash('developer123', 12);
  
  const developer = await prisma.user.upsert({
    where: { username: 'developer' },
    update: {},
    create: {
      username: 'developer',
      password: hashedPassword,
      nom: 'Developer CloudFNE',
      email: 'developer@cloudfne.com',
      type_user: 'developer',
      role: 'admin',
      is_dev: 1,
      is_admin: 1,
      is_superadmin: 1,
      created_by: 0,
    },
  });

  console.log('✅ Developer user created:', developer.username);

  console.log('\n🎉 Seeding completed!');
  console.log('\n📋 Login credentials:');
  console.log('   Username: developer');
  console.log('   Password: developer123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
