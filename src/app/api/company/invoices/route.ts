import prisma from '@/lib/prisma';
import { getCurrentUser, isCompanyLevel, isAdminLevel, generateUID } from '@/lib/auth';
import { certifyInvoice, parseFNEToken, FNEInvoiceData, convertTaxToFNEFormat } from '@/lib/fne';
import { saveFNEItems, updateItemInvoiceFNEIds } from '@/lib/invoice-items';
import { validate, createInvoiceSchema } from '@/lib/validations';
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, validationErrorResponse, parseJsonBody } from '@/lib/api-utils';

async function getCompanyUid(user: any) {
  if (!user.companieid) return null;
  const company = await prisma.company.findUnique({ where: { id: user.companieid } });
  return company?.uid_companie || null;
}

// GET /api/company/invoices - List company invoices
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (!isCompanyLevel(user.type_user) && !isAdminLevel(user.type_user)) return forbiddenResponse();

  const uid_companie = await getCompanyUid(user);
  if (!uid_companie) return forbiddenResponse();

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const status = searchParams.get('status');
  const type_invoice = searchParams.get('type_invoice');
  const search = searchParams.get('search');
  const skip = (page - 1) * limit;

  const where: any = { uid_companie };
  if (status) where.status = status;
  if (type_invoice) where.type_invoice = type_invoice;
  if (search) {
    where.OR = [
      { uid_invoice: { contains: search, mode: 'insensitive' } },
      { client: { clientCompanyName: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        client: { select: { id: true, clientCompanyName: true, ncc: true } },
        pointdevente: { select: { id: true, nom: true } },
        items: true,
        logs: { take: 1, orderBy: { date_creation: 'desc' } },
      },
      skip,
      take: limit,
      orderBy: { date_creation: 'desc' },
    }),
    prisma.invoice.count({ where }),
  ]);

  // Sérialiser les dates
  const serializedInvoices = invoices.map(invoice => ({
    ...invoice,
    date_creation: invoice.date_creation.toISOString(),
    date_modification: invoice.date_modification.toISOString(),
    items: invoice.items.map(item => ({
      ...item,
      date_creation: item.date_creation.toISOString(),
    })),
    logs: invoice.logs.map(log => ({
      ...log,
      date_creation: log.date_creation.toISOString(),
    })),
  }));

  return successResponse({
    invoices: serializedInvoices,
    total,
    pages: Math.ceil(total / limit),
    currentPage: page,
  });
}

// POST /api/company/invoices - Create and certify invoice
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (!isCompanyLevel(user.type_user) && !isAdminLevel(user.type_user)) return forbiddenResponse();

  const uid_companie = await getCompanyUid(user);
  if (!uid_companie) return forbiddenResponse();

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

    // Get company with token
    const company = await prisma.company.findUnique({
      where: { uid_companie },
    });

    if (!company) {
      return errorResponse('Entreprise non trouvée', 404);
    }

    // Vérifier que le type de facture est valide (narrowing pour TypeScript)
    if (type_invoice !== 'sale' && type_invoice !== 'purchase') {
      return errorResponse('Type de facture invalide. Le type doit être "sale" ou "purchase".', 400);
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

    const uid_invoice = generateUID();

    // Prepare FNE data
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

    // Call FNE API to certify FIRST - only create invoice if certification succeeds
    const fneResponse = await certifyInvoice(fneData, company.token_fne);

    // Parse FNE response
    let fneReference = null;
    let fneInvoiceId = null; // UUID de la facture FNE (pour les remboursements)
    let fneToken = null;
    let fneTokenValue = null;

    // Only create invoice if FNE certification succeeded
    if (fneResponse.success && fneResponse.data) {
      fneReference = fneResponse.data.reference || fneResponse.data.invoice?.reference;
      fneInvoiceId = fneResponse.data.id || fneResponse.data.invoice?.id;
      const rawToken = fneResponse.data.token || fneResponse.data.invoice?.token;
      if (rawToken) {
        const parsed = parseFNEToken(rawToken);
        fneToken = parsed.url;
        fneTokenValue = parsed.value;
      }

      // Create invoice in database only after successful certification
      const invoice = await prisma.invoice.create({
        data: {
          uid_companie,
          pointdeventeid,
          clientid,
          uid_invoice,
          remise_taux: remise_taux || 0,
          type_invoice,
          paymentMethod: finalPaymentMethod,
          clientSellerName: finalClientSellerName,
          fne_reference: fneReference,
          fne_invoice_id: fneInvoiceId,
          fne_token: fneToken,
          fne_token_value: fneTokenValue,
          status: 'certified',
          items: {
            create: items.map(item => ({
              uid_companie,
              reference: item.reference,
              description: item.description,
              quantity: item.quantity,
              amount: item.amount,
              discount: item.discount || 0,
              measurementUnit: item.measurementUnit || 'pcs',
              taxes: typeof item.taxes === 'string' ? item.taxes : (Array.isArray(item.taxes) ? item.taxes.join(',') : ''),
              customTaxesname: (item.customTaxes && item.customTaxes.length > 0 ? item.customTaxes[0].name : (item as any).customTaxesname) || '',
              customTaxesamount: (item.customTaxes && item.customTaxes.length > 0 ? item.customTaxes[0].amount : (item as any).customTaxesamount) || 0,
            })),
          },
        },
        include: {
          items: true,
          client: { select: { id: true, clientCompanyName: true, ncc: true } },
          pointdevente: { select: { id: true, nom: true } },
        },
      });

      // Mettre à jour les IDs FNE des items dans ItemInvoice
      const fneItems = fneResponse.data.items || fneResponse.data.invoice?.items || [];
      if (fneItems.length > 0) {
        await updateItemInvoiceFNEIds(invoice.id, fneItems);
      }

      // Enregistrer les articles reçus de la FNE pour le remboursement
      await saveFNEItems(invoice.id, fneResponse.data);

      // Create log
      await prisma.invoiceLog.create({
        data: {
          uid_companie: company.id,
          pointdeventeid,
          uid_invoice: invoice.id,
          data_send: fneData as any,
          data_receved: fneResponse.data || {},
          code_response: fneResponse.code,
          msg_response: fneResponse.message,
          userid: user.id,
          token_receced: fneToken,
        },
      });

      return successResponse({
        invoice,
        fne_response: {
          success: true,
          status: parseInt(fneResponse.code),
          data: fneResponse.data,
        },
      }, 'Facture créée et certifiée avec succès', 201);
    } else {
      // Certification failed - do not create invoice, return error
      return errorResponse(
        fneResponse.message || 'Erreur lors de la certification de la facture',
        400
      );
    }
  } catch (error) {
    console.error('Create invoice error:', error);
    return errorResponse('Erreur serveur', 500);
  }
}

