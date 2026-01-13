import prisma from '@/lib/prisma';
import { getCurrentUser, isCompanyLevel, isAdminLevel } from '@/lib/auth';
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils';

async function getCompanyId(user: any) {
  return user.companieid || null;
}

// GET /api/company/users - List company users
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (!isCompanyLevel(user.type_user) && !isAdminLevel(user.type_user)) return forbiddenResponse();

  const companyId = await getCompanyId(user);
  if (!companyId) return forbiddenResponse();

  const users = await prisma.user.findMany({
    where: { companieid: companyId },
    select: {
      id: true,
      username: true,
      nom: true,
      email: true,
      type_user: true,
      role: true,
      is_active: true,
      date_creation: true,
    },
    orderBy: { date_creation: 'desc' },
  });

  // Sérialiser les dates
  const serializedUsers = users.map(u => ({
    ...u,
    date_creation: u.date_creation.toISOString(),
  }));

  return successResponse(serializedUsers);
}

