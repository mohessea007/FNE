import prisma from '@/lib/prisma';
import { validateApiKey } from '@/lib/auth';
import { validate, createPointDeVenteSchema } from '@/lib/validations';
import { 
  successResponse, 
  errorResponse, 
  validationErrorResponse, 
  unauthorizedResponse,
  parseJsonBody,
  getApiKeyFromHeaders
} from '@/lib/api-utils';

// GET /api/v1/pointdeventes - List points de vente
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

    const pointdeventes = await prisma.pointDeVente.findMany({
      where: { uid_companie: company.uid_companie, is_active: true },
      orderBy: [{ is_default: 'desc' }, { date_creation: 'desc' }],
    });

    return successResponse({
      total: pointdeventes.length,
      pointdeventes,
    });
  } catch (error) {
    console.error('List PDV error:', error);
    return errorResponse('Erreur serveur', 500);
  }
}

// POST /api/v1/pointdeventes - Create point de vente
export async function POST(request: Request) {
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

    const validation = validate(createPointDeVenteSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const { nom, is_default } = validation.data;

    // If setting as default, unset other defaults
    if (is_default) {
      await prisma.pointDeVente.updateMany({
        where: { uid_companie: company.uid_companie },
        data: { is_default: false },
      });
    }

    const pdv = await prisma.pointDeVente.create({
      data: {
        uid_companie: company.uid_companie,
        nom,
        is_default: is_default || false,
      },
    });

    return successResponse(pdv, 'Point de vente créé avec succès', 201);
  } catch (error) {
    console.error('Create PDV error:', error);
    return errorResponse('Erreur serveur', 500);
  }
}
