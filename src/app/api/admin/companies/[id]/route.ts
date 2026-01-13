import prisma from '@/lib/prisma';
import { getCurrentUser, isAdminLevel } from '@/lib/auth';
import { validate, updateCompanySchema } from '@/lib/validations';
import { successResponse, errorResponse, notFoundResponse, unauthorizedResponse, forbiddenResponse, validationErrorResponse, parseJsonBody } from '@/lib/api-utils';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/companies/:id
export async function GET(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (!isAdminLevel(user.type_user)) return forbiddenResponse();

  const { id } = await params;
  const company = await prisma.company.findUnique({
    where: { id: parseInt(id) },
    include: {
      pointdeventes: true,
      clients: true,
      users: { select: { id: true, username: true, nom: true, type_user: true, role: true } },
      _count: { select: { invoices: true } },
    },
  });

  if (!company) return notFoundResponse('Entreprise non trouvée');
  return successResponse(company);
}

// PUT /api/admin/companies/:id
export async function PUT(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (!isAdminLevel(user.type_user)) return forbiddenResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body) return errorResponse('Corps de requête invalide', 400);

  const validation = validate(updateCompanySchema, body);
  if (!validation.success) return validationErrorResponse(validation.errors);

  const company = await prisma.company.findUnique({ where: { id: parseInt(id) } });
  if (!company) return notFoundResponse('Entreprise non trouvée');

  // Ne pas modifier le token_fne - il est protégé et exclu du schéma
  const updateData: any = {};
  if (validation.data.nom !== undefined) updateData.nom = validation.data.nom;
  if (validation.data.ncc !== undefined) updateData.ncc = validation.data.ncc;
  if (validation.data.commercialMessage !== undefined) updateData.commercialMessage = validation.data.commercialMessage;
  if (validation.data.footer !== undefined) updateData.footer = validation.data.footer;
  if (validation.data.localisation !== undefined) updateData.localisation = validation.data.localisation;
  if (validation.data.is_active !== undefined) updateData.is_active = validation.data.is_active;

  const updated = await prisma.company.update({
    where: { id: parseInt(id) },
    data: updateData,
  });

  return successResponse(updated, 'Entreprise mise à jour');
}

// DELETE /api/admin/companies/:id
export async function DELETE(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (!isAdminLevel(user.type_user)) return forbiddenResponse();

  const { id } = await params;
  const company = await prisma.company.findUnique({
    where: { id: parseInt(id) },
    include: { _count: { select: { invoices: true } } },
  });

  if (!company) return notFoundResponse('Entreprise non trouvée');
  if (company._count.invoices > 0) return errorResponse('Impossible de supprimer : factures existantes', 400);

  await prisma.company.update({
    where: { id: parseInt(id) },
    data: { is_active: false },
  });

  return successResponse(null, 'Entreprise supprimée');
}
