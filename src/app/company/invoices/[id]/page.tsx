'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import { FiArrowLeft, FiFileText, FiCopy, FiExternalLink, FiPrinter, FiRotateCcw } from 'react-icons/fi';
import { Badge, LoadingSpinner, Modal } from '@/components/ui';

interface InvoiceItem {
  id: number;
  reference: string;
  description: string;
  quantity: number;
  amount: number;
  discount: number;
  measurementUnit: string;
  taxes: string;
  customTaxesname: string | null;
  customTaxesamount: number;
  fne_item_id: string | null;
  date_creation: string;
}

interface ItemsInvoiceReceved {
  id: number;
  invoice_id: number;
  fne_item_id: string;
  quantity: number;
  reference: string;
  description: string;
  amount: number | string;
  discount: number | string;
  measurementUnit: string;
  taxes: any;
  customTaxes: any;
  date_creation: string;
}

interface Invoice {
  id: number;
  uid_invoice: string;
  company?: { id: number; nom: string; uid_companie: string };
  client?: { id: number; clientCompanyName: string; ncc: string; clientPhone: string; clientEmail: string };
  pointdevente?: { id: number; nom: string };
  type_invoice: string;
  status: string;
  paymentMethod: string;
  clientSellerName: string;
  remise_montant: number;
  remise_taux: number;
  fne_reference: string | null;
  fne_token: string | null;
  fne_token_value: string | null;
  is_refund?: boolean;
  original_invoice_id?: number | null;
  originalInvoice?: { id: number; fne_reference: string | null; uid_invoice: string } | null;
  date_creation: string;
  date_modification: string;
  items: InvoiceItem[];
  itemsReceved?: ItemsInvoiceReceved[];
  refunds?: Array<{ id: number; status: string }>;
}

export default function CompanyInvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundItems, setRefundItems] = useState<Array<{ id: string; quantity: number; maxQuantity: number; description: string }>>([]);
  const [processingRefund, setProcessingRefund] = useState(false);

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  useEffect(() => {
    // Si print=true dans l'URL, déclencher l'impression
    if (searchParams.get('print') === 'true' && invoice) {
      window.print();
    }
  }, [searchParams, invoice]);

  const fetchInvoice = async () => {
    try {
      const res = await fetch(`/api/company/invoices/${id}`);
      const data = await res.json();
      if (data.success) {
        setInvoice(data.data.invoice);
      } else {
        toast.error(data.message || 'Facture non trouvée');
        router.push('/company/invoices');
      }
    } catch (error) {
      toast.error('Erreur lors du chargement');
      router.push('/company/invoices');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (invoice?.fne_token) {
      // Ouvrir le token FNE directement dans un nouvel onglet
      window.open(invoice.fne_token, '_blank', 'noopener,noreferrer');
    } else {
      // Fallback : impression si pas de token
      window.print();
    }
  };

  const handleRefundClick = () => {
    if (!invoice) return;
    
    // Vérifier que la facture n'a pas déjà été remboursée
    if (invoice.status === 'refunded' || (invoice.refunds && invoice.refunds.length > 0)) {
      toast.error('Cette facture a déjà été remboursée');
      return;
    }
    
    // Utiliser les articles reçus de la FNE (itemsReceved) au lieu de fne_item_id
    const recevedItems = invoice.itemsReceved || [];
    
    if (recevedItems.length === 0) {
      toast.error('Aucun article éligible pour le remboursement. Les articles doivent avoir été certifiés par la FNE.');
      return;
    }

    // Vérifier que tous les fne_item_id sont des UUIDs valides
    const invalidUuidItems = recevedItems.filter(item => 
      !item.fne_item_id || !item.fne_item_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    );

    if (invalidUuidItems.length > 0) {
      toast.error(
        'Les articles de cette facture ont des données invalides. La facture doit être re-certifiée pour mettre à jour les données avec les UUIDs corrects.',
        { duration: 8000 }
      );
      return;
    }
    
    // Initialiser les items avec les quantités maximales depuis itemsReceved
    const items = recevedItems.map(item => ({
      id: item.fne_item_id,
      quantity: item.quantity, // Par défaut, rembourser tout
      maxQuantity: item.quantity,
      description: item.description,
    }));
    
    setRefundItems(items);
    setShowRefundModal(true);
  };

  const handleRefundSubmit = async () => {
    if (!invoice || refundItems.length === 0) return;

    // Vérifier qu'au moins un item a une quantité > 0
    const hasValidQuantity = refundItems.some(item => item.quantity > 0);
    if (!hasValidQuantity) {
      toast.error('Veuillez sélectionner au moins un article à rembourser');
      return;
    }

    // Vérifier que tous les IDs sont des UUIDs valides avant d'envoyer
    const itemsToRefund = refundItems
      .filter(item => item.quantity > 0);
    
    const invalidIds = itemsToRefund.filter(item => 
      !item.id || !item.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    );
    
    if (invalidIds.length > 0) {
      toast.error(
        'Les articles sélectionnés ont des données invalides. La facture doit être re-certifiée pour mettre à jour les données avec les UUIDs corrects.',
        { duration: 8000 }
      );
      return;
    }

    setProcessingRefund(true);
    try {
      const itemsToSend = itemsToRefund.map(item => ({
        id: item.id,
        quantity: item.quantity,
      }));

      const res = await fetch(`/api/company/invoices/${invoice.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToSend }),
      });

      const data = await res.json();
      if (data.success && data.data.fne_response?.success) {
        toast.success('Avoir créé avec succès');
        setShowRefundModal(false);
        router.push('/company/invoices'); // Rediriger vers la liste
      } else {
        let errorMsg = data.data?.fne_response?.error?.message || data.message || 'Erreur lors de la création de l\'avoir';
        
        // Si l'erreur mentionne "invalid input syntax for type uuid", c'est que les données sont invalides
        if (errorMsg.includes('invalid input syntax for type uuid') || errorMsg.includes('UUID')) {
          errorMsg = 'Les articles de cette facture ont des données invalides. La facture doit être re-certifiée pour mettre à jour les données avec les UUIDs corrects.';
        }
        
        toast.error(errorMsg, { duration: 8000 });
      }
    } catch (error) {
      toast.error('Erreur serveur');
    } finally {
      setProcessingRefund(false);
    }
  };

  const updateRefundQuantity = (index: number, quantity: number) => {
    const newItems = [...refundItems];
    const item = newItems[index];
    if (quantity >= 0 && quantity <= item.maxQuantity) {
      newItems[index] = { ...item, quantity };
      setRefundItems(newItems);
    }
  };

  const getTotal = () => {
    if (!invoice) return 0;
    const itemsTotal = invoice.items.reduce((sum, item) => {
      const itemTotal = (item.amount * item.quantity) - item.discount;
      return sum + itemTotal;
    }, 0);
    return itemsTotal - invoice.remise_montant;
  };

  if (loading) return <LoadingSpinner />;
  if (!invoice) return null;

  // Une facture est considérée comme certifiée si elle a le status 'certified' ou 'refunded' (pour les avoirs)
  const isCertified = invoice.status === 'certified' || invoice.status === 'refunded';

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header - Masqué à l'impression */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <Link href="/company/invoices" className="p-2 rounded-lg hover:bg-dark-800 transition-colors">
            <FiArrowLeft className="w-5 h-5 text-dark-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Facture {invoice.uid_invoice.slice(0, 8)}...</h1>
            <p className="text-dark-400">Détails de la facture</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {invoice.status === 'certified' && invoice.fne_token && (!invoice.refunds || invoice.refunds.length === 0) && invoice.type_invoice === 'sale' && !invoice.is_refund && (
            <>
              <button onClick={handlePrint} className="btn-primary flex items-center gap-2">
                <FiPrinter className="w-4 h-4" />
                Imprimer le reçu
              </button>
              <button onClick={handleRefundClick} className="btn-secondary flex items-center gap-2">
                <FiRotateCcw className="w-4 h-4" />
                Rembourser
              </button>
            </>
          )}
          {invoice.status === 'certified' && invoice.fne_token && ((invoice.refunds && invoice.refunds.length > 0) || invoice.type_invoice === 'purchase' || invoice.is_refund) && (
            <button onClick={handlePrint} className="btn-primary flex items-center gap-2">
              <FiPrinter className="w-4 h-4" />
              Imprimer le reçu
            </button>
          )}
          {invoice.status === 'refunded' && invoice.fne_token && (
            <button onClick={handlePrint} className="btn-primary flex items-center gap-2">
              <FiPrinter className="w-4 h-4" />
              Imprimer le reçu
            </button>
          )}
          <Badge variant={invoice.status === 'certified' ? 'success' : invoice.status === 'rejected' ? 'danger' : invoice.status === 'refunded' ? 'info' : 'warning'}>
            {invoice.status === 'certified' ? 'Certifiée' : invoice.status === 'rejected' ? 'Rejetée' : invoice.status === 'refunded' ? 'Remboursée' : 'En attente'}
          </Badge>
        </div>
      </div>

      {/* Informations principales */}
      <div className="grid lg:grid-cols-2 gap-6 print:grid-cols-1">
        {/* Informations générales */}
        <div className="card p-6 print:shadow-none print:border-none">
          <h2 className="text-lg font-semibold text-white mb-4 print:text-black">Informations générales</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-dark-400 print:text-gray-600">UID Facture</label>
              <p className="text-white font-mono text-sm print:text-black">{invoice.uid_invoice}</p>
            </div>
            <div>
              <label className="text-sm text-dark-400 print:text-gray-600">Client</label>
              <p className="text-white print:text-black">{invoice.client?.clientCompanyName || '-'}</p>
              {invoice.client?.ncc && (
                <p className="text-dark-400 text-xs print:text-gray-600">NCC: {invoice.client.ncc}</p>
              )}
            </div>
            <div>
              <label className="text-sm text-dark-400 print:text-gray-600">Point de vente</label>
              <p className="text-white print:text-black">{invoice.pointdevente?.nom || '-'}</p>
            </div>
            <div>
              <label className="text-sm text-dark-400 print:text-gray-600">Type</label>
              <p className="text-white print:text-black">
                <Badge variant={invoice.status === 'refunded' ? 'info' : invoice.type_invoice === 'sale' ? 'primary' : 'warning'}>
                  {invoice.status === 'refunded' ? 'Avoir' : invoice.type_invoice === 'sale' ? 'Vente' : 'Achat'}
                </Badge>
              </p>
            </div>
            <div>
              <label className="text-sm text-dark-400 print:text-gray-600">Méthode de paiement</label>
              <p className="text-white print:text-black">{invoice.paymentMethod || '-'}</p>
            </div>
            <div>
              <label className="text-sm text-dark-400 print:text-gray-600">Date de création</label>
              <p className="text-white print:text-black">{new Date(invoice.date_creation).toLocaleString('fr-FR')}</p>
            </div>
          </div>
        </div>

        {/* Informations FNE - Pour les factures certifiées et les avoirs */}
        {isCertified && invoice.fne_token && (
          <div className="card p-6 print:shadow-none print:border-none">
            <h2 className="text-lg font-semibold text-white mb-4 print:text-black">
              {invoice.status === 'refunded' ? 'Reçu de remboursement FNE' : 'Reçu de certification FNE'}
            </h2>
            <div className="space-y-4">
              {/* Pour les avoirs, afficher la référence FNE de la facture parente en haut */}
              {invoice.status === 'refunded' && invoice.originalInvoice?.fne_reference && (
                <div>
                  <label className="text-sm text-dark-400 print:text-gray-600">Référence FNE de la facture originale</label>
                  <p className="text-white font-mono text-sm print:text-black break-all">{invoice.originalInvoice.fne_reference}</p>
                </div>
              )}
              {/* Afficher la référence FNE de l'avoir en bas (ou de la facture normale) */}
              {invoice.fne_reference && (
                <div>
                  <label className="text-sm text-dark-400 print:text-gray-600">
                    {invoice.status === 'refunded' ? 'Référence FNE de l\'avoir' : 'Référence FNE'}
                  </label>
                  <p className="text-white font-mono text-sm print:text-black break-all">{invoice.fne_reference}</p>
                </div>
              )}
              {invoice.fne_token && (
                <>
                  <div>
                    <label className="text-sm text-dark-400 print:text-gray-600 mb-2 block">URL du reçu</label>
                    <div className="flex items-center gap-2 print:flex-col print:items-start">
                      <a
                        href={invoice.fne_token}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-primary-400 hover:text-primary-300 font-mono text-xs break-all print:text-black print:break-all"
                      >
                        {invoice.fne_token}
                      </a>
                      <div className="flex items-center gap-2 print:hidden">
                        <a
                          href={invoice.fne_token}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg hover:bg-dark-700 transition-colors"
                          title="Ouvrir le reçu"
                        >
                          <FiExternalLink className="w-4 h-4 text-primary-400" />
                        </a>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(invoice.fne_token || '');
                            toast.success('URL copiée !');
                          }}
                          className="p-2 rounded-lg hover:bg-dark-700 transition-colors"
                          title="Copier l'URL"
                        >
                          <FiCopy className="w-4 h-4 text-primary-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-dark-400 print:text-gray-600 mb-2 block">QR Code du reçu</label>
                    <div className="flex justify-center print:justify-start">
                      <div className="bg-white p-4 rounded-lg print:p-2">
                        <QRCodeSVG
                          value={invoice.fne_token}
                          size={200}
                          level="H"
                          includeMargin={true}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-dark-400 mt-2 text-center print:text-gray-600 print:text-left">
                      Scannez ce code QR pour accéder au reçu de certification
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Articles */}
      <div className="card p-6 print:shadow-none print:border-none">
        <h2 className="text-lg font-semibold text-white mb-4 print:text-black">Articles</h2>
        <div className="overflow-x-auto">
          <table className="table print:text-sm">
            <thead>
              <tr>
                <th className="print:text-gray-700">Référence</th>
                <th className="print:text-gray-700">Description</th>
                <th className="print:text-gray-700">Quantité</th>
                <th className="print:text-gray-700">Unité</th>
                <th className="print:text-gray-700">Prix unitaire</th>
                <th className="print:text-gray-700">Remise</th>
                <th className="print:text-gray-700">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, index) => {
                const itemTotal = (item.amount * item.quantity) - item.discount;
                return (
                  <tr key={item.id || index}>
                    <td className="print:text-black">{item.reference}</td>
                    <td className="print:text-black">{item.description}</td>
                    <td className="print:text-black">{item.quantity}</td>
                    <td className="print:text-black">{item.measurementUnit}</td>
                    <td className="print:text-black">{item.amount.toLocaleString('fr-FR')} FCFA</td>
                    <td className="print:text-black">{item.discount.toLocaleString('fr-FR')} FCFA</td>
                    <td className="print:text-black font-semibold">{itemTotal.toLocaleString('fr-FR')} FCFA</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              {invoice.remise_montant > 0 && (
                <tr>
                  <td colSpan={6} className="text-right font-semibold print:text-black">
                    Remise globale
                  </td>
                  <td className="font-semibold print:text-black">
                    -{invoice.remise_montant.toLocaleString('fr-FR')} FCFA
                  </td>
                </tr>
              )}
              <tr>
                <td colSpan={6} className="text-right font-bold text-lg print:text-black">
                  Total général
                </td>
                <td className="font-bold text-lg print:text-black">
                  {getTotal().toLocaleString('fr-FR')} FCFA
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Modal de remboursement */}
      <Modal isOpen={showRefundModal} onClose={() => setShowRefundModal(false)} title="Créer un avoir (remboursement)" size="lg">
        <div className="space-y-4">
          <p className="text-dark-300 text-sm">
            Sélectionnez les articles à rembourser et les quantités. Une fois créé, cette facture ne pourra plus être remboursée.
          </p>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {refundItems.map((item, index) => (
              <div key={item.id} className="p-4 bg-dark-800 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-white font-medium">{item.description}</p>
                  <span className="text-dark-400 text-sm">Max: {item.maxQuantity}</span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-dark-400 flex-shrink-0">Quantité à rembourser:</label>
                  <input
                    type="number"
                    min="0"
                    max={item.maxQuantity}
                    value={item.quantity}
                    onChange={(e) => updateRefundQuantity(index, parseInt(e.target.value) || 0)}
                    className="input flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => updateRefundQuantity(index, item.maxQuantity)}
                    className="btn-secondary btn-sm"
                  >
                    Max
                  </button>
                </div>
              </div>
            ))}
          </div>

          {refundItems.length === 0 && (
            <p className="text-center text-dark-400 py-4">
              Aucun article éligible pour le remboursement. Les articles doivent avoir un ID FNE.
            </p>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-dark-700">
            <button
              type="button"
              onClick={() => setShowRefundModal(false)}
              className="btn-secondary"
              disabled={processingRefund}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleRefundSubmit}
              className="btn-primary"
              disabled={processingRefund || refundItems.length === 0 || !refundItems.some(item => item.quantity > 0)}
            >
              {processingRefund ? 'Création...' : 'Créer l\'avoir'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Styles pour l'impression */}
      <style jsx global>{`
        @media print {
          body {
            background: white;
            color: black;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:text-black {
            color: black !important;
          }
          .print\\:text-gray-600 {
            color: #4b5563 !important;
          }
          .print\\:text-gray-700 {
            color: #374151 !important;
          }
          .print\\:border-none {
            border: none !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:space-y-4 > * + * {
            margin-top: 1rem !important;
          }
          .print\\:grid-cols-1 {
            grid-template-columns: 1fr !important;
          }
          .print\\:flex-col {
            flex-direction: column !important;
          }
          .print\\:items-start {
            align-items: flex-start !important;
          }
          .print\\:justify-start {
            justify-content: flex-start !important;
          }
          .print\\:break-all {
            word-break: break-all !important;
          }
          .print\\:p-2 {
            padding: 0.5rem !important;
          }
          .print\\:text-sm {
            font-size: 0.875rem !important;
          }
        }
      `}</style>
    </div>
  );
}

