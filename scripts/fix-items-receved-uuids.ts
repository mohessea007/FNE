/**
 * Script pour corriger les fne_item_id dans items_invoices_receved
 * Ce script récupère les UUIDs depuis invoice_logs.data_receved pour les factures certifiées
 * et met à jour items_invoices_receved avec les bons UUIDs
 * 
 * Usage: npx ts-node scripts/fix-items-receved-uuids.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixItemsRecevedUuids() {
  try {
    console.log('Début de la correction des UUIDs dans items_invoices_receved...');

    // Récupérer toutes les factures certifiées
    const certifiedInvoices = await prisma.invoice.findMany({
      where: {
        status: 'certified',
      },
      include: {
        itemsReceved: true,
        logs: {
          orderBy: { date_creation: 'desc' },
          take: 1, // Prendre le dernier log (celui de la certification réussie)
        },
      },
    });

    console.log(`Trouvé ${certifiedInvoices.length} factures certifiées`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const invoice of certifiedInvoices) {
      const lastLog = invoice.logs[0];
      if (!lastLog || !lastLog.data_receved) {
        console.warn(`Pas de log avec data_receved pour la facture ${invoice.id}`);
        continue;
      }

      // Extraire les items depuis data_receved
      const dataReceved = lastLog.data_receved as any;
      const fneItems = dataReceved?.items || dataReceved?.invoice?.items || [];

      if (fneItems.length === 0) {
        console.warn(`Pas d'items dans data_receved pour la facture ${invoice.id}`);
        continue;
      }

      // Vérifier si les itemsReceved ont des UUIDs invalides (références au lieu d'UUIDs)
      const hasInvalidUuids = invoice.itemsReceved.some(ri => 
        !ri.fne_item_id || !ri.fne_item_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      );

      if (!hasInvalidUuids) {
        // Les UUIDs sont déjà valides, on passe
        continue;
      }

      console.log(`Correction de la facture ${invoice.id} (${invoice.itemsReceved.length} articles)`);

      // Supprimer les anciens itemsReceved
      await prisma.itemsInvoiceReceved.deleteMany({
        where: { invoice_id: invoice.id },
      });

      // Recréer avec les UUIDs corrects depuis data_receved
      const validItems = fneItems
        .filter((item: any) => {
          if (!item.id || typeof item.id !== 'string') {
            return false;
          }
          // Vérifier que c'est un UUID valide
          return item.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        })
        .map((item: any) => ({
          invoice_id: invoice.id,
          fne_item_id: String(item.id), // UUID
          quantity: item.quantity || 0,
          reference: item.reference || '',
          description: item.description || '',
          amount: typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount)) || 0,
          discount: typeof item.discount === 'number' ? item.discount : parseFloat(String(item.discount)) || 0,
          measurementUnit: item.measurementUnit || 'pcs',
          taxes: item.taxes ? JSON.parse(JSON.stringify(item.taxes)) : null,
          customTaxes: item.customTaxes ? JSON.parse(JSON.stringify(item.customTaxes)) : null,
        }));

      if (validItems.length > 0) {
        await prisma.itemsInvoiceReceved.createMany({
          data: validItems,
        });
        updatedCount++;
        console.log(`✓ Facture ${invoice.id} corrigée (${validItems.length} articles)`);
      } else {
        console.warn(`✗ Aucun item valide trouvé pour la facture ${invoice.id}`);
        errorCount++;
      }
    }

    console.log('\n=== Résumé ===');
    console.log(`Factures corrigées: ${updatedCount}`);
    console.log(`Factures en erreur: ${errorCount}`);
    console.log('Correction terminée !');

  } catch (error) {
    console.error('Erreur lors de la correction:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
fixItemsRecevedUuids()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

