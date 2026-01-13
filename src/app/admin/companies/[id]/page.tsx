'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiBriefcase, FiMapPin, FiUsers, FiFileText, FiCopy, FiEdit2, FiTrash2, FiLogIn } from 'react-icons/fi';
import { Badge, LoadingSpinner, StatCard, Modal } from '@/components/ui';

interface CompanyDetail {
  id: number;
  uid_companie: string;
  nom: string;
  ncc: string;
  api_key: string | null;
  token_fne: string;
  commercialMessage: string;
  footer: string;
  localisation: string;
  is_active: boolean;
  date_creation: string;
  date_modification: string;
  pointdeventes: Array<{
    id: number;
    nom: string;
    is_default: boolean;
    is_active: boolean;
    date_creation: string;
  }>;
  clients: Array<{
    id: number;
    ncc: string | null;
    clientCompanyName: string | null;
    clientPhone: string | null;
    clientEmail: string | null;
    type_client: string;
    is_active: boolean;
    date_creation: string;
  }>;
  users: Array<{
    id: number;
    username: string;
    nom: string;
    type_user: string;
    role: string;
  }>;
  _count: {
    invoices: number;
  };
}

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    nom: '',
    ncc: '',
    commercialMessage: '',
    footer: '',
    localisation: '',
    is_active: true,
  });

  useEffect(() => {
    fetchCompany();
  }, [id]);

  const fetchCompany = async () => {
    try {
      const res = await fetch(`/api/admin/companies/${id}`);
      const data = await res.json();
      if (data.success) {
        setCompany(data.data);
        setEditFormData({
          nom: data.data.nom,
          ncc: data.data.ncc,
          commercialMessage: data.data.commercialMessage || '',
          footer: data.data.footer || '',
          localisation: data.data.localisation || '',
          is_active: data.data.is_active,
        });
      } else {
        toast.error(data.message || 'Entreprise non trouvée');
        router.push('/admin/companies');
      }
    } catch (error) {
      toast.error('Erreur lors du chargement');
      router.push('/admin/companies');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    if (company) {
      setShowEditModal(true);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/admin/companies/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Entreprise mise à jour');
        setShowEditModal(false);
        fetchCompany();
      } else {
        toast.error(data.message || 'Erreur');
      }
    } catch {
      toast.error('Erreur serveur');
    }
  };

  const handleImpersonate = async () => {
    if (!confirm('Vous allez vous connecter en tant que cette entreprise. Continuer ?')) return;
    try {
      const res = await fetch(`/api/admin/companies/${id}/impersonate`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Connexion en tant que ${data.data.companyName}`);
        router.push('/company');
      } else {
        toast.error(data.message || 'Erreur');
      }
    } catch {
      toast.error('Erreur serveur');
    }
  };


  if (loading) return <LoadingSpinner />;
  if (!company) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/companies" className="p-2 rounded-lg hover:bg-dark-800 transition-colors">
            <FiArrowLeft className="w-5 h-5 text-dark-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">{company.nom}</h1>
            <p className="text-dark-400">Détails de l&apos;entreprise</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleEdit} className="btn-secondary">
            <FiEdit2 className="w-4 h-4" /> Modifier
          </button>
          <button onClick={handleImpersonate} className="btn-primary">
            <FiLogIn className="w-4 h-4" /> Se connecter en tant que
          </button>
          <Badge variant={company.is_active ? 'success' : 'danger'}>
            {company.is_active ? 'Actif' : 'Inactif'}
          </Badge>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Points de vente"
          value={company.pointdeventes.length}
          icon={<FiMapPin className="w-6 h-6 text-white" />}
          color="primary"
        />
        <StatCard
          title="Clients"
          value={company.clients.length}
          icon={<FiUsers className="w-6 h-6 text-white" />}
          color="accent"
        />
        <StatCard
          title="Factures"
          value={company._count.invoices}
          icon={<FiFileText className="w-6 h-6 text-white" />}
          color="warning"
        />
        <StatCard
          title="Utilisateurs"
          value={company.users.length}
          icon={<FiUsers className="w-6 h-6 text-white" />}
          color="success"
        />
      </div>

      {/* Informations principales */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Informations générales */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Informations générales</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-dark-400">Nom</label>
              <p className="text-white font-medium">{company.nom}</p>
            </div>
            <div>
              <label className="text-sm text-dark-400">NCC</label>
              <p className="text-white font-medium">{company.ncc}</p>
            </div>
            <div>
              <label className="text-sm text-dark-400">UID Entreprise</label>
              <p className="text-white font-mono text-sm">{company.uid_companie}</p>
            </div>
            <div>
              <label className="text-sm text-dark-400">Localisation</label>
              <p className="text-white">{company.localisation || '-'}</p>
            </div>
            <div>
              <label className="text-sm text-dark-400">Date de création</label>
              <p className="text-white">{new Date(company.date_creation).toLocaleDateString('fr-FR')}</p>
            </div>
          </div>
        </div>

      </div>

      {/* Messages */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Message commercial</h2>
          <p className="text-dark-300 whitespace-pre-wrap">{company.commercialMessage || '-'}</p>
        </div>
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Footer</h2>
          <p className="text-dark-300 whitespace-pre-wrap">{company.footer || '-'}</p>
        </div>
      </div>

      {/* Points de vente */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Points de vente ({company.pointdeventes.length})</h2>
        {company.pointdeventes.length === 0 ? (
          <p className="text-dark-400">Aucun point de vente</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {company.pointdeventes.map((pdv) => (
              <div key={pdv.id} className="p-4 rounded-xl bg-dark-800/50 hover:bg-dark-800 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FiMapPin className="w-4 h-4 text-primary-400" />
                    <p className="font-medium text-white">{pdv.nom}</p>
                  </div>
                  {pdv.is_default && <Badge variant="primary">Par défaut</Badge>}
                </div>
                <p className="text-xs text-dark-400">Créé le {new Date(pdv.date_creation).toLocaleDateString('fr-FR')}</p>
                <div className="mt-2">
                  <Badge variant={pdv.is_active ? 'success' : 'danger'}>
                    {pdv.is_active ? 'Actif' : 'Inactif'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Clients */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Clients ({company.clients.length})</h2>
        {company.clients.length === 0 ? (
          <p className="text-dark-400">Aucun client</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>NCC</th>
                  <th>Téléphone</th>
                  <th>Email</th>
                  <th>Type</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {company.clients.map((client) => (
                  <tr key={client.id}>
                    <td className="font-medium text-white">{client.clientCompanyName || '-'}</td>
                    <td className="text-dark-300">{client.ncc || '-'}</td>
                    <td className="text-dark-300">{client.clientPhone || '-'}</td>
                    <td className="text-dark-300">{client.clientEmail || '-'}</td>
                    <td>
                      <Badge variant={client.type_client === 'B2B' ? 'primary' : 'success'}>
                        {client.type_client}
                      </Badge>
                    </td>
                    <td>
                      <Badge variant={client.is_active ? 'success' : 'danger'}>
                        {client.is_active ? 'Actif' : 'Inactif'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Utilisateurs */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Utilisateurs ({company.users.length})</h2>
        {company.users.length === 0 ? (
          <p className="text-dark-400">Aucun utilisateur</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Nom d&apos;utilisateur</th>
                  <th>Type</th>
                  <th>Rôle</th>
                </tr>
              </thead>
              <tbody>
                {company.users.map((user) => (
                  <tr key={user.id}>
                    <td className="font-medium text-white">{user.nom}</td>
                    <td className="text-dark-300">@{user.username}</td>
                    <td>
                      <Badge variant={user.type_user === 'admin' ? 'primary' : 'info'}>
                        {user.type_user}
                      </Badge>
                    </td>
                    <td>
                      <Badge variant={user.role === 'admin' ? 'primary' : 'info'}>
                        {user.role}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Modifier l'entreprise" size="lg">
        <div className="max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Nom de l&apos;entreprise *</label>
                <input
                  type="text"
                  className="input"
                  value={editFormData.nom}
                  onChange={(e) => setEditFormData({ ...editFormData, nom: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">NCC *</label>
                <input
                  type="text"
                  className="input"
                  value={editFormData.ncc}
                  onChange={(e) => setEditFormData({ ...editFormData, ncc: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <label className="label">Localisation</label>
              <input
                type="text"
                className="input"
                value={editFormData.localisation}
                onChange={(e) => setEditFormData({ ...editFormData, localisation: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Message commercial</label>
              <textarea
                className="input resize-none"
                rows={3}
                value={editFormData.commercialMessage}
                onChange={(e) => setEditFormData({ ...editFormData, commercialMessage: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Footer</label>
              <textarea
                className="input resize-none"
                rows={3}
                value={editFormData.footer}
                onChange={(e) => setEditFormData({ ...editFormData, footer: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={editFormData.is_active}
                onChange={(e) => setEditFormData({ ...editFormData, is_active: e.target.checked })}
                className="w-4 h-4 rounded border-dark-700 bg-dark-800 text-primary-500 focus:ring-primary-500"
              />
              <label htmlFor="is_active" className="label cursor-pointer">
                Entreprise active
              </label>
            </div>
            <div className="text-xs text-dark-400 p-3 bg-dark-800/50 rounded-lg">
              <p className="font-medium mb-1">Note : Le token FNE ne peut pas être modifié pour des raisons de sécurité.</p>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-dark-700 sticky bottom-0 bg-dark-900 -mx-6 -mb-6 px-6 pb-6">
              <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary">
                Annuler
              </button>
              <button type="submit" className="btn-primary">
                Enregistrer les modifications
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}

