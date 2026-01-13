import prisma from '@/lib/prisma';
import { getCurrentUser, isCompanyLevel, isAdminLevel, generateUID } from '@/lib/auth';
import { certifyInvoice, parseFNEToken, FNEInvoiceData, convertTaxToFNEFormat } from '@/lib/fne';
import { saveFNEItems, updateItemInvoiceFNEIds } from '@/lib/invoice-items';
import { validate, createInvoiceSchema } from '@/lib/validations';
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, validationErrorResponse, notFoundResponse, parseJsonBody } from '@/lib/api-utils';

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function getCompanyUid(user: any) {
  if (!user.companieid) return null;
  const company = await prisma.company.findUnique({ where: { id: user.companieid } });
  return company?.uid_companie || null;
}

// GET /api/company/invoices/:id - Get invoice details with errors
export async function GET(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (!isCompanyLevel(user.type_user) && !isAdminLevel(user.type_user)) return forbiddenResponse();

  const uid_companie = await getCompanyUid(user);
  if (!uid_companie) return forbiddenResponse();

  const { id } = await params;
  const invoiceId = parseInt(id);

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      uid_companie,
    },
    include: {
      company: {
        select: {
          id: true,
          nom: true,
          uid_companie: true,
        },
      },
      client: true,
      pointdevente: true,
      items: true,
      itemsReceved: true, // Inclure les articles reçus de la FNE
      refunds: {
        where: { status: 'refunded' }, // Seulement les remboursements réussis
      },
      originalInvoice: {
        select: {
          id: true,
          fne_reference: true,
          uid_invoice: true,
        },
      },
      logs: {
        orderBy: { date_creation: 'desc' },
        take: 1,
      },
    },
  });

  if (!invoice) return notFoundResponse('Facture non trouvée');

  // Récupérer le dernier log pour les erreurs
  const lastLog = invoice.logs[0];
  const errorMessage = lastLog && invoice.status === 'rejected' ? lastLog.msg_response : null;

  return successResponse({
    invoice,
    error: errorMessage ? {
      code: lastLog.code_response,
      message: errorMessage,
      details: lastLog.data_receved,
    } : null,
  });
}

// PUT /api/company/invoices/:id - Update and recertify invoice
export async function PUT(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (!isCompanyLevel(user.type_user) && !isAdminLevel(user.type_user)) return forbiddenResponse();

  const uid_companie = await getCompanyUid(user);
  if (!uid_companie) return forbiddenResponse();

  const { id } = await params;
  const invoiceId = parseInt(id);

  // Vérifier que la facture existe et appartient à l'entreprise
  const existingInvoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      uid_companie,
    },
    include: {
      client: true,
      pointdevente: true,
      company: true,
      items: true,
    },
  });

  if (!existingInvoice) return notFoundResponse('Facture non trouvée');
  if (existingInvoice.status === 'certified') return errorResponse('Impossible de modifier une facture certifiée', 400);
  if (existingInvoice.is_refund) return errorResponse('Impossible de modifier un avoir', 400);

  const body = await parseJsonBody(request);
  if (!body) return errorResponse('Corps de requête invalide', 400);

  const validation = validate(createInvoiceSchema, body);
  if (!validation.success) return validationErrorResponse(validation.errors);

  const { 
    clientid, 
    pointdeventeid, 
    type_invoice, 
    paymentMethod, 
    clientSellerName,
    remise_taux,
    items 
  } = validation.data;

  try {
    // Verify client belongs to company
    const client = await prisma.client.findFirst({
      where: {
        id: clientid,
        uid_companie,
      },
    });

    if (!client) {
      return errorResponse('Client non trouvé', 404);
    }

    // Verify point de vente belongs to company
    const pdv = await prisma.pointDeVente.findFirst({
      where: {
        id: pointdeventeid,
        uid_companie,
      },
    });

    if (!pdv) {
      return errorResponse('Point de vente non trouvé', 404);
    }

    const company = existingInvoice.company;

    // Vérifier que le type de facture est valide (narrowing pour TypeScript)
    if (type_invoice !== 'sale' && type_invoice !== 'purchase') {
      return errorResponse('Type de facture invalide. Le type doit être \"sale\" ou \"purchase\".', 400);
    }

    // Vérifier que paymentMethod est défini (avec valeur par défaut du schéma)
    const finalPaymentMethod = paymentMethod || 'cash';
    // Vérifier que clientSellerName est défini (avec valeur par défaut du schéma)
    const finalClientSellerName = clientSellerName || '';

    // Vérifier que la TVA est présente pour les factures de vente
    if (type_invoice === 'sale') {
      for (const item of items) {
        const taxValue = typeof item.taxes === 'string' ? item.taxes : (Array.isArray(item.taxes) ? item.taxes[0] : '');
        if (!taxValue || (taxValue !== 'TVA18' && taxValue !== 'TVAB9' && taxValue !== 'TVAC0' && taxValue !== 'TVA' && taxValue !== 'TVAB' && taxValue !== 'TVAC')) {
          return errorResponse('La TVA est obligatoire pour les factures de vente. Chaque article doit avoir TVA 18%, TVAB 9% ou TVAC 0%.', 400);
        }
      }
    }

    // Préparer les données pour FNE
    const fneData: FNEInvoiceData = {
      invoiceType: type_invoice,
      paymentMethod: finalPaymentMethod,
      template: client.type_client,
      clientNcc: client.ncc || '',
      clientCompanyName: client.clientCompanyName || '',
      clientPhone: client.clientPhone || '',
      clientEmail: client.clientEmail || '',
      clientSellerName: finalClientSellerName,
      pointOfSale: pdv.nom,
      establishment: company.nom,
      commercialMessage: company.commercialMessage,
      footer: company.footer,
      items: items.map(item => {
        // Pour les factures de type "purchase", ne pas inclure taxes ni customTaxes
        const baseItem = {
          reference: item.reference,
          description: item.description,
          quantity: item.quantity,
          amount: item.amount,
          discount: item.discount || 0,
          measurementUnit: item.measurementUnit || 'pcs',
        };
        
        // Ajouter taxes et customTaxes seulement pour les factures de type "sale"
        if (type_invoice === 'sale') {
          return {
            ...baseItem,
            taxes: convertTaxToFNEFormat(item.taxes),
            customTaxes: (item.customTaxes && item.customTaxes.length > 0) 
              ? item.customTaxes.filter(ct => ct.name && ct.amount > 0) 
              : undefined,
          };
        }
        
        return baseItem;
      }),
    };

    // Call FNE API to certify FIRST - only update invoice if certification succeeds
    const fneResponse = await certifyInvoice(fneData, company.token_fne);

    // Parse FNE response
    let fneReference = null;
    let fneInvoiceId = null; // UUID de la facture FNE (pour les remboursements)
    let fneToken = null;
    let fneTokenValue = null;

    // Only update invoice if FNE certification succeeded
    if (fneResponse.success && fneResponse.data) {
      fneReference = fneResponse.data.reference || fneResponse.data.invoice?.reference;
      fneInvoiceId = fneResponse.data.id || fneResponse.data.invoice?.id;
      const rawToken = fneResponse.data.token || fneResponse.data.invoice?.token;
      if (rawToken) {
        const parsed = parseFNEToken(rawToken);
        fneToken = parsed.url;
        fneTokenValue = parsed.value;
      }

      // Supprimer les anciens items
      await prisma.itemInvoice.deleteMany({
        where: { uid_invoice: existingInvoice.uid_invoice },
      });

      // Mettre à jour la facture seulement si certification réussie
      const invoice = await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          pointdeventeid,
          clientid,
          type_invoice,
          paymentMethod: finalPaymentMethod,
          clientSellerName: finalClientSellerName,
          remise_taux: remise_taux || 0,
          fne_reference: fneReference,
          fne_invoice_id: fneInvoiceId,
          fne_token: fneToken,
          fne_token_value: fneTokenValue,
          status: 'certified',
          items: {
            createMany: {
              data: items.map(item => ({
                uid_companie,
                uid_invoice: existingInvoice.uid_invoice,
                reference: item.reference,
                description: item.description,
                quantity: item.quantity,
                amount: item.amount,
                discount: item.discount || 0,
                measurementUnit: item.measurementUnit || 'pcs',
                taxes: typeof item.taxes === 'string'
                  ? item.taxes
                  : (Array.isArray(item.taxes) ? item.taxes.join(',') : ''),
                customTaxesname:
                  (item.customTaxes && item.customTaxes.length > 0
                    ? item.customTaxes[0].name
                    : (item as any).customTaxesname) || '',
                customTaxesamount:
                  (item.customTaxes && item.customTaxes.length > 0
                    ? item.customTaxes[0].amount
                    : (item as any).customTaxesamount) || 0,
              })),
            },
          },
        },
        include: {
          items: true,
          client: true,
          pointdevente: true,
        },
      });

      // Mettre à jour les IDs FNE des items dans ItemInvoice
      const fneItems = fneResponse.data.items || fneResponse.data.invoice?.items || [];
      if (fneItems.length > 0) {
        await updateItemInvoiceFNEIds(invoiceId, fneItems);
      }

      // Create log
      await prisma.invoiceLog.create({
        data: {
          uid_companie: company.id,
          pointdeventeid,
          uid_invoice: invoiceId,
          data_send: fneData as any,
          data_receved: fneResponse.data || {},
          code_response: fneResponse.code,
          msg_response: fneResponse.message,
          userid: user.id,
          token_receced: fneToken,
        },
      });

      // Get updated invoice
      const updatedInvoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          items: true,
          client: { select: { id: true, clientCompanyName: true, ncc: true } },
          pointdevente: { select: { id: true, nom: true } },
          logs: { orderBy: { date_creation: 'desc' } },
        },
      });

      return successResponse({
        invoice: updatedInvoice,
        fne_response: {
          success: true,
          status: parseInt(fneResponse.code),
          data: fneResponse.data,
        },
      }, 'Facture mise à jour et certifiée avec succès', 200);
    } else {
      // Certification failed - invoice remains unchanged, return error
      return errorResponse(
        fneResponse.message || 'Erreur lors de la certification de la facture',
        400
      );
    }
  } catch (error) {
    console.error('Update invoice error:', error);
    return errorResponse('Erreur serveur', 500);
  }
}
