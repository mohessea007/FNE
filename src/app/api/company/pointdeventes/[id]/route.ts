import prisma from '@/lib/prisma';
import { getCurrentUser, isCompanyLevel, isAdminLevel } from '@/lib/auth';
import { validate, updatePointDeVenteSchema } from '@/lib/validations';
import { successResponse, errorResponse, notFoundResponse, validationErrorResponse, unauthorizedResponse, forbiddenResponse, parseJsonBody } from '@/lib/api-utils';

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function getCompanyUid(user: any) {
  if (!user.companieid) return null;
  const company = await prisma.company.findUnique({ where: { id: user.companieid } });
  return company?.uid_companie || null;
}

// PUT /api/company/pointdeventes/:id
export async function PUT(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (!isCompanyLevel(user.type_user) && !isAdminLevel(user.type_user)) return forbiddenResponse();
  
  const uid_companie = await getCompanyUid(user);
  if (!uid_companie) return forbiddenResponse();

  const { id } = await params;
  const pdv = await prisma.pointDeVente.findFirst({
    where: { id: parseInt(id), uid_companie },
  });
  if (!pdv) return notFoundResponse('Point de vente non trouvé');

  const body = await parseJsonBody(request);
  if (!body) return errorResponse('Corps de requête invalide', 400);

  const validation = validate(updatePointDeVenteSchema, body);
  if (!validation.success) return validationErrorResponse(validation.errors);

  // Si on définit comme défaut, retirer le défaut des autres
  if (validation.data.is_default) {
    await prisma.pointDeVente.updateMany({
      where: { uid_companie, id: { not: parseInt(id) } },
      data: { is_default: false },
    });
  }

  const updateData: any = {};
  if (validation.data.nom !== undefined) updateData.nom = validation.data.nom;
  if (validation.data.is_default !== undefined) updateData.is_default = validation.data.is_default;

  const updated = await prisma.pointDeVente.update({
    where: { id: parseInt(id) },
    data: updateData,
  });

  return successResponse(updated, 'Point de vente mis à jour');
}

// DELETE /api/company/pointdeventes/:id
export async function DELETE(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (!isCompanyLevel(user.type_user) && !isAdminLevel(user.type_user)) return forbiddenResponse();
  
  const uid_companie = await getCompanyUid(user);
  if (!uid_companie) return forbiddenResponse();

  const { id } = await params;
  const pdv = await prisma.pointDeVente.findFirst({
    where: { id: parseInt(id), uid_companie },
  });
  if (!pdv) return notFoundResponse('Point de vente non trouvé');

  if (pdv.is_default) {
    return errorResponse('Impossible de supprimer le point de vente par défaut', 400);
  }

  // Soft delete
  await prisma.pointDeVente.update({
    where: { id: parseInt(id) },
    data: { is_active: false },
  });

  return successResponse(null, 'Point de vente supprimé');
}

