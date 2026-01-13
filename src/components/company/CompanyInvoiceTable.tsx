'use client';

import Link from 'next/link';
import { DataTable, Badge } from '@/components/ui';
import { FiCheckCircle, FiEdit2, FiEye, FiPrinter } from 'react-icons/fi';

interface Invoice {
  id: number;
  uid_invoice: string;
  client?: { clientCompanyName: string | null };
  type_invoice: string;
  status: string;
  date_creation: string;
  items: Array<{ amount: number; quantity: number }>;
}

interface CompanyInvoiceTableProps {
  invoices: Invoice[];
  onCertify?: (invoiceId: number) => void;
  onEdit?: (invoiceId: number) => void;
  onPrint?: (invoiceId: number) => void;
}

export function CompanyInvoiceTable({ invoices, onCertify, onEdit, onPrint }: CompanyInvoiceTableProps) {
  const invoiceColumns = [
    { 
      key: 'uid_invoice', 
      label: 'UID', 
      render: (v: string) => <code className="text-xs text-primary-400">{v.slice(0, 8)}...</code> 
    },
    { 
      key: 'client', 
      label: 'Client', 
      render: (_: any, row: Invoice) => row.client?.clientCompanyName || '-' 
    },
    { 
      key: 'type_invoice', 
      label: 'Type', 
      render: (v: string, row: Invoice) => {
        const isRefund = (row as any).is_refund === true;
        if (isRefund) {
          return <Badge variant="info">Avoir</Badge>;
        }
        return <Badge variant={v === 'sale' ? 'primary' : 'warning'}>{v === 'sale' ? 'Vente' : 'Achat'}</Badge>;
      }
    },
    { 
      key: 'items', 
      label: 'Total', 
      render: (items: Array<{ amount: number; quantity: number }>) => {
        const total = items.reduce((sum, item) => sum + (item.amount * item.quantity), 0);
        return `${total.toLocaleString('fr-FR')} FCFA`;
      }
    },
    { 
      key: 'status', 
      label: 'Statut', 
      render: (v: string) => {
        const variants: Record<string, 'success' | 'danger' | 'warning' | 'info'> = { 
          certified: 'success', 
          rejected: 'danger', 
          pending: 'warning', 
          refunded: 'info' 
        };
        const labels: Record<string, string> = {
          certified: 'Certifiée',
          rejected: 'Rejetée',
          pending: 'En attente',
          refunded: 'Remboursée'
        };
        return <Badge variant={variants[v] || 'info'}>{labels[v] || v}</Badge>;
      }
    },
    { 
      key: 'date_creation', 
      label: 'Date', 
      render: (v: string) => new Date(v).toLocaleDateString('fr-FR') 
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: any, row: Invoice) => {
        const isRefund = (row as any).is_refund === true;
        const canCertify = !isRefund && row.status === 'pending' && (row.type_invoice === 'sale' || row.type_invoice === 'purchase');
        const canEdit = !isRefund && (row.status === 'rejected' || row.status === 'pending');
        const isCertified = row.status === 'certified';
        const isRefunded = row.status === 'refunded'; // Facture remboursée (avoir)
        const canViewDetails = isCertified || isRefunded; // Peut voir les détails si certifiée ou remboursée
        
        return (
          <div className="flex items-center gap-2 flex-wrap">
            {canViewDetails && (
              <Link
                href={`/company/invoices/${row.id}`}
                className="btn-secondary btn-sm flex items-center gap-2"
                title="Voir les détails"
              >
                <FiEye className="w-4 h-4" />
                Détails
              </Link>
            )}
            {canViewDetails && onPrint && (
              <button
                onClick={() => onPrint(row.id)}
                className="btn-primary btn-sm flex items-center gap-2"
                title="Imprimer le reçu"
              >
                <FiPrinter className="w-4 h-4" />
                Imprimer
              </button>
            )}
            {canEdit && onEdit && (
              <button
                onClick={() => onEdit(row.id)}
                className="btn-secondary btn-sm flex items-center gap-2"
                title="Modifier cette facture"
              >
                <FiEdit2 className="w-4 h-4" />
                Modifier
              </button>
            )}
            {canCertify && onCertify && (
              <button
                onClick={() => onCertify(row.id)}
                className="btn-primary btn-sm flex items-center gap-2"
                title="Certifier cette facture"
              >
                <FiCheckCircle className="w-4 h-4" />
                Certifier
              </button>
            )}
            {!canViewDetails && !canEdit && !canCertify && '-'}
          </div>
        );
      }
    },
  ];

  return <DataTable columns={invoiceColumns} data={invoices} />;
}

