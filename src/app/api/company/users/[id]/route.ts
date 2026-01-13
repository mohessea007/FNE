import prisma from '@/lib/prisma';
import { getCurrentUser, isCompanyLevel, isAdminLevel } from '@/lib/auth';
import { successResponse, errorResponse, notFoundResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils';

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function getCompanyId(user: any) {
  return user.companieid || null;
}

// PUT /api/company/users/:id - Toggle user active status
export async function PUT(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (!isCompanyLevel(user.type_user) && !isAdminLevel(user.type_user)) return forbiddenResponse();

  const companyId = await getCompanyId(user);
  if (!companyId) return forbiddenResponse();

  const { id } = await params;
  const userId = parseInt(id);

  // Vérifier que l'utilisateur appartient à l'entreprise
  const targetUser = await prisma.user.findFirst({
    where: {
      id: userId,
      companieid: companyId,
    },
  });

  if (!targetUser) return notFoundResponse('Utilisateur non trouvé');

  // Ne pas permettre de désactiver le dernier owner actif
  if (targetUser.type_user === 'owner' && targetUser.is_active) {
    const activeOwners = await prisma.user.count({
      where: {
        companieid: companyId,
        type_user: 'owner',
        is_active: true,
      },
    });

    if (activeOwners <= 1) {
      return errorResponse('Impossible de désactiver le dernier propriétaire actif', 400);
    }
  }

  // Inverser le statut
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { is_active: !targetUser.is_active },
    select: {
      id: true,
      username: true,
      nom: true,
      is_active: true,
    },
  });

  return successResponse(updated, `Utilisateur ${updated.is_active ? 'activé' : 'désactivé'}`);
}

