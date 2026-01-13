import prisma from '@/lib/prisma';
import { validateApiKey } from '@/lib/auth';
import { 
  successResponse, 
  errorResponse, 
  unauthorizedResponse,
  getApiKeyFromHeaders
} from '@/lib/api-utils';

// GET /api/v1/stats - Get company stats
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

    const [
      totalInvoices,
      totalRefunds,
      totalClients,
      totalPointsDeVente,
      invoicesByType,
      invoicesByStatus,
      recentInvoices,
      successLogs,
      errorLogs,
    ] = await Promise.all([
      prisma.invoice.count({ where: { uid_companie: company.uid_companie, is_refund: false } }),
      prisma.invoice.count({ where: { uid_companie: company.uid_companie, is_refund: true } }),
      prisma.client.count({ where: { uid_companie: company.uid_companie, is_active: true } }),
      prisma.pointDeVente.count({ where: { uid_companie: company.uid_companie, is_active: true } }),
      prisma.invoice.groupBy({
        by: ['type_invoice'],
        where: { uid_companie: company.uid_companie },
        _count: true,
      }),
      prisma.invoice.groupBy({
        by: ['status'],
        where: { uid_companie: company.uid_companie },
        _count: true,
      }),
      prisma.invoice.findMany({
        where: { uid_companie: company.uid_companie },
        include: {
          client: { select: { clientCompanyName: true } },
          items: true,
        },
        take: 10,
        orderBy: { date_creation: 'desc' },
      }),
      prisma.invoiceLog.count({ where: { uid_companie: company.id, code_response: '201' } }),
      prisma.invoiceLog.count({ where: { uid_companie: company.id, NOT: { code_response: '201' } } }),
    ]);

    return successResponse({
      totalInvoices,
      totalRefunds,
      totalClients,
      totalPointsDeVente,
      invoicesByType: invoicesByType.map(item => ({
        type_invoice: item.type_invoice,
        count: item._count,
      })),
      invoicesByStatus: invoicesByStatus.map(item => ({
        status: item.status,
        count: item._count,
      })),
      logs: {
        success: successLogs,
        error: errorLogs,
        total: successLogs + errorLogs,
      },
      recentInvoices,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    return errorResponse('Erreur serveur', 500);
  }
}
