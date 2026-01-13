import prisma from '@/lib/prisma';
import { validateApiKey } from '@/lib/auth';
import { validate, updateClientSchema } from '@/lib/validations';
import { 
  successResponse, 
  errorResponse, 
  notFoundResponse,
  validationErrorResponse, 
  unauthorizedResponse,
  parseJsonBody,
  getApiKeyFromHeaders
} from '@/lib/api-utils';
import { ClientType } from '@prisma/client';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/v1/clients/:id
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const apiKey = getApiKeyFromHeaders(request);
    if (!apiKey) {
      return unauthorizedResponse('Clé API manquante');
    }

    const company = await validateApiKey(apiKey);
    if (!company) {
      return unauthorizedResponse('Clé API invalide');
    }

    const { id } = await params;
    const clientId = parseInt(id);

    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        uid_companie: company.uid_companie,
      },
      include: {
        pointdevente: true,
        invoices: {
          take: 10,
          orderBy: { date_creation: 'desc' },
        },
      },
    });

    if (!client) {
      return notFoundResponse('Client non trouvé');
    }

    return successResponse(client);
  } catch (error) {
    console.error('Get client error:', error);
    return errorResponse('Erreur serveur', 500);
  }
}

// PUT /api/v1/clients/:id
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const apiKey = getApiKeyFromHeaders(request);
    if (!apiKey) {
      return unauthorizedResponse('Clé API manquante');
    }

    const company = await validateApiKey(apiKey);
    if (!company) {
      return unauthorizedResponse('Clé API invalide');
    }

    const { id } = await params;
    const clientId = parseInt(id);

    const existingClient = await prisma.client.findFirst({
      where: {
        id: clientId,
        uid_companie: company.uid_companie,
      },
    });

    if (!existingClient) {
      return notFoundResponse('Client non trouvé');
    }

    const body = await parseJsonBody(request);
    if (!body) {
      return errorResponse('Corps de requête invalide', 400);
    }

    const validation = validate(updateClientSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    // If pointdeventeid is provided, verify it belongs to company
    if (validation.data.pointdeventeid) {
      const pdv = await prisma.pointDeVente.findFirst({
        where: {
          id: validation.data.pointdeventeid,
          uid_companie: company.uid_companie,
        },
      });

      if (!pdv) {
        return errorResponse('Point de vente non trouvé', 404);
      }
    }

    const updateData = validation.data as any;
    if (updateData.type_client) {
      updateData.type_client = updateData.type_client as ClientType;
    }

    const updatedClient = await prisma.client.update({
      where: { id: clientId },
      data: updateData,
      include: {
        pointdevente: {
          select: { id: true, nom: true },
        },
      },
    });

    return successResponse(updatedClient, 'Client mis à jour avec succès');
  } catch (error) {
    console.error('Update client error:', error);
    return errorResponse('Erreur serveur', 500);
  }
}

// DELETE /api/v1/clients/:id
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const apiKey = getApiKeyFromHeaders(request);
    if (!apiKey) {
      return unauthorizedResponse('Clé API manquante');
    }

    const company = await validateApiKey(apiKey);
    if (!company) {
      return unauthorizedResponse('Clé API invalide');
    }

    const { id } = await params;
    const clientId = parseInt(id);

    const existingClient = await prisma.client.findFirst({
      where: {
        id: clientId,
        uid_companie: company.uid_companie,
      },
    });

    if (!existingClient) {
      return notFoundResponse('Client non trouvé');
    }

    // Soft delete
    await prisma.client.update({
      where: { id: clientId },
      data: { is_active: false },
    });

    return successResponse(null, 'Client supprimé avec succès');
  } catch (error) {
    console.error('Delete client error:', error);
    return errorResponse('Erreur serveur', 500);
  }
}
