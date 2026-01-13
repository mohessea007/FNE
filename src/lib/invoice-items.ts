import prisma from '@/lib/prisma';

/**
 * Met à jour les fne_item_id dans ItemInvoice en utilisant les données de la réponse FNE
 * @param invoiceId ID de la facture dans notre système
 * @param fneItems Items reçus de la réponse FNE
 */
export async function updateItemInvoiceFNEIds(invoiceId: number, fneItems: any[]) {
  try {
    if (!Array.isArray(fneItems) || fneItems.length === 0) {
      return;
    }

    // Récupérer la facture pour obtenir son uid_invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { uid_invoice: true },
    });

    if (!invoice) {
      console.warn(`Facture ${invoiceId} non trouvée pour la mise à jour des fne_item_id`);
      return;
    }

    // Récupérer tous les items de la facture
    const invoiceItems = await prisma.itemInvoice.findMany({
      where: { uid_invoice: invoice.uid_invoice },
    });

    if (invoiceItems.length === 0) {
      console.warn(`Aucun item trouvé pour la facture ${invoiceId}`);
      return;
    }

    // Mettre à jour chaque item en utilisant la référence pour matcher
    for (const fneItem of fneItems) {
      if (!fneItem.id || !fneItem.reference) {
        continue;
      }

      // Vérifier que l'ID est un UUID valide
      if (!fneItem.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        console.warn(`ID FNE invalide ignoré: ${fneItem.id} pour la référence ${fneItem.reference}`);
        continue;
      }

      // Trouver l'item correspondant par référence
      const matchingItem = invoiceItems.find(item => item.reference === fneItem.reference);
      if (matchingItem) {
        await prisma.itemInvoice.update({
          where: { id: matchingItem.id },
          data: { fne_item_id: String(fneItem.id) },
        });
        console.log(`fne_item_id mis à jour pour l'item ${matchingItem.id} (référence: ${fneItem.reference}) avec UUID: ${fneItem.id}`);
      } else {
        console.warn(`Aucun item trouvé avec la référence ${fneItem.reference} pour la facture ${invoiceId}`);
      }
    }
  } catch (error) {
    console.error('Error updating ItemInvoice fne_item_id:', error);
    // Ne pas faire échouer la certification si la mise à jour échoue
  }
}

/**
 * Enregistre les articles reçus de la réponse FNE dans la table items_invoices_receved
 * @param invoiceId ID de la facture dans notre système
 * @param fneResponseData Données de la réponse FNE (data_receved)
 */
export async function saveFNEItems(invoiceId: number, fneResponseData: any) {
  try {
    // Extraire les items de la réponse FNE
    // La réponse peut avoir items directement ou dans invoice.items
    const items = fneResponseData?.items || fneResponseData?.invoice?.items || [];

    if (!Array.isArray(items) || items.length === 0) {
      console.log('Aucun item trouvé dans la réponse FNE pour la facture', invoiceId);
      return;
    }

    // Log pour déboguer
    console.log(`Tentative d'enregistrement de ${items.length} items pour la facture ${invoiceId}`);

    // Supprimer les anciens items reçus pour cette facture (au cas où on re-certifie)
    await prisma.itemsInvoiceReceved.deleteMany({
      where: { invoice_id: invoiceId },
    });

    // Filtrer et valider les items avant l'enregistrement
    const validItems = items
      .filter((item: any) => {
        // Vérifier que l'item a un ID UUID (nécessaire pour le remboursement)
        if (!item.id || typeof item.id !== 'string' || item.id.trim() === '') {
          console.warn('Item sans ID UUID ignoré:', JSON.stringify(item));
          return false;
        }

        // Vérifier que l'ID ressemble à un UUID (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
        if (!item.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          console.warn('ID ne ressemble pas à un UUID valide:', item.id);
          return false;
        }

        return true;
      })
      .map((item: any) => ({
        invoice_id: invoiceId,
        fne_item_id: String(item.id), // Utiliser l'UUID de l'article pour le remboursement FNE
        quantity: item.quantity || 0,
        reference: item.reference || '',
        description: item.description || '',
        amount: typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount)) || 0,
        discount: typeof item.discount === 'number' ? item.discount : parseFloat(String(item.discount)) || 0,
        measurementUnit: item.measurementUnit || 'pcs',
        taxes: item.taxes ? JSON.parse(JSON.stringify(item.taxes)) : null,
        customTaxes: item.customTaxes ? JSON.parse(JSON.stringify(item.customTaxes)) : null,
      }));

    if (validItems.length === 0) {
      console.warn(`Aucun item valide à enregistrer pour la facture ${invoiceId}. Items reçus:`, items.map((i: any) => ({ id: i.id, reference: i.reference })));
      return;
    }

    console.log(`Enregistrement de ${validItems.length} items valides pour la facture ${invoiceId}`);

    // Enregistrer les nouveaux items
    await prisma.itemsInvoiceReceved.createMany({
      data: validItems,
    });

    console.log(`Items enregistrés avec succès pour la facture ${invoiceId}`);
  } catch (error) {
    console.error('Error saving FNE items:', error);
    // Ne pas faire échouer la certification si l'enregistrement des items échoue
  }
}

