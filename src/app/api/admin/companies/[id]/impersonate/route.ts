import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { getCurrentUser, isAdminLevel } from '@/lib/auth';
import { successResponse, errorResponse, notFoundResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/admin/companies/:id/impersonate - Start impersonation
export async function POST(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (!isAdminLevel(user.type_user)) return forbiddenResponse();

  const { id } = await params;
  const companyId = parseInt(id);

  // Vérifier que l'entreprise existe
  const company = await prisma.company.findUnique({
    where: { id: companyId },
  });

  if (!company) return notFoundResponse('Entreprise non trouvée');
  if (!company.is_active) return errorResponse('Impossible de se connecter à une entreprise inactive', 400);

  // Stocker l'ID de l'entreprise dans un cookie d'impersonation
  const cookieStore = await cookies();
  cookieStore.set('impersonate_company_id', companyId.toString(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 heures
    path: '/',
  });

  return successResponse({ companyId, companyName: company.nom }, 'Impersonation démarrée');
}

// DELETE /api/admin/companies/:id/impersonate - Stop impersonation
export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (!isAdminLevel(user.type_user)) return forbiddenResponse();

  const cookieStore = await cookies();
  cookieStore.delete('impersonate_company_id');

  return successResponse(null, 'Impersonation terminée');
}

