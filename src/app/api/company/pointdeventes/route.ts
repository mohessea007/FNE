import prisma from '@/lib/prisma';
import { getCurrentUser, isCompanyLevel, isAdminLevel } from '@/lib/auth';
import { validate, createPointDeVenteSchema } from '@/lib/validations';
import { successResponse, errorResponse, validationErrorResponse, unauthorizedResponse, forbiddenResponse, parseJsonBody } from '@/lib/api-utils';

async function getCompanyUid(user: any) {
  if (!user.companieid) return null;
  const company = await prisma.company.findUnique({ where: { id: user.companieid } });
  return company?.uid_companie || null;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (!isCompanyLevel(user.type_user) && !isAdminLevel(user.type_user)) return forbiddenResponse();
  
  const uid_companie = await getCompanyUid(user);
  if (!uid_companie) return forbiddenResponse();

  const pointdeventes = await prisma.pointDeVente.findMany({
    where: { uid_companie, is_active: true },
    orderBy: [{ is_default: 'desc' }, { date_creation: 'desc' }],
  });

  return successResponse(pointdeventes);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (!isCompanyLevel(user.type_user) && !isAdminLevel(user.type_user)) return forbiddenResponse();
  
  const uid_companie = await getCompanyUid(user);
  if (!uid_companie) return forbiddenResponse();

  const body = await parseJsonBody(request);
  if (!body) return errorResponse('Corps de requête invalide', 400);

  const validation = validate(createPointDeVenteSchema, body);
  if (!validation.success) return validationErrorResponse(validation.errors);

  const { nom, is_default } = validation.data;

  if (is_default) {
    await prisma.pointDeVente.updateMany({ where: { uid_companie }, data: { is_default: false } });
  }

  const pdv = await prisma.pointDeVente.create({
    data: { uid_companie, nom, is_default: is_default || false },
  });

  return successResponse(pdv, 'Point de vente créé', 201);
}
