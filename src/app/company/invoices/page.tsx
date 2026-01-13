'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { FiFileText, FiEye, FiSearch, FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import { DataTable, Badge, LoadingSpinner, EmptyState, Pagination, Modal } from '@/components/ui';
import { CompanyInvoiceTable } from '@/components/company/CompanyInvoiceTable';

interface Invoice {
  id: number;
  uid_invoice: string;
  client?: { id: number; clientCompanyName: string; ncc: string };
  pointdevente?: { id: number; nom: string };
  type_invoice: string;
  status: string;
  fne_token?: string | null;
  date_creation: string;
  items: Array<{ amount: number; quantity: number }>;
}

interface Client {
  id: number;
  clientCompanyName: string;
  ncc: string;
}

interface PointDeVente {
  id: number;
  nom: string;
}

interface InvoiceItem {
  reference: string;
  description: string;
  quantity: number;
  amount: number;
  discount: number;
  measurementUnit: string;
  taxes: string; // TVA18, TVAB9, TVAC0
  customTaxes: Array<{ name: string; amount: number }>;
}

export default function CompanyInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [pointdeventes, setPointdeventes] = useState<PointDeVente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    clientid: 0,
    pointdeventeid: 0,
    type_invoice: 'sale' as 'sale' | 'purchase',
    paymentMethod: 'cash',
    clientSellerName: '',
    remise_taux: 0, // Pourcentage de 0 à 100
    items: [] as InvoiceItem[],
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [invoicesRes, clientsRes, pdvRes] = await Promise.all([
        fetch(`/api/company/invoices?page=${currentPage}&limit=50${statusFilter ? `&status=${statusFilter}` : ''}${search ? `&search=${search}` : ''}`),
        fetch('/api/company/clients'),
        fetch('/api/company/pointdeventes'),
      ]);
      
      const [invoicesData, clientsData, pdvData] = await Promise.all([
        invoicesRes.json(),
        clientsRes.json(),
        pdvRes.json(),
      ]);
      
      if (invoicesData.success) {
        setInvoices(invoicesData.data.invoices);
        setTotalPages(invoicesData.data.pages);
      }
      if (clientsData.success) setClients(clientsData.data);
      if (pdvData.success) {
        setPointdeventes(pdvData.data);
        setFormData(prev => {
          if (pdvData.data.length > 0 && prev.pointdeventeid === 0) {
            return { ...prev, pointdeventeid: pdvData.data[0].id };
          }
          return prev;
        });
      }
    } catch (error) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter, search]);

  const handleCertify = async (invoiceId: number) => {
    if (!confirm('Certifier cette facture ?')) return;
    try {
      const res = await fetch(`/api/company/invoices/${invoiceId}/certify`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Facture certifiée avec succès');
        fetchData();
      } else {
        const errorMsg = data.data?.fne_response?.error?.message || data.message || 'Erreur de certification';
        const errorDetails = data.data?.fne_response?.error?.details;
        
        toast.error((t) => (
          <div className="space-y-2">
            <p className="font-medium">{errorMsg}</p>
            {errorDetails && typeof errorDetails === 'object' && Object.keys(errorDetails).length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-dark-300 hover:text-white">Voir les détails de l'erreur</summary>
                <pre className="mt-2 p-2 bg-dark-800 rounded text-dark-300 overflow-auto max-h-40">
                  {JSON.stringify(errorDetails, null, 2)}
                </pre>
              </details>
            )}
            <button 
              onClick={() => toast.dismiss(t.id)} 
              className="btn-secondary btn-xs w-full mt-2"
            >
              Fermer
            </button>
          </div>
        ), { duration: 15000 });
      }
    } catch {
      toast.error('Erreur serveur');
    }
  };

  const handlePrint = async (invoiceId: number) => {
    try {
      const res = await fetch(`/api/company/invoices/${invoiceId}`);
      const data = await res.json();
      if (data.success && data.data.invoice.fne_token) {
        // Ouvrir le token FNE directement dans un nouvel onglet
        window.open(data.data.invoice.fne_token, '_blank', 'noopener,noreferrer');
      } else {
        toast.error('Token FNE non disponible pour cette facture');
      }
    } catch (error) {
      toast.error('Erreur lors de la récupération de la facture');
    }
  };

  const handleEdit = async (invoiceId: number) => {
    try {
      const res = await fetch(`/api/company/invoices/${invoiceId}`);
      const data = await res.json();
      if (data.success) {
        const invoice = data.data.invoice;
        setEditingInvoiceId(invoiceId);
        setFormData({
          clientid: invoice.clientid,
          pointdeventeid: invoice.pointdeventeid,
          type_invoice: invoice.type_invoice,
          paymentMethod: invoice.paymentMethod,
          clientSellerName: invoice.clientSellerName || '',
          remise_taux: invoice.remise_taux || 0,
          items: invoice.items.map((item: any) => ({
            reference: item.reference,
            description: item.description,
            quantity: item.quantity,
            amount: item.amount,
            discount: item.discount || 0,
            measurementUnit: item.measurementUnit,
            taxes: item.taxes || (formData.type_invoice === 'sale' ? 'TVA18' : ''),
            customTaxes: item.customTaxesname ? [{ name: item.customTaxesname, amount: item.customTaxesamount || 0 }] : [],
          })),
        });
        setShowModal(true);
      } else {
        toast.error('Erreur lors du chargement de la facture');
      }
    } catch {
      toast.error('Erreur serveur');
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.items.length === 0) {
      toast.error('Veuillez ajouter au moins un article');
      return;
    }
    if (formData.clientid === 0) {
      toast.error('Veuillez sélectionner un client');
      return;
    }
    if (formData.pointdeventeid === 0) {
      toast.error('Veuillez sélectionner un point de vente');
      return;
    }

    // Vérifier que toutes les factures de vente ont une taxe sélectionnée
    if (formData.type_invoice === 'sale') {
      for (const item of formData.items) {
        if (!item.taxes || (item.taxes !== 'TVA18' && item.taxes !== 'TVAB9' && item.taxes !== 'TVAC0')) {
          toast.error('La TVA est obligatoire pour les factures de vente. Veuillez sélectionner TVA 18%, TVAB 9% ou TVAC 0% pour tous les articles.');
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const url = editingInvoiceId ? `/api/company/invoices/${editingInvoiceId}` : '/api/company/invoices';
      const method = editingInvoiceId ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success && data.data?.fne_response?.success) {
        toast.success(data.message || (editingInvoiceId ? 'Facture modifiée et certifiée avec succès' : 'Facture créée et certifiée avec succès'));
        setShowModal(false);
        setEditingInvoiceId(null);
        setFormData({
          clientid: 0,
          pointdeventeid: pointdeventes[0]?.id || 0,
          type_invoice: 'sale',
          paymentMethod: 'cash',
          clientSellerName: '',
          remise_taux: 0,
          items: [],
        });
        fetchData();
      } else if (data.success && !data.data?.fne_response?.success) {
        // Afficher l'erreur détaillée si disponible
        const errorMsg = data.data?.fne_response?.error?.message || data.message || 'Erreur lors de la création';
        const errorDetails = data.data?.fne_response?.error?.details;
        
        // Afficher un toast avec les détails de l'erreur
        toast.error((t) => (
          <div className="space-y-2">
            <p className="font-medium">{errorMsg}</p>
            {errorDetails && typeof errorDetails === 'object' && Object.keys(errorDetails).length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-dark-300 hover:text-white">Voir les détails de l'erreur</summary>
                <pre className="mt-2 p-2 bg-dark-800 rounded text-dark-300 overflow-auto max-h-40">
                  {JSON.stringify(errorDetails, null, 2)}
                </pre>
              </details>
            )}
            <button 
              onClick={() => toast.dismiss(t.id)} 
              className="btn-secondary btn-xs w-full mt-2"
            >
              Fermer
            </button>
          </div>
        ), { duration: 15000 });
        
        // Ne pas fermer la modal en cas d'erreur pour permettre la correction
      }
    } catch {
      toast.error('Erreur serveur');
    } finally {
      setSubmitting(false);
    }
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          reference: '',
          description: '',
          quantity: 1,
          amount: 0,
          discount: 0,
          measurementUnit: 'pcs',
          taxes: formData.type_invoice === 'sale' ? 'TVA18' : '',
          customTaxes: [],
        },
      ],
    });
  };

  const addCustomTax = (itemIndex: number) => {
    const newItems = [...formData.items];
    newItems[itemIndex].customTaxes = [
      ...newItems[itemIndex].customTaxes,
      { name: '', amount: 0 },
    ];
    setFormData({ ...formData, items: newItems });
  };

  const removeCustomTax = (itemIndex: number, taxIndex: number) => {
    const newItems = [...formData.items];
    newItems[itemIndex].customTaxes = newItems[itemIndex].customTaxes.filter((_, i) => i !== taxIndex);
    setFormData({ ...formData, items: newItems });
  };

  const updateCustomTax = (itemIndex: number, taxIndex: number, field: 'name' | 'amount', value: string | number) => {
    const newItems = [...formData.items];
    newItems[itemIndex].customTaxes[taxIndex] = {
      ...newItems[itemIndex].customTaxes[taxIndex],
      [field]: value,
    };
    setFormData({ ...formData, items: newItems });
  };

  const removeItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const filteredInvoices = invoices.filter(inv => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      inv.uid_invoice.toLowerCase().includes(searchLower) ||
      inv.client?.clientCompanyName?.toLowerCase().includes(searchLower)
    );
  });

  if (loading && invoices.length === 0) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Factures</h1>
          <p className="text-dark-400">Gérez vos factures</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <FiPlus className="w-4 h-4" />
          Nouvelle facture
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Rechercher une facture..."
            className="input w-full pl-10"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          />
          <FiSearch className="w-5 h-5 text-dark-400 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>
        <div className="relative">
          <select
            className="input w-full"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="">Tous les statuts</option>
            <option value="pending">En attente</option>
            <option value="certified">Certifiée</option>
            <option value="rejected">Rejetée</option>
            <option value="refunded">Remboursée</option>
          </select>
        </div>
      </div>

      {filteredInvoices.length === 0 && !loading ? (
        <EmptyState icon={<FiFileText className="w-8 h-8" />} title="Aucune facture" description="Aucune facture trouvée pour le moment." />
      ) : (
        <>
          <CompanyInvoiceTable 
            invoices={filteredInvoices} 
            onCertify={handleCertify} 
            onEdit={handleEdit}
            onPrint={handlePrint}
          />
          {totalPages > 1 && (
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          )}
        </>
      )}

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingInvoiceId(null); }} title={editingInvoiceId ? "Modifier la facture" : "Nouvelle facture"} size="xl">
        <div className="max-h-[calc(100vh-220px)] overflow-y-auto pr-2 -mr-2">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Client *</label>
                <select
                  className="select w-full"
                  value={formData.clientid}
                  onChange={(e) => setFormData({ ...formData, clientid: parseInt(e.target.value) })}
                  required
                >
                  <option value="0">Sélectionner un client</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.clientCompanyName || client.ncc || `Client ${client.id}`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Point de vente *</label>
                <select
                  className="select w-full"
                  value={formData.pointdeventeid}
                  onChange={(e) => setFormData({ ...formData, pointdeventeid: parseInt(e.target.value) })}
                  required
                >
                  {pointdeventes.map(pdv => (
                    <option key={pdv.id} value={pdv.id}>{pdv.nom}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Type de facture *</label>
                <select
                  className="select w-full"
                  value={formData.type_invoice}
                  onChange={(e) => {
                    const newType = e.target.value as 'sale' | 'purchase';
                    // Mettre à jour les taxes des articles existants
                    const updatedItems = formData.items.map(item => ({
                      ...item,
                      taxes: newType === 'sale' && (!item.taxes || item.taxes === '') ? 'TVA18' : (newType === 'purchase' ? '' : item.taxes),
                    }));
                    setFormData({ ...formData, type_invoice: newType, items: updatedItems });
                  }}
                  required
                >
                  <option value="sale">Vente</option>
                  <option value="purchase">Achat</option>
                </select>
              </div>
              <div>
                <label className="label">Méthode de paiement *</label>
                <select
                  className="select w-full"
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  required
                >
                  <option value="cash">Espèces</option>
                  <option value="card">Carte</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="bank_transfer">Virement bancaire</option>
                  <option value="check">Chèque</option>
                </select>
              </div>
              <div>
                <label className="label">Nom du vendeur</label>
                <input
                  type="text"
                  className="input w-full"
                  value={formData.clientSellerName}
                  onChange={(e) => setFormData({ ...formData, clientSellerName: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Remise (%)</label>
                <input
                  type="number"
                  className="input w-full"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.remise_taux}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    const clampedValue = Math.min(Math.max(value, 0), 100);
                    setFormData({ ...formData, remise_taux: clampedValue });
                  }}
                />
                <p className="text-xs text-dark-400 mt-1">Pourcentage de 0 à 100</p>
              </div>
            </div>

          <div className="border-t border-dark-700 pt-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <h3 className="text-lg font-semibold text-white">Articles</h3>
              <button type="button" onClick={addItem} className="btn-secondary btn-sm flex items-center gap-2 w-full sm:w-auto">
                <FiPlus className="w-4 h-4" />
                Ajouter un article
              </button>
            </div>

            <div className="space-y-4">
              {formData.items.map((item, index) => (
                <div key={index} className="p-4 bg-dark-800 rounded-lg space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">Article {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="p-1 hover:bg-dark-700 rounded transition-colors"
                    >
                      <FiTrash2 className="w-4 h-4 text-danger-400" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="label text-xs">Référence *</label>
                      <input
                        type="text"
                        className="input w-full"
                        value={item.reference}
                        onChange={(e) => updateItem(index, 'reference', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="label text-xs">Unité de mesure</label>
                      <input
                        type="text"
                        className="input w-full"
                        value={item.measurementUnit}
                        onChange={(e) => updateItem(index, 'measurementUnit', e.target.value)}
                        placeholder="pcs"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <label className="label text-xs">Description *</label>
                      <input
                        type="text"
                        className="input w-full"
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="label text-xs">Quantité *</label>
                      <input
                        type="number"
                        className="input w-full"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                        required
                      />
                    </div>
                    <div>
                      <label className="label text-xs">Prix unitaire *</label>
                      <input
                        type="number"
                        className="input w-full"
                        min="0"
                        step="0.01"
                        value={item.amount}
                        onChange={(e) => updateItem(index, 'amount', parseFloat(e.target.value) || 0)}
                        required
                      />
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <label className="label text-xs">Remise (%)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="input flex-1"
                          min="0"
                          max="100"
                          step="0.01"
                          value={item.discount}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            const clampedValue = Math.min(Math.max(value, 0), 100);
                            updateItem(index, 'discount', clampedValue);
                          }}
                        />
                        <span className="text-xs text-dark-400">%</span>
                      </div>
                      <p className="text-xs text-dark-400 mt-1">Pourcentage de 0 à 100</p>
                    </div>
                    {formData.type_invoice === 'sale' && (
                      <div className="col-span-1 md:col-span-2">
                        <label className="label text-xs">Taxes * (TVA obligatoire pour les ventes)</label>
                        <div className="flex flex-wrap gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name={`tax-${index}`}
                              checked={item.taxes === 'TVA18'}
                              onChange={() => updateItem(index, 'taxes', 'TVA18')}
                              className="w-4 h-4 border-dark-600 bg-dark-800 text-primary-500 focus:ring-primary-500"
                            />
                            <span className="text-sm text-dark-300">TVA 18%</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name={`tax-${index}`}
                              checked={item.taxes === 'TVAB9'}
                              onChange={() => updateItem(index, 'taxes', 'TVAB9')}
                              className="w-4 h-4 border-dark-600 bg-dark-800 text-primary-500 focus:ring-primary-500"
                            />
                            <span className="text-sm text-dark-300">TVAB 9%</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name={`tax-${index}`}
                              checked={item.taxes === 'TVAC0'}
                              onChange={() => updateItem(index, 'taxes', 'TVAC0')}
                              className="w-4 h-4 border-dark-600 bg-dark-800 text-primary-500 focus:ring-primary-500"
                            />
                            <span className="text-sm text-dark-300">TVAC 0%</span>
                          </label>
                        </div>
                        {!item.taxes || (item.taxes !== 'TVA18' && item.taxes !== 'TVAB9' && item.taxes !== 'TVAC0') ? (
                          <p className="text-xs text-danger-400 mt-1">La TVA est obligatoire pour les factures de vente</p>
                        ) : null}
                      </div>
                    )}
                    <div className="col-span-1 md:col-span-2">
                      <div className="flex items-center justify-between mb-2">
                        <label className="label text-xs">Taxes personnalisées</label>
                        <button
                          type="button"
                          onClick={() => addCustomTax(index)}
                          className="btn-secondary btn-xs flex items-center gap-1"
                        >
                          <FiPlus className="w-3 h-3" />
                          Ajouter
                        </button>
                      </div>
                      {item.customTaxes.map((customTax, taxIndex) => (
                        <div key={taxIndex} className="flex gap-2 mb-2">
                          <input
                            type="text"
                            className="input flex-1 text-xs"
                            placeholder="Nom (ex: GRA)"
                            value={customTax.name}
                            onChange={(e) => updateCustomTax(index, taxIndex, 'name', e.target.value)}
                          />
                          <input
                            type="number"
                            className="input w-24 text-xs"
                            placeholder="Montant"
                            min="0"
                            step="0.01"
                            value={customTax.amount}
                            onChange={(e) => updateCustomTax(index, taxIndex, 'amount', parseFloat(e.target.value) || 0)}
                          />
                          <button
                            type="button"
                            onClick={() => removeCustomTax(index, taxIndex)}
                            className="p-2 hover:bg-dark-700 rounded transition-colors"
                          >
                            <FiTrash2 className="w-4 h-4 text-danger-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              {formData.items.length === 0 && (
                <p className="text-center text-dark-400 py-4">Aucun article. Cliquez sur "Ajouter un article" pour commencer.</p>
              )}
            </div>
          </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-dark-700 sticky bottom-0 bg-dark-900 pb-2 -mb-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="btn-secondary w-full sm:w-auto"
                disabled={submitting}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="btn-primary w-full sm:w-auto"
                disabled={submitting || formData.items.length === 0}
              >
                {submitting ? (editingInvoiceId ? 'Modification...' : 'Création...') : (editingInvoiceId ? 'Modifier et certifier' : 'Créer et certifier')}
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}

