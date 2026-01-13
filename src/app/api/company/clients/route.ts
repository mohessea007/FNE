import prisma from '@/lib/prisma';
import { getCurrentUser, isCompanyLevel, isAdminLevel, hashPassword } from '@/lib/auth';
import { validate, createClientSchema } from '@/lib/validations';
import { successResponse, errorResponse, validationErrorResponse, unauthorizedResponse, forbiddenResponse, parseJsonBody } from '@/lib/api-utils';
import { z } from 'zod';
import { ClientType } from '@prisma/client';

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

  const clients = await prisma.client.findMany({
    where: { uid_companie, is_active: true },
    include: { pointdevente: { select: { id: true, nom: true } } },
    orderBy: { date_creation: 'desc' },
  });

  return successResponse(clients);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (!isCompanyLevel(user.type_user) && !isAdminLevel(user.type_user)) return forbiddenResponse();
  
  const uid_companie = await getCompanyUid(user);
  if (!uid_companie) return forbiddenResponse();

  const body = await parseJsonBody(request);
  if (!body) return errorResponse('Corps de requête invalide', 400);

  const validation = validate(createClientSchema, body);
  if (!validation.success) {
    console.error('Validation errors:', validation.errors);
    return validationErrorResponse(validation.errors);
  }

  const { pointdeventeid, user_username, user_password, ...clientData } = validation.data as z.infer<typeof createClientSchema>;

  const pdv = await prisma.pointDeVente.findFirst({
    where: { id: pointdeventeid, uid_companie },
  });
  if (!pdv) return errorResponse('Point de vente non trouvé', 404);

  // Créer le client
  const client = await prisma.client.create({
    data: { 
      uid_companie, 
      pointdeventeid, 
      ...clientData,
      type_client: clientData.type_client as ClientType,
    },
    include: { pointdevente: { select: { id: true, nom: true } } },
  });

  // Créer le compte utilisateur si user_username et user_password sont fournis
  if (user_username && user_password) {
    // Vérifier si le username existe déjà
    const existingUser = await prisma.user.findUnique({ where: { username: user_username } });
    if (existingUser) {
      // Supprimer le client créé
      await prisma.client.delete({ where: { id: client.id } });
      return errorResponse('Un utilisateur avec ce nom d\'utilisateur existe déjà', 400);
    }

    const company = await prisma.company.findUnique({ where: { uid_companie } });
    if (!company) {
      await prisma.client.delete({ where: { id: client.id } });
      return errorResponse('Entreprise non trouvée', 404);
    }

    await prisma.user.create({
      data: {
        username: user_username,
        password: await hashPassword(user_password),
        nom: clientData.clientCompanyName || `Client ${client.id}`,
        email: clientData.clientEmail || null,
        type_user: 'owner',
        role: 'user',
        companieid: company.id,
        clientid: client.id,
        is_active: true,
        is_dev: 0,
        is_admin: 0,
        is_superadmin: 0,
        created_by: user.id,
      },
    });
  }

  return successResponse(client, 'Client créé avec succès', 201);
}
