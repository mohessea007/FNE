import prisma from '@/lib/prisma';
import { getCurrentUser, isAdminLevel, hashPassword } from '@/lib/auth';
import { validate, createUserSchema } from '@/lib/validations';
import { successResponse, errorResponse, validationErrorResponse, unauthorizedResponse, forbiddenResponse, parseJsonBody } from '@/lib/api-utils';

// GET /api/admin/users - List all users
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (!isAdminLevel(user.type_user)) return forbiddenResponse();

  const users = await prisma.user.findMany({
    include: {
      company: { select: { id: true, nom: true, uid_companie: true } },
      client: { select: { id: true, clientCompanyName: true } },
    },
    orderBy: { date_creation: 'desc' },
  });

  // Sérialiser les dates
  const serializedUsers = users.map(u => ({
    ...u,
    date_creation: u.date_creation.toISOString(),
    date_modification: u.date_modification.toISOString(),
    last_login: u.last_login?.toISOString() || null,
  }));

  return successResponse(serializedUsers);
}

// POST /api/admin/users - Create user
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (!isAdminLevel(user.type_user)) return forbiddenResponse();

  const body = await parseJsonBody(request);
  if (!body) return errorResponse('Corps de requête invalide', 400);

  const validation = validate(createUserSchema, body);
  if (!validation.success) return validationErrorResponse(validation.errors);

  const { username, password, nom, email, type_user, role, companieid, clientid } = validation.data;

  // Vérifier si le username existe déjà
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return errorResponse('Un utilisateur avec ce nom d\'utilisateur existe déjà', 400);

  // Vérifier que companieid existe si fourni
  if (companieid) {
    const company = await prisma.company.findUnique({ where: { id: companieid } });
    if (!company) return errorResponse('Entreprise non trouvée', 400);
  }

  // Vérifier que clientid existe si fourni
  if (clientid) {
    const client = await prisma.client.findUnique({ where: { id: clientid } });
    if (!client) return errorResponse('Client non trouvé', 400);
  }

  // Hash le mot de passe
  const hashedPassword = await hashPassword(password);

  // Déterminer les flags is_dev, is_admin, is_superadmin
  const is_dev = type_user === 'developer' ? 1 : 0;
  const is_admin = ['developer', 'superadmin', 'admin'].includes(type_user) ? 1 : 0;
  const is_superadmin = ['developer', 'superadmin'].includes(type_user) ? 1 : 0;

  const newUser = await prisma.user.create({
    data: {
      username,
      password: hashedPassword,
      nom,
      email: email || null,
      type_user,
      role: role || 'user',
      companieid: companieid || null,
      clientid: clientid || null,
      is_dev,
      is_admin,
      is_superadmin,
      created_by: user.id,
    },
    include: {
      company: { select: { id: true, nom: true, uid_companie: true } },
      client: { select: { id: true, clientCompanyName: true } },
    },
  });

  // Ne pas renvoyer le mot de passe
  const { password: _, ...userWithoutPassword } = newUser;

  return successResponse({
    ...userWithoutPassword,
    date_creation: userWithoutPassword.date_creation.toISOString(),
    date_modification: userWithoutPassword.date_modification.toISOString(),
    last_login: userWithoutPassword.last_login?.toISOString() || null,
  }, 'Utilisateur créé avec succès', 201);
}

