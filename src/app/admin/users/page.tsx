'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2, FiUsers, FiSearch } from 'react-icons/fi';
import { DataTable, Badge, Modal, EmptyState, LoadingSpinner } from '@/components/ui';

interface User {
  id: number;
  username: string;
  nom: string;
  email: string | null;
  type_user: string;
  role: string;
  is_active: boolean;
  date_creation: string;
  last_login: string | null;
  company: { id: number; nom: string; uid_companie: string } | null;
  client: { id: number; clientCompanyName: string } | null;
}

interface Company {
  id: number;
  nom: string;
  uid_companie: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    nom: '',
    email: '',
    type_user: 'admin' as 'developer' | 'superadmin' | 'admin' | 'owner',
    role: 'user' as 'admin' | 'user',
    companieid: null as number | null,
  });

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
      }
    } catch (error) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await fetch('/api/admin/companies');
      const data = await res.json();
      if (data.success) {
        setCompanies(data.data);
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchCompanies();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          companieid: formData.companieid || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Utilisateur créé avec succès');
        setShowModal(false);
        setFormData({ username: '', password: '', nom: '', email: '', type_user: 'admin', role: 'user', companieid: null });
        fetchUsers();
      } else {
        toast.error(data.message || 'Erreur');
      }
    } catch {
      toast.error('Erreur serveur');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer cet utilisateur ?')) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Utilisateur supprimé');
        fetchUsers();
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('Erreur serveur');
    }
  };

  const filteredUsers = users.filter(u =>
    (u.username?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (u.nom?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (u.email?.toLowerCase() || '').includes(search.toLowerCase())
  );

  const getUserTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      developer: 'Développeur',
      superadmin: 'Super Admin',
      admin: 'Admin',
      owner: 'Propriétaire',
    };
    return types[type] || type;
  };

  const getUserTypeColor = (type: string): 'primary' | 'success' | 'warning' | 'danger' | 'info' => {
    if (type === 'developer') return 'info';
    if (type === 'superadmin') return 'danger';
    if (type === 'admin') return 'primary';
    if (type === 'owner') return 'warning';
    return 'success';
  };

  const columns = [
    {
      key: 'nom',
      label: 'Utilisateur',
      render: (v: string, row: User) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500/20 to-accent-500/20 flex items-center justify-center">
            <FiUsers className="w-5 h-5 text-primary-400" />
          </div>
          <div>
            <p className="font-medium text-white">{v}</p>
            <p className="text-xs text-dark-400">@{row.username}</p>
          </div>
        </div>
      ),
    },
    { key: 'email', label: 'Email', render: (v: string | null) => v || '-' },
    {
      key: 'type_user',
      label: 'Type',
      render: (v: string) => <Badge variant={getUserTypeColor(v)}>{getUserTypeLabel(v)}</Badge>,
    },
    {
      key: 'role',
      label: 'Rôle',
      render: (v: string) => <Badge variant={v === 'admin' ? 'primary' : 'info'}>{v === 'admin' ? 'Admin' : 'Utilisateur'}</Badge>,
    },
    {
      key: 'company',
      label: 'Entreprise',
      render: (v: { nom: string } | null) => v?.nom || '-',
    },
    {
      key: 'is_active',
      label: 'Statut',
      render: (v: boolean) => <Badge variant={v ? 'success' : 'danger'}>{v ? 'Actif' : 'Inactif'}</Badge>,
    },
    {
      key: 'last_login',
      label: 'Dernière connexion',
      render: (v: string | null) => (v ? new Date(v).toLocaleDateString('fr-FR') : 'Jamais'),
    },
    {
      key: 'date_creation',
      label: 'Créé le',
      render: (v: string) => new Date(v).toLocaleDateString('fr-FR'),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: any, row: User) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDelete(row.id)}
            className="p-2 rounded-lg hover:bg-danger-500/20 transition-colors"
            title="Supprimer"
          >
            <FiTrash2 className="w-4 h-4 text-danger-400" />
          </button>
        </div>
      ),
    },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Utilisateurs</h1>
          <p className="text-dark-400">Gérez les utilisateurs de la plateforme</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <FiPlus className="w-5 h-5" /> Nouvel utilisateur
        </button>
      </div>

      <div className="relative max-w-md">
        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-400" />
        <input
          type="text"
          placeholder="Rechercher..."
          className="input pl-12"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filteredUsers.length === 0 ? (
        <EmptyState
          icon={<FiUsers className="w-8 h-8" />}
          title="Aucun utilisateur"
          description="Créez votre premier utilisateur pour commencer"
          action={
            <button onClick={() => setShowModal(true)} className="btn-primary">
              <FiPlus className="w-5 h-5" /> Créer un utilisateur
            </button>
          }
        />
      ) : (
        <DataTable columns={columns} data={filteredUsers} />
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nouvel utilisateur" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="label">Nom d&apos;utilisateur *</label>
              <input
                type="text"
                className="input"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Mot de passe *</label>
              <input
                type="password"
                className="input"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={6}
              />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="label">Nom complet *</label>
              <input
                type="text"
                className="input"
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="label">Type d&apos;utilisateur *</label>
              <select
                className="input"
                value={formData.type_user}
                onChange={(e) => setFormData({ ...formData, type_user: e.target.value as any })}
                required
              >
                <option value="developer">Développeur</option>
                <option value="superadmin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="owner">Propriétaire</option>
              </select>
            </div>
            <div>
              <label className="label">Rôle *</label>
              <select
                className="input"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                required
              >
                <option value="user">Utilisateur</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Entreprise (optionnel)</label>
            <select
              className="input"
              value={formData.companieid || ''}
              onChange={(e) => setFormData({ ...formData, companieid: e.target.value ? parseInt(e.target.value) : null })}
            >
              <option value="">Aucune entreprise</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.nom}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
              Annuler
            </button>
            <button type="submit" className="btn-primary">
              Créer l&apos;utilisateur
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

