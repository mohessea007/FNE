import prisma from '@/lib/prisma';
import { getCurrentUser, isAdminLevel, generateApiKey, generateUID, hashPassword } from '@/lib/auth';
import { validate, createCompanySchema } from '@/lib/validations';
import { successResponse, errorResponse, validationErrorResponse, unauthorizedResponse, forbiddenResponse, parseJsonBody } from '@/lib/api-utils';

// GET /api/admin/companies - List all companies
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (!isAdminLevel(user.type_user)) return forbiddenResponse();

  const companies = await prisma.company.findMany({
    include: {
      _count: { select: { clients: true, invoices: true, users: true } },
    },
    orderBy: { date_creation: 'desc' },
  });

  return successResponse(companies);
}

// POST /api/admin/companies - Create company
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (!isAdminLevel(user.type_user)) return forbiddenResponse();

  const body = await parseJsonBody(request);
  if (!body) return errorResponse('Corps de requête invalide', 400);

  const validation = validate(createCompanySchema, body);
  if (!validation.success) return validationErrorResponse(validation.errors);

  const { nom, ncc, token_fne, commercialMessage, footer, localisation, defaultPointDeVente, owner_nom, owner_email, owner_username, owner_password } = validation.data;

  const existing = await prisma.company.findUnique({ where: { ncc } });
  if (existing) return errorResponse('Une entreprise avec ce NCC existe déjà', 400);

  const uid_companie = generateUID();
  const api_key = generateApiKey();

  // Utiliser les données fournies ou générer par défaut
  let ownerUsername = owner_username || `owner_${ncc.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now().toString().slice(-6)}`;
  const ownerPassword = owner_password || generateApiKey().replace('sk_', '').substring(0, 12);
  const ownerNom = owner_nom || nom;
  const ownerEmail = owner_email || null;

  // Vérifier si le username existe déjà
  let existingUser = await prisma.user.findUnique({ where: { username: ownerUsername } });
  if (existingUser) {
    // Si le username existe, ajouter un suffixe
    ownerUsername = `${ownerUsername}_${Math.random().toString(36).substring(2, 8)}`;
    existingUser = await prisma.user.findUnique({ where: { username: ownerUsername } });
    if (existingUser) {
      return errorResponse('Impossible de générer un nom d\'utilisateur unique. Veuillez réessayer.', 500);
    }
  }

  // Vérifier si l'email existe déjà
  if (ownerEmail) {
    const existingEmailUser = await prisma.user.findFirst({ where: { email: ownerEmail } });
    if (existingEmailUser) {
      return errorResponse('Un utilisateur avec cet email existe déjà', 400);
    }
  }

  // Créer l'entreprise avec le point de vente par défaut
  const company = await prisma.company.create({
    data: {
      uid_companie,
      api_key,
      token_fne,
      nom,
      ncc,
      commercialMessage: commercialMessage || '',
      footer: footer || '',
      localisation: localisation || '',
      pointdeventes: {
        create: { nom: defaultPointDeVente || 'Point de vente principal', is_default: true },
      },
    },
    include: { pointdeventes: true },
  });

  // Créer le user owner après la création de l'entreprise
  await prisma.user.create({
    data: {
      username: ownerUsername,
      password: await hashPassword(ownerPassword),
      nom: ownerNom,
      email: ownerEmail,
      type_user: 'owner',
      role: 'admin',
      companieid: company.id,
      is_active: true,
      is_dev: 0,
      is_admin: 1,
      is_superadmin: 0,
      created_by: user.id,
    },
  });

  return successResponse({ 
    id: company.id, 
    uid_companie: company.uid_companie, 
    nom: company.nom, 
    api_key: company.api_key, 
    pointdeventes: company.pointdeventes,
    owner_username: ownerUsername,
    owner_password: ownerPassword,
  }, 'Entreprise créée avec succès', 201);
}
