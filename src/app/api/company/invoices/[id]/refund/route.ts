import prisma from '@/lib/prisma';
import { getCurrentUser, isCompanyLevel, generateUID } from '@/lib/auth';
import { refundInvoice, parseFNEToken } from '@/lib/fne';
import { validate, createRefundSchema } from '@/lib/validations';
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, validationErrorResponse, notFoundResponse, parseJsonBody } from '@/lib/api-utils';

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function getCompanyUid(user: any) {
  if (!user.companieid) return null;
  const company = await prisma.company.findUnique({ where: { id: user.companieid } });
  return company?.uid_companie || null;
}

// POST /api/company/invoices/:id/refund - Create refund for invoice
export async function POST(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (!isCompanyLevel(user.type_user)) return forbiddenResponse();

  const uid_companie = await getCompanyUid(user);
  if (!uid_companie) return forbiddenResponse();

  const { id } = await params;
  const invoiceId = parseInt(id);

  try {
    // Get original invoice with received items from FNE
    const originalInvoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        uid_companie,
      },
      include: {
        items: true,
        itemsReceved: true, // Inclure les articles reçus de la FNE
        client: true,
        pointdevente: true,
        company: true,
        refunds: true,
      },
    });

    if (!originalInvoice) {
      return notFoundResponse('Facture originale non trouvée');
    }

    // Vérifier que la facture est certifiée (et non déjà remboursée)
    if (originalInvoice.status !== 'certified') {
      if (originalInvoice.status === 'refunded') {
        return errorResponse('Cette facture a déjà été remboursée', 400);
      }
      return errorResponse('Seules les factures certifiées peuvent être remboursées', 400);
    }

    // Vérifier que ce n'est pas déjà un avoir
    if (originalInvoice.is_refund) {
      return errorResponse('Impossible de créer un avoir sur un avoir', 400);
    }

    // Vérifier qu'il n'y a pas déjà un avoir réussi créé pour cette facture
    // On ne compte que les remboursements réussis (status === 'refunded')
    const successfulRefunds = originalInvoice.refunds?.filter((refund: any) => refund.status === 'refunded') || [];
    if (successfulRefunds.length > 0) {
      return errorResponse('Cette facture a déjà été remboursée avec succès', 400);
    }

    if (!(originalInvoice as any).fne_invoice_id) {
      return errorResponse('La facture originale n\'a pas d\'UUID FNE. La facture doit être re-certifiée.', 400);
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

    // Log pour déboguer AVANT la validation
    console.log('Items reçus pour remboursement (types):', recevedItems.map(ri => ({ 
      fne_item_id: ri.fne_item_id, 
      fne_item_id_type: typeof ri.fne_item_id,
      fne_item_id_string: String(ri.fne_item_id),
      reference: ri.reference 
    })));

    // Vérifier que tous les fne_item_id sont des UUIDs valides
    // Convertir en string pour s'assurer du type correct
    const invalidUuidItems = recevedItems.filter(ri => {
      const fneItemId = String(ri.fne_item_id || '');
      const isValid = fneItemId && fneItemId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      if (!isValid) {
        console.warn('UUID invalide détecté:', { fne_item_id: ri.fne_item_id, reference: ri.reference, stringValue: fneItemId });
      }
      return !isValid;
    });

    if (invalidUuidItems.length > 0) {
      console.error('Articles avec UUIDs invalides détectés:', invalidUuidItems.map(ri => ({ 
        fne_item_id: ri.fne_item_id, 
        type: typeof ri.fne_item_id,
        stringValue: String(ri.fne_item_id),
        reference: ri.reference 
      })));
      return errorResponse(
        `Les articles de cette facture ont des données invalides. La facture doit être re-certifiée pour mettre à jour les données avec les UUIDs corrects. Facture ID: ${originalInvoice.id}`,
        400
      );
    }

    console.log('✅ Validation UUIDs réussie pour tous les items');

    // Log pour déboguer
    console.log('Items reçus pour remboursement:', recevedItems.map(ri => ({ fne_item_id: String(ri.fne_item_id), reference: ri.reference })));
    console.log('Items demandés:', items);

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

    // Log pour vérifier les items envoyés
    console.log('Items à envoyer à FNE pour remboursement:', itemsToRefund);

    // Log avant l'appel à FNE
    const fneInvoiceId = (originalInvoice as any).fne_invoice_id;
    console.log('Appel à l\'API FNE pour remboursement:');
    console.log('- UUID facture FNE:', fneInvoiceId);
    console.log('- Référence facture FNE:', originalInvoice.fne_reference);
    console.log('- Items à rembourser:', itemsToRefund);

    // Call FNE refund API avec l'UUID de la facture (pas la référence)
    const fneResponse = await refundInvoice(
      fneInvoiceId!, // UUID de la facture FNE (pour l'URL)
      itemsToRefund, // Items avec les UUIDs depuis itemsReceved.fne_item_id
      originalInvoice.company.token_fne
    );

    // Log de la réponse FNE
    console.log('Réponse FNE remboursement:', {
      success: fneResponse.success,
      code: fneResponse.code,
      message: fneResponse.message,
      data: fneResponse.data,
    });

    // Ne créer l'avoir que si le remboursement réussit
    if (!fneResponse.success || !fneResponse.data) {
      // Créer seulement un log pour l'échec
      await prisma.invoiceLog.create({
        data: {
          uid_companie: originalInvoice.company.id,
          pointdeventeid: originalInvoice.pointdeventeid,
          uid_invoice: originalInvoice.id,
          data_send: { originalInvoiceId: fneInvoiceId, items: itemsToRefund },
          data_receved: fneResponse.data || {},
          code_response: fneResponse.code,
          msg_response: fneResponse.message,
          userid: user.id,
          token_receced: null,
        },
      });

      // Retourner le message d'erreur de FNE
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
        uid_companie: originalInvoice.uid_companie,
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
              uid_companie: originalInvoice.uid_companie,
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
        uid_companie: originalInvoice.company.id,
        pointdeventeid: originalInvoice.pointdeventeid,
        uid_invoice: refundInvoiceData.id,
        data_send: { originalInvoiceId: fneInvoiceId, items },
        data_receved: fneResponse.data || {},
        code_response: fneResponse.code,
        msg_response: fneResponse.message,
        userid: user.id,
        token_receced: fneToken,
      },
    });

    // Update original invoice status (always 'refunded' since we only create refund invoice on success)
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
        status: 'refunded',
      },
      fne_response: {
        success: true,
        status: parseInt(fneResponse.code),
        data: fneResponse.data,
      },
    }, 'Avoir créé avec succès', 201);
  } catch (error) {
    console.error('Create refund error:', error);
    return errorResponse('Erreur serveur', 500);
  }
}

