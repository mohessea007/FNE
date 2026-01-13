import prisma from '@/lib/prisma';
import { validateApiKey } from '@/lib/auth';
import { 
  successResponse, 
  errorResponse, 
  notFoundResponse,
  unauthorizedResponse,
  getApiKeyFromHeaders
} from '@/lib/api-utils';

interface RouteParams {
  params: Promise<{ uid: string }>;
}

// GET /api/v1/invoices/:uid
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

    const { uid } = await params;

    const invoice = await prisma.invoice.findFirst({
      where: {
        uid_invoice: uid,
        uid_companie: company.uid_companie,
      },
      include: {
        client: true,
        pointdevente: true,
        items: true,
        logs: {
          orderBy: { date_creation: 'desc' },
        },
        refunds: {
          include: {
            items: true,
            logs: true,
          },
        },
      },
    });

    if (!invoice) {
      return notFoundResponse('Facture non trouvée');
    }

    return successResponse(invoice);
  } catch (error) {
    console.error('Get invoice error:', error);
    return errorResponse('Erreur serveur', 500);
  }
}
