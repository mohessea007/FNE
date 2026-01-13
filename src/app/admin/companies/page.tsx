'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiCopy, FiBriefcase } from 'react-icons/fi';
import { DataTable, Badge, Modal, EmptyState, LoadingSpinner } from '@/components/ui';

interface Company {
  id: number;
  uid_companie: string;
  nom: string;
  ncc: string;
  api_key: string;
  localisation: string;
  is_active: boolean;
  date_creation: string;
  _count: {
    clients: number;
    invoices: number;
    users: number;
  };
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState({
    nom: '',
    ncc: '',
    token_fne: '',
    commercialMessage: '',
    footer: '',
    localisation: '',
    defaultPointDeVente: 'Point de vente principal',
    owner_nom: '',
    owner_email: '',
    owner_username: '',
    owner_password: '',
    owner_password_confirm: '',
  });

  // Générer automatiquement le username basé sur le nom complet
  const generateUsername = (nomComplet: string, email: string) => {
    if (!nomComplet && !email) return '';
    
    // Prendre le nom complet, le convertir en minuscules, remplacer les espaces et caractères spéciaux
    const base = nomComplet.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
      .replace(/[^a-z0-9]/g, '') // Garder uniquement lettres et chiffres
      .substring(0, 15); // Limiter à 15 caractères
    
    // Si pas assez de caractères, utiliser le début de l'email
    if (base.length < 3 && email) {
      const emailBase = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15);
      return emailBase || '';
    }
    
    return base || '';
  };

  // Générer le username quand le nom complet ou l'email change
  useEffect(() => {
    if (formData.owner_nom || formData.owner_email) {
      const generatedUsername = generateUsername(formData.owner_nom, formData.owner_email);
      setFormData(prev => ({ ...prev, owner_username: generatedUsername }));
    }
  }, [formData.owner_nom, formData.owner_email]);

  const fetchCompanies = async () => {
    try {
      const res = await fetch('/api/admin/companies');
      const data = await res.json();
      if (data.success) {
        setCompanies(data.data);
      }
    } catch (error) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Vérifier que les mots de passe correspondent
    if (formData.owner_password !== formData.owner_password_confirm) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    try {
      // Préparer les données à envoyer (exclure password_confirm)
      const { owner_password_confirm, ...dataToSend } = formData;
      
      const res = await fetch('/api/admin/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Entreprise créée avec succès');
        setShowModal(false);
        setFormData({ 
          nom: '', 
          ncc: '', 
          token_fne: '', 
          commercialMessage: '', 
          footer: '', 
          localisation: '', 
          defaultPointDeVente: 'Point de vente principal',
          owner_nom: '',
          owner_email: '',
          owner_username: '',
          owner_password: '',
          owner_password_confirm: '',
        });
        fetchCompanies();
        // Show owner credentials only
        if (data.data.owner_username && data.data.owner_password) {
          toast((t) => (
            <div className="space-y-3">
              <div>
                <p className="font-medium mb-2">Identifiants du propriétaire :</p>
                <div className="space-y-2 mb-2">
                  <div>
                    <p className="text-xs text-dark-400">Nom d&apos;utilisateur :</p>
                    <code className="text-xs bg-dark-800 p-2 rounded block">{data.data.owner_username}</code>
                  </div>
                  <div>
                    <p className="text-xs text-dark-400">Mot de passe :</p>
                    <code className="text-xs bg-dark-800 p-2 rounded block">{data.data.owner_password}</code>
                  </div>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(`Username: ${data.data.owner_username}\nPassword: ${data.data.owner_password}`); toast.dismiss(t.id); toast.success('Identifiants copiés !'); }} className="btn-secondary btn-sm w-full">
                  <FiCopy className="w-4 h-4" /> Copier identifiants
                </button>
              </div>
            </div>
          ), { duration: 15000 });
        }
      } else {
        toast.error(data.message || 'Erreur');
      }
    } catch {
      toast.error('Erreur serveur');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer cette entreprise ?')) return;
    try {
      const res = await fetch(`/api/admin/companies/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Entreprise supprimée');
        fetchCompanies();
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('Erreur serveur');
    }
  };


  const columns = [
    { key: 'nom', label: 'Nom', render: (v: string, row: Company) => (
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500/20 to-accent-500/20 flex items-center justify-center">
          <FiBriefcase className="w-5 h-5 text-primary-400" />
        </div>
        <div>
          <p className="font-medium text-white">{v}</p>
          <p className="text-xs text-dark-400">{row.ncc}</p>
        </div>
      </div>
    )},
    { key: 'localisation', label: 'Localisation' },
    { key: '_count', label: 'Stats', render: (_: any, row: Company) => (
      <div className="text-xs space-y-1">
        <p>{row._count.invoices} factures</p>
        <p>{row._count.clients} clients</p>
      </div>
    )},
    { key: 'is_active', label: 'Statut', render: (v: boolean) => <Badge variant={v ? 'success' : 'danger'}>{v ? 'Actif' : 'Inactif'}</Badge> },
    { key: 'date_creation', label: 'Créée le', render: (v: string) => new Date(v).toLocaleDateString('fr-FR') },
    { key: 'actions', label: 'Actions', render: (_: any, row: Company) => (
      <div className="flex items-center gap-2">
        <Link href={`/admin/companies/${row.id}`} className="p-2 rounded-lg hover:bg-dark-700 transition-colors" title="Voir">
          <FiEye className="w-4 h-4 text-dark-400" />
        </Link>
        <button onClick={() => handleDelete(row.id)} className="p-2 rounded-lg hover:bg-danger-500/20 transition-colors" title="Supprimer">
          <FiTrash2 className="w-4 h-4 text-danger-400" />
        </button>
      </div>
    )},
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Entreprises</h1>
          <p className="text-dark-400">Gérez les entreprises inscrites sur la plateforme</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <FiPlus className="w-5 h-5" /> Nouvelle entreprise
        </button>
      </div>

      {companies.length === 0 ? (
        <EmptyState icon={<FiBriefcase className="w-8 h-8" />} title="Aucune entreprise" description="Créez votre première entreprise pour commencer" action={<button onClick={() => setShowModal(true)} className="btn-primary"><FiPlus className="w-5 h-5" /> Créer une entreprise</button>} />
      ) : (
        <DataTable columns={columns} data={companies} />
      )}

      <Modal isOpen={showModal} onClose={() => {
        setShowModal(false);
        setFormData({ 
          nom: '', 
          ncc: '', 
          token_fne: '', 
          commercialMessage: '', 
          footer: '', 
          localisation: '', 
          defaultPointDeVente: 'Point de vente principal',
          owner_nom: '',
          owner_email: '',
          owner_username: '',
          owner_password: '',
          owner_password_confirm: '',
        });
      }} title="Nouvelle entreprise" size="lg">
        <div className="max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Informations de l&apos;entreprise</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Nom de l&apos;entreprise *</label>
                  <input type="text" className="input" value={formData.nom} onChange={(e) => setFormData({ ...formData, nom: e.target.value })} required />
                </div>
                <div>
                  <label className="label">NCC *</label>
                  <input type="text" className="input" value={formData.ncc} onChange={(e) => setFormData({ ...formData, ncc: e.target.value })} required />
                </div>
              </div>
              <div>
                <label className="label">Token FNE *</label>
                <input type="text" className="input" value={formData.token_fne} onChange={(e) => setFormData({ ...formData, token_fne: e.target.value })} required />
              </div>
              <div>
                <label className="label">Localisation</label>
                <input type="text" className="input" value={formData.localisation} onChange={(e) => setFormData({ ...formData, localisation: e.target.value })} />
              </div>
              <div>
                <label className="label">Message commercial</label>
                <textarea className="input resize-none" rows={3} value={formData.commercialMessage} onChange={(e) => setFormData({ ...formData, commercialMessage: e.target.value })} />
              </div>
              <div>
                <label className="label">Footer</label>
                <textarea className="input resize-none" rows={3} value={formData.footer} onChange={(e) => setFormData({ ...formData, footer: e.target.value })} />
              </div>
              <div>
                <label className="label">Point de vente par défaut</label>
                <input type="text" className="input" value={formData.defaultPointDeVente} onChange={(e) => setFormData({ ...formData, defaultPointDeVente: e.target.value })} />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-dark-700">
              <h3 className="text-lg font-semibold text-white">Compte propriétaire</h3>
              <div>
                <label className="label">Nom complet *</label>
                <input 
                  type="text" 
                  className="input" 
                  value={formData.owner_nom} 
                  onChange={(e) => setFormData({ ...formData, owner_nom: e.target.value })} 
                  required 
                />
              </div>
              <div>
                <label className="label">Email *</label>
                <input 
                  type="email" 
                  className="input" 
                  value={formData.owner_email} 
                  onChange={(e) => setFormData({ ...formData, owner_email: e.target.value })} 
                  required 
                />
              </div>
              <div>
                <label className="label">Nom d&apos;utilisateur (généré automatiquement) *</label>
                <input 
                  type="text" 
                  className="input" 
                  value={formData.owner_username} 
                   
                  required 
                />
                <p className="text-xs text-dark-400 mt-1">Généré automatiquement à partir du nom complet</p>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Mot de passe *</label>
                  <input 
                    type="password" 
                    className="input" 
                    value={formData.owner_password} 
                    onChange={(e) => setFormData({ ...formData, owner_password: e.target.value })} 
                    required 
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="label">Confirmer le mot de passe *</label>
                  <input 
                    type="password" 
                    className="input" 
                    value={formData.owner_password_confirm} 
                    onChange={(e) => setFormData({ ...formData, owner_password_confirm: e.target.value })} 
                    required 
                    minLength={6}
                  />
                </div>
              </div>
              {formData.owner_password && formData.owner_password_confirm && formData.owner_password !== formData.owner_password_confirm && (
                <p className="text-sm text-danger-400">Les mots de passe ne correspondent pas</p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-dark-700 sticky bottom-0 bg-dark-900 -mx-6 -mb-6 px-6 pb-6">
              <button type="button" onClick={() => {
                setShowModal(false);
                setFormData({ 
                  nom: '', 
                  ncc: '', 
                  token_fne: '', 
                  commercialMessage: '', 
                  footer: '', 
                  localisation: '', 
                  defaultPointDeVente: 'Point de vente principal',
                  owner_nom: '',
                  owner_email: '',
                  owner_username: '',
                  owner_password: '',
                  owner_password_confirm: '',
                });
              }} className="btn-secondary">Annuler</button>
              <button 
                type="submit" 
                className="btn-primary"
                disabled={formData.owner_password !== formData.owner_password_confirm}
              >
                Créer l&apos;entreprise
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
