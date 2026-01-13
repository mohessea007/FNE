'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiMapPin, FiSearch } from 'react-icons/fi';
import { DataTable, Badge, Modal, EmptyState, LoadingSpinner } from '@/components/ui';

interface PointDeVente {
  id: number;
  nom: string;
  is_default: boolean;
  is_active: boolean;
  date_creation: string;
  date_modification: string;
}

export default function PointDeVentesPage() {
  const [pointdeventes, setPointdeventes] = useState<PointDeVente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPdV, setEditingPdV] = useState<PointDeVente | null>(null);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({
    nom: '',
    is_default: false,
  });

  const fetchPointDeVentes = async () => {
    try {
      const res = await fetch('/api/company/pointdeventes');
      const data = await res.json();
      if (data.success) {
        setPointdeventes(data.data);
      }
    } catch {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPointDeVentes();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingPdV ? `/api/company/pointdeventes/${editingPdV.id}` : '/api/company/pointdeventes';
    const method = editingPdV ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(editingPdV ? 'Point de vente mis à jour' : 'Point de vente créé');
        setShowModal(false);
        setEditingPdV(null);
        setFormData({ nom: '', is_default: false });
        fetchPointDeVentes();
      } else {
        toast.error(data.message || 'Erreur');
      }
    } catch {
      toast.error('Erreur serveur');
    }
  };

  const handleEdit = (pdv: PointDeVente) => {
    setEditingPdV(pdv);
    setFormData({
      nom: pdv.nom,
      is_default: pdv.is_default,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce point de vente ?')) return;
    try {
      const res = await fetch(`/api/company/pointdeventes/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Point de vente supprimé');
        fetchPointDeVentes();
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('Erreur serveur');
    }
  };

  const filteredPdVs = pointdeventes.filter(pdv => {
    if (!search) return true;
    return pdv.nom.toLowerCase().includes(search.toLowerCase());
  });

  const columns = [
    {
      key: 'nom',
      label: 'Nom',
      render: (v: string, row: PointDeVente) => (
        <div className="flex items-center gap-2">
          <FiMapPin className="w-4 h-4 text-primary-400" />
          <span className="font-medium text-white">{v}</span>
          {row.is_default && <Badge variant="primary">Par défaut</Badge>}
        </div>
      )
    },
    {
      key: 'is_active',
      label: 'Statut',
      render: (v: boolean) => <Badge variant={v ? 'success' : 'danger'}>{v ? 'Actif' : 'Inactif'}</Badge>
    },
    {
      key: 'date_creation',
      label: 'Date de création',
      render: (v: string) => new Date(v).toLocaleDateString('fr-FR')
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: any, row: PointDeVente) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleEdit(row)}
            className="p-2 rounded-lg hover:bg-dark-700 transition-colors"
            title="Modifier"
          >
            <FiEdit2 className="w-4 h-4 text-dark-400" />
          </button>
          <button
            onClick={() => handleDelete(row.id)}
            className="p-2 rounded-lg hover:bg-danger-500/20 transition-colors"
            title="Supprimer"
          >
            <FiTrash2 className="w-4 h-4 text-danger-400" />
          </button>
        </div>
      )
    },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Points de vente</h1>
          <p className="text-dark-400">Gérez vos points de vente</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <FiPlus className="w-5 h-5" /> Nouveau point de vente
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dark-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Rechercher un point de vente..."
          className="input pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filteredPdVs.length === 0 ? (
        <EmptyState
          icon={<FiMapPin className="w-8 h-8" />}
          title="Aucun point de vente"
          description="Créez votre premier point de vente pour commencer"
          action={<button onClick={() => setShowModal(true)} className="btn-primary"><FiPlus className="w-5 h-5" /> Créer un point de vente</button>}
        />
      ) : (
        <DataTable columns={columns} data={filteredPdVs} />
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingPdV(null); setFormData({ nom: '', is_default: false }); }} title={editingPdV ? 'Modifier le point de vente' : 'Nouveau point de vente'} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nom *</label>
            <input
              type="text"
              className="input"
              value={formData.nom}
              onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
              required
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_default"
              checked={formData.is_default}
              onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
              className="w-4 h-4 rounded border-dark-700 bg-dark-800 text-primary-500 focus:ring-primary-500"
            />
            <label htmlFor="is_default" className="label cursor-pointer">
              Point de vente par défaut
            </label>
          </div>
          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-dark-700">
            <button type="button" onClick={() => { setShowModal(false); setEditingPdV(null); setFormData({ nom: '', is_default: false }); }} className="btn-secondary">
              Annuler
            </button>
            <button type="submit" className="btn-primary">
              {editingPdV ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

