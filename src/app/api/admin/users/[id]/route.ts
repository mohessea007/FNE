import prisma from '@/lib/prisma';
import { getCurrentUser, isAdminLevel } from '@/lib/auth';
import { successResponse, errorResponse, notFoundResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// DELETE /api/admin/users/:id
export async function DELETE(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (!isAdminLevel(user.type_user)) return forbiddenResponse();

  const { id } = await params;
  const userId = parseInt(id);

  // Ne pas permettre de se supprimer soi-même
  if (userId === user.id) {
    return errorResponse('Vous ne pouvez pas supprimer votre propre compte', 400);
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!targetUser) return notFoundResponse('Utilisateur non trouvé');

  // Désactiver l'utilisateur au lieu de le supprimer pour préserver l'historique
  await prisma.user.update({
    where: { id: userId },
    data: { is_active: false },
  });

  return successResponse(null, 'Utilisateur désactivé');
}

