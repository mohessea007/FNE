import prisma from '@/lib/prisma';
import { getCurrentUser, isCompanyLevel } from '@/lib/auth';
import { certifyInvoice, parseFNEToken, FNEInvoiceData, convertTaxToFNEFormat } from '@/lib/fne';
import { successResponse, errorResponse, notFoundResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils';
import { saveFNEItems, updateItemInvoiceFNEIds } from '@/lib/invoice-items';

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function getCompanyUid(user: any) {
  if (!user.companieid) return null;
  const company = await prisma.company.findUnique({ where: { id: user.companieid } });
  return company?.uid_companie || null;
}

// POST /api/company/invoices/:id/certify - Certify an invoice
export async function POST(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (!isCompanyLevel(user.type_user)) return forbiddenResponse();

  const uid_companie = await getCompanyUid(user);
  if (!uid_companie) return forbiddenResponse();

  const { id } = await params;
  const invoiceId = parseInt(id);

  // Récupérer la facture avec toutes les informations nécessaires
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      company: true,
      client: true,
      pointdevente: true,
      items: true,
    },
  });

  if (!invoice) return notFoundResponse('Facture non trouvée');
  
  // Vérifier que la facture appartient à l'entreprise de l'utilisateur
  if (invoice.uid_companie !== uid_companie) {
    return forbiddenResponse('Vous n\'avez pas accès à cette facture');
  }

  if (invoice.status === 'certified') return errorResponse('Facture déjà certifiée', 400);
  if (invoice.is_refund) return errorResponse('Les avoirs ne peuvent pas être certifiés manuellement', 400);
  if (invoice.type_invoice !== 'sale' && invoice.type_invoice !== 'purchase') {
    return errorResponse('Type de facture invalide pour la certification', 400);
  }

  // Préparer les données pour FNE
  const fneData: FNEInvoiceData = {
    invoiceType: invoice.type_invoice,
    paymentMethod: invoice.paymentMethod,
    template: invoice.client.type_client,
    clientNcc: invoice.client.ncc || '',
    clientCompanyName: invoice.client.clientCompanyName || '',
    clientPhone: invoice.client.clientPhone || '',
    clientEmail: invoice.client.clientEmail || '',
    clientSellerName: invoice.clientSellerName,
    pointOfSale: invoice.pointdevente.nom,
    establishment: invoice.company.nom,
    commercialMessage: invoice.company.commercialMessage,
    footer: invoice.company.footer,
      items: invoice.items.map(item => {
        // Pour les factures de type "purchase", ne pas inclure taxes ni customTaxes
        const baseItem = {
          reference: item.reference,
          description: item.description,
          quantity: item.quantity,
          amount: item.amount,
          discount: item.discount || 0,
          measurementUnit: item.measurementUnit,
        };
        
        // Ajouter taxes et customTaxes seulement pour les factures de type "sale"
        if (invoice.type_invoice === 'sale') {
          return {
            ...baseItem,
            taxes: convertTaxToFNEFormat(item.taxes),
            customTaxes: item.customTaxesname ? [{ name: item.customTaxesname, amount: item.customTaxesamount || 0 }] : undefined,
          };
        }
        
        return baseItem;
      }),
  };

  // Appeler l'API FNE avec le token de l'entreprise
  const fneResponse = await certifyInvoice(fneData, invoice.company.token_fne);

  // Parser la réponse FNE
  let fneReference = null;
  let fneInvoiceId = null; // UUID de la facture FNE (pour les remboursements)
  let fneToken = null;
  let fneTokenValue = null;
  let status: 'certified' | 'rejected' = 'rejected';

  if (fneResponse.success && fneResponse.data) {
    fneReference = fneResponse.data.reference || fneResponse.data.invoice?.reference;
    fneInvoiceId = fneResponse.data.id || fneResponse.data.invoice?.id;
    const rawToken = fneResponse.data.token || fneResponse.data.invoice?.token;
    if (rawToken) {
      const parsed = parseFNEToken(rawToken);
      fneToken = parsed.url;
      fneTokenValue = parsed.value;
    }
    status = 'certified';

    // Mettre à jour la facture avec les données FNE
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        fne_reference: fneReference,
        fne_invoice_id: fneInvoiceId,
        fne_token: fneToken,
        fne_token_value: fneTokenValue,
        status,
      },
    });

    // Mettre à jour les IDs FNE des items dans ItemInvoice
    const fneItems = fneResponse.data.items || fneResponse.data.invoice?.items || [];
    if (fneItems.length > 0) {
      await updateItemInvoiceFNEIds(invoiceId, fneItems);
    }

    // Enregistrer les articles reçus de la FNE pour le remboursement
    await saveFNEItems(invoiceId, fneResponse.data);
  } else {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'rejected' },
    });
  }

  // Créer un log
  await prisma.invoiceLog.create({
    data: {
      uid_companie: invoice.company.id,
      pointdeventeid: invoice.pointdeventeid,
      uid_invoice: invoiceId,
      data_send: fneData as any,
      data_receved: fneResponse.data || {},
      code_response: fneResponse.code,
      msg_response: fneResponse.message,
      userid: user.id,
      token_receced: fneToken,
    },
  });

  // Récupérer la facture mise à jour
  const updatedInvoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      company: { select: { id: true, nom: true, uid_companie: true } },
      client: { select: { id: true, clientCompanyName: true, ncc: true } },
      pointdevente: { select: { id: true, nom: true } },
      items: true,
      logs: { orderBy: { date_creation: 'desc' } },
    },
  });

  return successResponse({
    invoice: updatedInvoice,
    fne_response: {
      success: fneResponse.success,
      status: parseInt(fneResponse.code),
      data: fneResponse.success ? fneResponse.data : null,
      error: !fneResponse.success ? { code: fneResponse.code, message: fneResponse.message } : null,
    },
  }, fneResponse.success ? 'Facture certifiée avec succès' : 'Certification échouée');
}

