import prisma from '@/lib/prisma';
import { validateApiKey } from '@/lib/auth';
import { validate, createClientSchema } from '@/lib/validations';
import { 
  successResponse, 
  errorResponse, 
  validationErrorResponse, 
  unauthorizedResponse,
  parseJsonBody,
  getApiKeyFromHeaders
} from '@/lib/api-utils';
import { ClientType } from '@prisma/client';

// GET /api/v1/clients - List clients
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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where: { uid_companie: company.uid_companie, is_active: true },
        include: {
          pointdevente: {
            select: { id: true, nom: true },
          },
        },
        skip,
        take: limit,
        orderBy: { date_creation: 'desc' },
      }),
      prisma.client.count({
        where: { uid_companie: company.uid_companie, is_active: true },
      }),
    ]);

    return successResponse({
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      clients,
    });
  } catch (error) {
    console.error('List clients error:', error);
    return errorResponse('Erreur serveur', 500);
  }
}

// POST /api/v1/clients - Create client
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

    const validation = validate(createClientSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const { pointdeventeid, clientEmail, ...clientData } = validation.data;

    // Verify point de vente belongs to company
    const pdv = await prisma.pointDeVente.findFirst({
      where: {
        id: pointdeventeid,
        uid_companie: company.uid_companie,
      },
    });

    if (!pdv) {
      return errorResponse('Point de vente non trouvé', 404);
    }

    // Convertir clientEmail en string | null pour Prisma
    const clientEmailValue = clientEmail === null || clientEmail === undefined || clientEmail === '' 
      ? null 
      : (typeof clientEmail === 'string' ? clientEmail : null);

    // Créer le client
    const client = await prisma.client.create({
      data: {
        uid_companie: company.uid_companie,
        pointdeventeid,
        ...clientData,
        clientEmail: clientEmailValue,
        type_client: clientData.type_client as ClientType,
      },
      include: {
        pointdevente: {
          select: { id: true, nom: true },
        },
      },
    });

    return successResponse(client, 'Client créé avec succès', 201);
  } catch (error) {
    console.error('Create client error:', error);
    return errorResponse('Erreur serveur', 500);
  }
}
