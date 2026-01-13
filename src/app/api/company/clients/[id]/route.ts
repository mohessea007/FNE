import prisma from '@/lib/prisma';
import { getCurrentUser, isCompanyLevel, isAdminLevel } from '@/lib/auth';
import { validate, updateClientSchema } from '@/lib/validations';
import { successResponse, errorResponse, notFoundResponse, validationErrorResponse, unauthorizedResponse, forbiddenResponse, parseJsonBody } from '@/lib/api-utils';
import { ClientType } from '@prisma/client';

interface RouteParams { params: Promise<{ id: string }>; }

async function getCompanyUid(user: any) {
  if (!user.companieid) return null;
  const company = await prisma.company.findUnique({ where: { id: user.companieid } });
  return company?.uid_companie || null;
}

export async function PUT(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (!isCompanyLevel(user.type_user) && !isAdminLevel(user.type_user)) return forbiddenResponse();
  
  const uid_companie = await getCompanyUid(user);
  if (!uid_companie) return forbiddenResponse();

  const { id } = await params;
  const client = await prisma.client.findFirst({ where: { id: parseInt(id), uid_companie } });
  if (!client) return notFoundResponse('Client non trouvé');

  const body = await parseJsonBody(request);
  if (!body) return errorResponse('Corps de requête invalide', 400);

  const validation = validate(updateClientSchema, body);
  if (!validation.success) {
    console.error('Validation errors:', validation.errors);
    return validationErrorResponse(validation.errors);
  }

  if (validation.data.pointdeventeid) {
    const pdv = await prisma.pointDeVente.findFirst({ where: { id: validation.data.pointdeventeid, uid_companie } });
    if (!pdv) return errorResponse('Point de vente non trouvé', 404);
  }

  const updateData = validation.data as any;
  if (updateData.type_client) {
    updateData.type_client = updateData.type_client as ClientType;
  }

  const updated = await prisma.client.update({
    where: { id: parseInt(id) },
    data: updateData,
    include: { pointdevente: { select: { id: true, nom: true } } },
  });

  return successResponse(updated, 'Client mis à jour');
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (!isCompanyLevel(user.type_user) && !isAdminLevel(user.type_user)) return forbiddenResponse();
  
  const uid_companie = await getCompanyUid(user);
  if (!uid_companie) return forbiddenResponse();

  const { id } = await params;
  const client = await prisma.client.findFirst({ where: { id: parseInt(id), uid_companie } });
  if (!client) return notFoundResponse('Client non trouvé');

  await prisma.client.update({ where: { id: parseInt(id) }, data: { is_active: false } });
  return successResponse(null, 'Client supprimé');
}
