import prisma from '@/lib/prisma';
import { validateApiKey, generateApiKey, generateUID, hashPassword } from '@/lib/auth';
import { validate, createCompanySchema, updateCompanySchema } from '@/lib/validations';
import { 
  successResponse, 
  errorResponse, 
  validationErrorResponse, 
  unauthorizedResponse,
  parseJsonBody,
  getApiKeyFromHeaders
} from '@/lib/api-utils';

// POST /api/v1/company - Create a new company (PUBLIC)
export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request);
    
    if (!body) {
      return errorResponse('Corps de requête invalide', 400);
    }

    const validation = validate(createCompanySchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const { nom, ncc, token_fne, commercialMessage, footer, localisation, defaultPointDeVente, owner_username, owner_password, owner_nom, owner_email } = validation.data;

    // Check if NCC already exists
    const existingCompany = await prisma.company.findUnique({
      where: { ncc },
    });

    if (existingCompany) {
      return errorResponse('Une entreprise avec ce NCC existe déjà', 400);
    }

    const uid_companie = generateUID();
    const api_key = generateApiKey();

    // Générer un username et password par défaut si non fourni
    let ownerUsername = owner_username || `owner_${ncc.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now().toString().slice(-6)}`;
    const ownerPassword = owner_password || generateApiKey().replace('sk_', '').substring(0, 12);
    const ownerNom = owner_nom || nom;
    
    // Vérifier si le username existe déjà et générer un nouveau si nécessaire
    let existingUser = await prisma.user.findUnique({ where: { username: ownerUsername } });
    if (existingUser) {
      ownerUsername = `${ownerUsername}_${Math.random().toString(36).substring(2, 8)}`;
      existingUser = await prisma.user.findUnique({ where: { username: ownerUsername } });
      if (existingUser) {
        return errorResponse('Impossible de générer un nom d\'utilisateur unique. Veuillez réessayer.', 500);
      }
    }

    // Create company with default point de vente
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
          create: {
            nom: defaultPointDeVente || 'Point de vente principal',
            is_default: true,
          },
        },
      },
      include: {
        pointdeventes: true,
      },
    });

    // Créer le user owner après la création de l'entreprise
    await prisma.user.create({
      data: {
        username: ownerUsername,
        password: await hashPassword(ownerPassword),
        nom: ownerNom,
        email: owner_email || null,
        type_user: 'owner',
        role: 'admin',
        companieid: company.id,
        is_active: true,
        is_dev: 0,
        is_admin: 1,
        is_superadmin: 0,
        created_by: 0, // API publique, pas de created_by
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
    }, 'Entreprise créée avec succès. Conservez votre API Key et vos identifiants en sécurité.', 201);
  } catch (error) {
    console.error('Create company error:', error);
    return errorResponse('Erreur serveur', 500);
  }
}

// GET /api/v1/company - Get company info (requires API key)
export async function GET(request: Request) {
  try {
    const apiKey = getApiKeyFromHeaders(request);
    if (!apiKey) {
      return unauthorizedResponse('Clé API manquante');
    }

    const company = await validateApiKey(apiKey);
    if (!company) {
      return unauthorizedResponse('Clé API invalide');
    }

    const fullCompany = await prisma.company.findUnique({
      where: { id: company.id },
      include: {
        pointdeventes: true,
        _count: {
          select: {
            clients: true,
            invoices: true,
          },
        },
      },
    });

    return successResponse({
      id: fullCompany?.id,
      uid_companie: fullCompany?.uid_companie,
      nom: fullCompany?.nom,
      ncc: fullCompany?.ncc,
      token_fne: fullCompany?.token_fne,
      commercialMessage: fullCompany?.commercialMessage,
      footer: fullCompany?.footer,
      localisation: fullCompany?.localisation,
      pointdeventes: fullCompany?.pointdeventes,
      stats: fullCompany?._count,
      date_creation: fullCompany?.date_creation,
    });
  } catch (error) {
    console.error('Get company error:', error);
    return errorResponse('Erreur serveur', 500);
  }
}

// PUT /api/v1/company - Update company (requires API key)
export async function PUT(request: Request) {
  try {
    const apiKey = getApiKeyFromHeaders(request);
    if (!apiKey) {
      return unauthorizedResponse('Clé API manquante');
    }

    const company = await validateApiKey(apiKey);
    if (!company) {
      return unauthorizedResponse('Clé API invalide');
    }

    const body = await parseJsonBody(request);
    if (!body) {
      return errorResponse('Corps de requête invalide', 400);
    }

    const validation = validate(updateCompanySchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const updatedCompany = await prisma.company.update({
      where: { id: company.id },
      data: validation.data,
      include: {
        pointdeventes: true,
      },
    });

    return successResponse({
      id: updatedCompany.id,
      uid_companie: updatedCompany.uid_companie,
      nom: updatedCompany.nom,
      ncc: updatedCompany.ncc,
      token_fne: updatedCompany.token_fne,
      commercialMessage: updatedCompany.commercialMessage,
      footer: updatedCompany.footer,
      localisation: updatedCompany.localisation,
      pointdeventes: updatedCompany.pointdeventes,
    }, 'Entreprise mise à jour avec succès');
  } catch (error) {
    console.error('Update company error:', error);
    return errorResponse('Erreur serveur', 500);
  }
}
