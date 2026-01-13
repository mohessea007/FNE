import prisma from '@/lib/prisma';
import { validateApiKey } from '@/lib/auth';
import { validate, updatePointDeVenteSchema } from '@/lib/validations';
import { 
  successResponse, 
  errorResponse, 
  notFoundResponse,
  validationErrorResponse, 
  unauthorizedResponse,
  parseJsonBody,
  getApiKeyFromHeaders
} from '@/lib/api-utils';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT /api/v1/pointdeventes/:id
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
    const pdvId = parseInt(id);

    const existingPdv = await prisma.pointDeVente.findFirst({
      where: {
        id: pdvId,
        uid_companie: company.uid_companie,
      },
    });

    if (!existingPdv) {
      return notFoundResponse('Point de vente non trouvé');
    }

    const body = await parseJsonBody(request);
    if (!body) {
      return errorResponse('Corps de requête invalide', 400);
    }

    const validation = validate(updatePointDeVenteSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    // If setting as default, unset other defaults
    if (validation.data.is_default) {
      await prisma.pointDeVente.updateMany({
        where: { 
          uid_companie: company.uid_companie,
          id: { not: pdvId },
        },
        data: { is_default: false },
      });
    }

    const updatedPdv = await prisma.pointDeVente.update({
      where: { id: pdvId },
      data: validation.data,
    });

    return successResponse(updatedPdv, 'Point de vente mis à jour avec succès');
  } catch (error) {
    console.error('Update PDV error:', error);
    return errorResponse('Erreur serveur', 500);
  }
}

// DELETE /api/v1/pointdeventes/:id
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
    const pdvId = parseInt(id);

    const existingPdv = await prisma.pointDeVente.findFirst({
      where: {
        id: pdvId,
        uid_companie: company.uid_companie,
      },
    });

    if (!existingPdv) {
      return notFoundResponse('Point de vente non trouvé');
    }

    if (existingPdv.is_default) {
      return errorResponse('Impossible de supprimer le point de vente par défaut', 400);
    }

    // Soft delete
    await prisma.pointDeVente.update({
      where: { id: pdvId },
      data: { is_active: false },
    });

    return successResponse(null, 'Point de vente supprimé avec succès');
  } catch (error) {
    console.error('Delete PDV error:', error);
    return errorResponse('Erreur serveur', 500);
  }
}
