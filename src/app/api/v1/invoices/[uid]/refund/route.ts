import prisma from '@/lib/prisma';
import { validateApiKey, generateUID } from '@/lib/auth';
import { validate, createRefundSchema } from '@/lib/validations';
import { refundInvoice, parseFNEToken } from '@/lib/fne';
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
  params: Promise<{ uid: string }>;
}

// POST /api/v1/invoices/:uid/refund - Create refund for invoice
export async function POST(request: Request, { params }: RouteParams) {
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

    // Get original invoice with received items from FNE
    const originalInvoice = await prisma.invoice.findFirst({
      where: {
        uid_invoice: uid,
        uid_companie: company.uid_companie,
      },
      include: {
        items: true,
        itemsReceved: true, // Inclure les articles reçus de la FNE
        refunds: {
          where: { status: 'refunded' }, // Seulement les remboursements réussis
        },
        client: true,
        pointdevente: true,
      },
    });

    if (!originalInvoice) {
      return notFoundResponse('Facture originale non trouvée');
    }

    const fneInvoiceId = (originalInvoice as any).fne_invoice_id;
    if (!fneInvoiceId) {
      return errorResponse('La facture originale n\'a pas d\'UUID FNE. La facture doit être re-certifiée.', 400);
    }

    if (originalInvoice.is_refund) {
      return errorResponse('Impossible de créer un avoir sur un avoir', 400);
    }

    // Vérifier qu'il n'y a pas déjà un avoir réussi créé pour cette facture
    // On ne compte que les remboursements réussis (status === 'refunded')
    const successfulRefunds = originalInvoice.refunds?.filter((refund: any) => refund.status === 'refunded') || [];
    if (successfulRefunds.length > 0) {
      return errorResponse('Cette facture a déjà été remboursée avec succès', 400);
    }

    // Vérifier aussi le statut de la facture originale
    if (originalInvoice.status === 'refunded') {
      return errorResponse('Cette facture a déjà été marquée comme remboursée', 400);
    }

    const body = await parseJsonBody(request);
    if (!body) {
      return errorResponse('Corps de requête invalide', 400);
    }

    const validation = validate(createRefundSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const { items } = validation.data;

    // Vérifier que les items demandés existent dans les articles reçus de la FNE
    // Les articles reçus sont liés à la facture via invoice_id
    const recevedItems = originalInvoice.itemsReceved || [];
    
    if (recevedItems.length === 0) {
      return errorResponse(
        'Aucun article trouvé pour cette facture. La facture doit être re-certifiée pour pouvoir être remboursée.',
        400
      );
    }

    // Vérifier que tous les fne_item_id sont des UUIDs valides
    // Convertir en string pour s'assurer du type correct
    const invalidUuidItems = recevedItems.filter(ri => {
      const fneItemId = String(ri.fne_item_id || '');
      return !fneItemId || !fneItemId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    if (invalidUuidItems.length > 0) {
      return errorResponse(
        `Les articles de cette facture ont des données invalides. La facture doit être re-certifiée pour mettre à jour les données avec les UUIDs corrects. Facture UID: ${originalInvoice.uid_invoice}`,
        400
      );
    }

    // Vérifier que chaque item demandé correspond à un article reçu
    // Convertir en string pour la comparaison
    const invalidItems = items.filter(item => 
      !recevedItems.some(ri => String(ri.fne_item_id) === String(item.id))
    );

    if (invalidItems.length > 0) {
      return errorResponse(
        `Articles invalides pour le remboursement. Les articles doivent avoir un ID FNE valide. Articles invalides: ${invalidItems.map(i => i.id).join(', ')}`,
        400
      );
    }

    // Vérifier les quantités disponibles et construire les items avec les UUIDs corrects
    const quantityErrors: string[] = [];
    const itemsToRefund = items.map(item => {
      const recevedItem = recevedItems.find(ri => String(ri.fne_item_id) === String(item.id));
      if (!recevedItem) {
        quantityErrors.push(`Article avec ID ${item.id} non trouvé dans les articles reçus`);
        return null;
      }
      if (item.quantity > recevedItem.quantity) {
        quantityErrors.push(
          `Quantité demandée (${item.quantity}) supérieure à la quantité disponible (${recevedItem.quantity}) pour l'article ${recevedItem.reference}`
        );
        return null;
      }
      // Utiliser l'UUID depuis itemsReceved.fne_item_id (convertir en string)
      return {
        id: String(recevedItem.fne_item_id), // UUID depuis items_invoices_receved.fne_item_id
        quantity: item.quantity,
      };
    }).filter((item): item is { id: string; quantity: number } => item !== null);

    if (quantityErrors.length > 0) {
      return errorResponse(quantityErrors.join('; '), 400);
    }

    // Call FNE refund API avec l'UUID de la facture (pas la référence)
    const fneResponse = await refundInvoice(
      fneInvoiceId!, // UUID de la facture FNE (pour l'URL)
      itemsToRefund, // Items avec les UUIDs depuis itemsReceved.fne_item_id
      company.token_fne
    );

    // Ne créer l'avoir que si le remboursement réussit
    if (!fneResponse.success || !fneResponse.data) {
      // Créer seulement un log pour l'échec
      await prisma.invoiceLog.create({
        data: {
          uid_companie: company.id,
          pointdeventeid: originalInvoice.pointdeventeid,
          uid_invoice: originalInvoice.id,
          data_send: { originalInvoiceId: fneInvoiceId, items },
          data_receved: fneResponse.data || {},
          code_response: fneResponse.code,
          msg_response: fneResponse.message,
          userid: 0,
          token_receced: null,
        },
      });

      return errorResponse(
        fneResponse.message || 'Erreur lors de la création de l\'avoir',
        400
      );
    }

    // Parse FNE response (seulement si succès)
    const fneReference = fneResponse.data.reference || fneResponse.data.invoice?.reference;
    const rawToken = fneResponse.data.token || fneResponse.data.invoice?.token;
    let fneToken = null;
    let fneTokenValue = null;
    
    if (rawToken) {
      const parsed = parseFNEToken(rawToken);
      fneToken = parsed.url;
      fneTokenValue = parsed.value;
    }

    const uid_invoice = generateUID();

    // Create refund invoice (seulement si le remboursement a réussi)
    const refundInvoiceData = await prisma.invoice.create({
      data: {
        uid_companie: company.uid_companie,
        pointdeventeid: originalInvoice.pointdeventeid,
        clientid: originalInvoice.clientid,
        uid_invoice,
        remise_montant: 0,
        remise_taux: 0,
        type_invoice: originalInvoice.type_invoice,
        paymentMethod: originalInvoice.paymentMethod,
        clientSellerName: originalInvoice.clientSellerName,
        is_refund: true,
        original_invoice_id: originalInvoice.id,
        fne_reference: fneReference,
        fne_token: fneToken,
        fne_token_value: fneTokenValue,
        status: 'refunded', // Toujours 'refunded' car on ne crée l'avoir que si succès
        items: {
          create: itemsToRefund.map(item => {
            // Utiliser les articles reçus de la FNE (liés via invoice_id)
            const recevedItem = recevedItems.find(ri => String(ri.fne_item_id) === String(item.id));
            if (!recevedItem) {
              throw new Error(`Article avec UUID ${item.id} non trouvé dans itemsReceved`);
            }
            
            // Trouver l'item original de la facture pour récupérer les taxes
            const originalItem = originalInvoice.items.find(i => i.reference === recevedItem.reference);
            
            return {
              uid_companie: company.uid_companie,
              reference: recevedItem.reference,
              description: recevedItem.description || 'Avoir',
              quantity: -item.quantity, // Negative for refund
              amount: Number(recevedItem.amount),
              discount: Number(recevedItem.discount),
              measurementUnit: recevedItem.measurementUnit,
              taxes: originalItem?.taxes || '',
              customTaxesname: originalItem?.customTaxesname || '',
              customTaxesamount: originalItem?.customTaxesamount || 0,
              fne_item_id: item.id, // UUID de l'article FNE
            };
          }),
        },
      },
      include: {
        items: true,
        client: true,
        pointdevente: true,
      },
    });

    // Create log
    await prisma.invoiceLog.create({
      data: {
        uid_companie: company.id,
        pointdeventeid: originalInvoice.pointdeventeid,
        uid_invoice: refundInvoiceData.id,
        data_send: { originalInvoiceId: originalInvoice.fne_invoice_id, items },
        data_receved: fneResponse.data || {},
        code_response: fneResponse.code,
        msg_response: fneResponse.message,
        userid: 0,
        token_receced: fneToken,
      },
    });

    // Mettre à jour le statut de la facture originale (on est ici seulement si succès)
    await prisma.invoice.update({
      where: { id: originalInvoice.id },
      data: { status: 'refunded' },
    });

    // Get updated refund invoice
    const updatedRefund = await prisma.invoice.findUnique({
      where: { id: refundInvoiceData.id },
      include: {
        items: true,
        client: true,
        pointdevente: true,
        logs: true,
      },
    });

    return successResponse({
      refund: updatedRefund,
      originalInvoice: {
        id: originalInvoice.id,
        uid_invoice: originalInvoice.uid_invoice,
        fne_reference: originalInvoice.fne_reference,
      },
      fne_response: {
        success: fneResponse.success,
        status: parseInt(fneResponse.code),
        data: fneResponse.success ? fneResponse.data : null,
        error: !fneResponse.success ? { code: fneResponse.code, message: fneResponse.message } : null,
      },
    }, fneResponse.success ? 'Avoir créé avec succès' : 'Avoir créé mais certification échouée', 201);
  } catch (error) {
    console.error('Create refund error:', error);
    return errorResponse('Erreur serveur', 500);
  }
}
