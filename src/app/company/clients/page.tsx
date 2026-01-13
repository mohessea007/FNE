'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiUsers, FiSearch } from 'react-icons/fi';
import { DataTable, Badge, Modal, EmptyState, LoadingSpinner } from '@/components/ui';

interface Client {
  id: number;
  ncc: string;
  clientCompanyName: string;
  clientPhone: string;
  clientEmail: string;
  type_client: string;
  pointdevente: { id: number; nom: string };
  date_creation: string;
}

interface PointDeVente {
  id: number;
  nom: string;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [pointdeventes, setPointdeventes] = useState<PointDeVente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({
    ncc: '',
    clientCompanyName: '',
    clientPhone: '',
    clientEmail: '',
    pointdeventeid: 0,
    type_client: 'B2C' as 'B2B' | 'B2F' | 'B2G' | 'B2C',
  });
  const [createUserAccount, setCreateUserAccount] = useState(false);
  const [userFormData, setUserFormData] = useState({
    username: '',
    password: '',
    password_confirm: '',
  });

  const fetchData = async () => {
    try {
      const [clientsRes, pdvRes] = await Promise.all([
        fetch('/api/company/clients'),
        fetch('/api/company/pointdeventes'),
      ]);
      const [clientsData, pdvData] = await Promise.all([clientsRes.json(), pdvRes.json()]);
      if (clientsData.success) setClients(clientsData.data);
      if (pdvData.success) {
        setPointdeventes(pdvData.data);
        if (pdvData.data.length > 0 && formData.pointdeventeid === 0) {
          setFormData(prev => ({ ...prev, pointdeventeid: pdvData.data[0].id }));
        }
      }
    } catch {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Générer le username automatiquement à partir du nom de l'entreprise
  const generateUsername = (companyName: string) => {
    if (!companyName) return '';
    return companyName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
      .replace(/[^a-z0-9]/g, '') // Garder uniquement lettres et chiffres
      .substring(0, 15);
  };

  // Mettre à jour le username quand le nom de l'entreprise change et que la création de compte est activée
  useEffect(() => {
    if (createUserAccount && formData.clientCompanyName) {
      const generatedUsername = generateUsername(formData.clientCompanyName);
      if (generatedUsername) {
        setUserFormData(prev => ({ ...prev, username: generatedUsername }));
      }
    } else if (!createUserAccount) {
      setUserFormData({ username: '', password: '', password_confirm: '' });
    }
  }, [formData.clientCompanyName, createUserAccount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Si création de compte activée, valider les mots de passe
    if (createUserAccount && userFormData.password !== userFormData.password_confirm) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    if (createUserAccount && (!userFormData.username || !userFormData.password)) {
      toast.error('Le nom d\'utilisateur et le mot de passe sont requis');
      return;
    }

    const url = editingClient ? `/api/company/clients/${editingClient.id}` : '/api/company/clients';
    const method = editingClient ? 'PUT' : 'POST';

    try {
      const dataToSend = {
        ...formData,
        ...(createUserAccount && !editingClient ? {
          user_username: userFormData.username,
          user_password: userFormData.password,
        } : {}),
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(editingClient ? 'Client mis à jour' : 'Client créé');
        setShowModal(false);
        setEditingClient(null);
        setCreateUserAccount(false);
        setFormData({ 
          ncc: '', 
          clientCompanyName: '', 
          clientPhone: '', 
          clientEmail: '', 
          pointdeventeid: pointdeventes[0]?.id || 0, 
          type_client: 'B2C',
        });
        setUserFormData({ username: '', password: '', password_confirm: '' });
        fetchData();
      } else {
        toast.error(data.message || 'Erreur');
      }
    } catch {
      toast.error('Erreur serveur');
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      ncc: client.ncc || '',
      clientCompanyName: client.clientCompanyName || '',
      clientPhone: client.clientPhone || '',
      clientEmail: client.clientEmail || '',
      pointdeventeid: client.pointdevente.id,
      type_client: client.type_client as 'B2B' | 'B2F' | 'B2G' | 'B2C',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce client ?')) return;
    try {
      const res = await fetch(`/api/company/clients/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Client supprimé');
        fetchData();
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('Erreur serveur');
    }
  };

  const filteredClients = clients.filter(c => 
    (c.clientCompanyName?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (c.ncc?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (c.clientEmail?.toLowerCase() || '').includes(search.toLowerCase())
  );

  const columns = [
    { key: 'clientCompanyName', label: 'Nom', render: (v: string, row: Client) => (
      <div>
        <p className="font-medium text-white">{v || 'Sans nom'}</p>
        <p className="text-xs text-dark-400">{row.ncc || 'Sans NCC'}</p>
      </div>
    )},
    { key: 'clientPhone', label: 'Téléphone' },
    { key: 'clientEmail', label: 'Email' },
    { key: 'pointdevente', label: 'Point de vente', render: (v: PointDeVente) => v?.nom || '-' },
    { 
      key: 'type_client', 
      label: 'Type', 
      render: (v: string) => {
        const getVariant = (type: string) => {
          switch (type) {
            case 'B2B': return 'primary';
            case 'B2F': return 'warning';
            case 'B2G': return 'danger';
            case 'B2C': return 'success';
            default: return 'success';
          }
        };
        const getLabel = (type: string) => {
          switch (type) {
            case 'B2B': return 'B2B - Entreprise/Professionnel';
            case 'B2F': return 'B2F - International';
            case 'B2G': return 'B2G - Institution gouvernementale';
            case 'B2C': return 'B2C - Particulier';
            default: return type;
          }
        };
        return <Badge variant={getVariant(v)}>{getLabel(v)}</Badge>;
      }
    },
    { key: 'date_creation', label: 'Créé le', render: (v: string) => new Date(v).toLocaleDateString('fr-FR') },
    { key: 'actions', label: 'Actions', render: (_: any, row: Client) => (
      <div className="flex items-center gap-2">
        <button onClick={() => handleEdit(row)} className="p-2 rounded-lg hover:bg-dark-700 transition-colors"><FiEdit2 className="w-4 h-4 text-dark-400" /></button>
        <button onClick={() => handleDelete(row.id)} className="p-2 rounded-lg hover:bg-danger-500/20 transition-colors"><FiTrash2 className="w-4 h-4 text-danger-400" /></button>
      </div>
    )},
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Clients</h1>
          <p className="text-dark-400">Gérez vos clients</p>
        </div>
        <button onClick={() => { 
          setEditingClient(null); 
          setCreateUserAccount(false);
          setFormData({ 
            ncc: '', 
            clientCompanyName: '', 
            clientPhone: '', 
            clientEmail: '', 
            pointdeventeid: pointdeventes[0]?.id || 0, 
            type_client: 'B2C',
          }); 
          setUserFormData({ username: '', password: '', password_confirm: '' });
          setShowModal(true); 
        }} className="btn-primary">
          <FiPlus className="w-5 h-5" /> Nouveau client
        </button>
      </div>

      <div className="relative max-w-md">
        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-400" />
        <input type="text" placeholder="Rechercher..." className="input pl-12" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {filteredClients.length === 0 ? (
        <EmptyState icon={<FiUsers className="w-8 h-8" />} title="Aucun client" description="Ajoutez votre premier client" action={<button onClick={() => setShowModal(true)} className="btn-primary"><FiPlus className="w-5 h-5" /> Ajouter un client</button>} />
      ) : (
        <DataTable columns={columns} data={filteredClients} />
      )}

      <Modal isOpen={showModal} onClose={() => {
        setShowModal(false);
        setEditingClient(null);
        setCreateUserAccount(false);
        setFormData({ 
          ncc: '', 
          clientCompanyName: '', 
          clientPhone: '', 
          clientEmail: '', 
          pointdeventeid: pointdeventes[0]?.id || 0, 
          type_client: 'B2C',
        });
        setUserFormData({ username: '', password: '', password_confirm: '' });
      }} title={editingClient ? 'Modifier le client' : 'Nouveau client'} size="lg">
        <div className="max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-4">
              <div>
                <label className="label">Nom de l&apos;entreprise</label>
                <input type="text" className="input" value={formData.clientCompanyName} onChange={(e) => setFormData({ ...formData, clientCompanyName: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">NCC</label>
                  <input type="text" className="input" value={formData.ncc} onChange={(e) => setFormData({ ...formData, ncc: e.target.value })} />
                </div>
                <div>
                  <label className="label">Type</label>
                  <select className="select" value={formData.type_client} onChange={(e) => setFormData({ ...formData, type_client: e.target.value as 'B2B' | 'B2F' | 'B2G' | 'B2C' })}>
                    <option value="B2B">B2B - Entreprise/Professionnel (NCC)</option>
                    <option value="B2F">B2F - International</option>
                    <option value="B2G">B2G - Institution gouvernementale</option>
                    <option value="B2C">B2C - Particulier</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Téléphone</label>
                <input type="text" className="input" value={formData.clientPhone} onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })} />
              </div>
              <div>
                <label className="label">Email (optionnel)</label>
                <input type="email" className="input" value={formData.clientEmail} onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })} />
              </div>
              <div>
                <label className="label">Point de vente *</label>
                <select className="select" value={formData.pointdeventeid} onChange={(e) => setFormData({ ...formData, pointdeventeid: parseInt(e.target.value) })} required>
                  {pointdeventes.map(pdv => <option key={pdv.id} value={pdv.id}>{pdv.nom}</option>)}
                </select>
              </div>
            </div>

            {!editingClient && (
              <div className="pt-4 border-t border-dark-700">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createUserAccount}
                    onChange={(e) => setCreateUserAccount(e.target.checked)}
                    className="w-5 h-5 rounded border-dark-600 bg-dark-800 text-primary-500 focus:ring-primary-500 focus:ring-2"
                  />
                  <span className="text-white font-medium">Créer un compte utilisateur pour ce client</span>
                </label>
              </div>
            )}

            {!editingClient && createUserAccount && (
              <div className="space-y-4 pt-4 border-t border-dark-700">
                <h3 className="text-lg font-semibold text-white">Compte utilisateur</h3>
                <p className="text-sm text-dark-400">
                  Le compte utilisateur utilisera le nom de l&apos;entreprise et l&apos;email du client. 
                  Le nom d&apos;utilisateur sera généré automatiquement.
                </p>
                <div>
                  <label className="label">Nom d&apos;utilisateur (généré automatiquement)</label>
                  <input 
                    type="text" 
                    className="input bg-dark-800 cursor-not-allowed" 
                    value={userFormData.username} 
                    readOnly
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Mot de passe *</label>
                    <input 
                      type="password" 
                      className="input" 
                      value={userFormData.password} 
                      onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })} 
                      required
                      minLength={6}
                    />
                  </div>
                  <div>
                    <label className="label">Confirmer le mot de passe *</label>
                    <input 
                      type="password" 
                      className="input" 
                      value={userFormData.password_confirm} 
                      onChange={(e) => setUserFormData({ ...userFormData, password_confirm: e.target.value })} 
                      required
                      minLength={6}
                    />
                  </div>
                </div>
                {userFormData.password && userFormData.password_confirm && userFormData.password !== userFormData.password_confirm && (
                  <p className="text-sm text-danger-400">Les mots de passe ne correspondent pas</p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-dark-700 sticky bottom-0 bg-dark-900 -mx-6 -mb-6 px-6 pb-6">
              <button 
                type="button" 
                onClick={() => {
                  setShowModal(false);
                  setEditingClient(null);
                  setCreateUserAccount(false);
                  setFormData({ 
                    ncc: '', 
                    clientCompanyName: '', 
                    clientPhone: '', 
                    clientEmail: '', 
                    pointdeventeid: pointdeventes[0]?.id || 0, 
                    type_client: 'B2C',
                  });
                  setUserFormData({ username: '', password: '', password_confirm: '' });
                }} 
                className="btn-secondary"
              >
                Annuler
              </button>
              <button 
                type="submit" 
                className="btn-primary"
              >
                {editingClient ? 'Mettre à jour' : 'Créer'}
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
