import { z } from 'zod';

// User validation
export const loginSchema = z.object({
  username: z.string().min(1, 'Nom d\'utilisateur requis'),
  password: z.string().min(1, 'Mot de passe requis'),
});

export const createUserSchema = z.object({
  username: z.string().min(3, 'Minimum 3 caractères'),
  password: z.string().min(6, 'Minimum 6 caractères'),
  nom: z.string().min(1, 'Nom requis'),
  email: z.string().email('Email invalide').optional().nullable(),
  type_user: z.enum(['developer', 'superadmin', 'admin', 'owner']),
  role: z.enum(['admin', 'user']).default('user'),
  companieid: z.number().optional().nullable(),
  clientid: z.number().optional().nullable(),
});

// Company validation
export const createCompanySchema = z.object({
  nom: z.string().min(1, 'Nom requis'),
  ncc: z.string().min(1, 'NCC requis'),
  token_fne: z.string().min(1, 'Token FNE requis'),
  commercialMessage: z.string().default(''),
  footer: z.string().default(''),
  localisation: z.string().default(''),
  defaultPointDeVente: z.string().default('Point de vente principal'),
  // Champs pour créer un user owner
  owner_username: z.string().min(3, 'Minimum 3 caractères').optional(),
  owner_password: z.string().min(6, 'Minimum 6 caractères').optional(),
  owner_nom: z.string().min(1, 'Nom requis').optional(),
  owner_email: z.string().email('Email invalide').optional().nullable(),
}).refine((data) => {
  // Si owner_nom est fourni, owner_email et owner_password doivent aussi l'être
  if (data.owner_nom) {
    return !!(data.owner_email && data.owner_password);
  }
  return true;
}, {
  message: 'Si un nom de propriétaire est fourni, email et mot de passe sont requis',
  path: ['owner_nom'],
});

export const updateCompanySchema = z.object({
  nom: z.string().min(1, 'Nom requis').optional(),
  ncc: z.string().min(1, 'NCC requis').optional(),
  // token_fne est intentionnellement exclu - ne peut pas être modifié via cette route
  commercialMessage: z.string().optional(),
  footer: z.string().optional(),
  localisation: z.string().optional(),
  is_active: z.boolean().optional(),
});

export const updateTokenFneSchema = z.object({
  token_fne: z.string().min(1, 'Token FNE requis'),
});

// User profile validation
export const updateUserProfileSchema = z.object({
  nom: z.string().min(1, 'Nom requis').optional(),
  email: z.string().email('Email invalide').optional().nullable(),
  current_password: z.string().min(1, 'Mot de passe actuel requis').optional(),
  new_password: z.string().min(6, 'Minimum 6 caractères').optional(),
}).refine((data) => {
  // Si nouveau mot de passe, l'ancien est requis
  if (data.new_password && !data.current_password) {
    return false;
  }
  return true;
}, {
  message: 'Le mot de passe actuel est requis pour changer le mot de passe',
  path: ['current_password'],
});

// Point de vente validation
export const createPointDeVenteSchema = z.object({
  nom: z.string().min(1, 'Nom requis'),
  is_default: z.boolean().default(false),
});

export const updatePointDeVenteSchema = z.object({
  nom: z.string().min(1, 'Nom requis').optional(),
  is_default: z.boolean().optional(),
});

// Client validation
export const createClientSchema = z.object({
  ncc: z.string().optional().nullable(),
  clientCompanyName: z.string().optional().nullable(),
  clientPhone: z.string().optional().nullable(),
  clientEmail: z.preprocess(
    (val) => (val === '' || val === undefined ? null : val),
    z.union([z.string().email('Email invalide'), z.null()]).nullable().optional()
  ),
  pointdeventeid: z.number().min(1, 'Point de vente requis'),
  type_client: z.enum(['B2B', 'B2F', 'B2G', 'B2C']).default('B2C'),
  // Champs optionnels pour créer un compte utilisateur
  user_username: z.string().min(3, 'Minimum 3 caractères').optional(),
  user_password: z.string().min(6, 'Minimum 6 caractères').optional(),
}).refine((data) => {
  // Si user_username est fourni, user_password doit aussi l'être
  if (data.user_username && !data.user_password) {
    return false;
  }
  return true;
}, {
  message: 'Le mot de passe est requis si un nom d\'utilisateur est fourni',
  path: ['user_password'],
}).refine((data) => {
  // Si user_password est fourni, user_username doit aussi l'être
  if (data.user_password && !data.user_username) {
    return false;
  }
  return true;
}, {
  message: 'Le nom d\'utilisateur est requis si un mot de passe est fourni',
  path: ['user_username'],
});

export const updateClientSchema = z.object({
  ncc: z.string().optional().nullable(),
  clientCompanyName: z.string().optional().nullable(),
  clientPhone: z.string().optional().nullable(),
  clientEmail: z.preprocess(
    (val) => (val === '' || val === undefined ? null : val),
    z.union([z.string().email('Email invalide'), z.null()]).nullable().optional()
  ),
  pointdeventeid: z.number().optional(),
  type_client: z.enum(['B2B', 'B2F', 'B2G', 'B2C']).optional(),
});

// Invoice item validation
export const invoiceItemSchema = z.object({
  reference: z.string().min(1, 'Référence requise'),
  description: z.string().min(1, 'Description requise'),
  quantity: z.number().min(1, 'Quantité minimum 1'),
  amount: z.number().min(0, 'Montant invalide'),
  discount: z.number().min(0).max(100).default(0), // Pourcentage de 0 à 100
  measurementUnit: z.string().default('pcs'),
  taxes: z.union([z.string(), z.array(z.string())]).optional(), // Supporte string (nouveau format) ou array (ancien format pour compatibilité)
  customTaxes: z.array(z.object({
    name: z.string().min(1, 'Le nom de la taxe personnalisée est requis'),
    amount: z.number().min(0, 'Le montant doit être positif'),
  })).optional(),
  // Compatibilité avec l'ancien format (pour API v1)
  customTaxesname: z.string().optional().nullable(),
  customTaxesamount: z.number().default(0),
});

// Invoice validation
export const createInvoiceSchema = z.object({
  clientid: z.number().min(1, 'Client requis'),
  pointdeventeid: z.number().min(1, 'Point de vente requis'),
  type_invoice: z.enum(['sale', 'purchase']).default('sale'),
  paymentMethod: z.string().default('cash'),
  clientSellerName: z.string().default(''),
  remise_taux: z.number().min(0).max(100).default(0), // Pourcentage de 0 à 100
  items: z.array(invoiceItemSchema).min(1, 'Au moins un article requis'),
});

// Refund validation
export const createRefundSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1, 'ID item requis'),
      quantity: z.number().min(1, 'Quantité minimum 1'),
    })
  ).min(1, 'Au moins un article requis'),
});

// Ticket validation
export const createTicketSchema = z.object({
  subject: z.string().min(1, 'Sujet requis'),
  description: z.string().min(1, 'Description requise'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  category: z.enum(['general', 'technical', 'billing', 'feature_request', 'bug_report']).default('general'),
});

export const ticketMessageSchema = z.object({
  message: z.string().min(1, 'Message requis'),
  is_internal: z.boolean().default(false),
});

// Chat validation
export const chatMessageSchema = z.object({
  message: z.string().min(1, 'Message requis'),
  chat_id: z.number().min(1, 'ID de chat requis').optional(), // Optionnel pour les messages de chat privé
});

// Private chat channel validation
export const createPrivateChatChannelSchema = z.object({
  name: z.string().optional().nullable(),
  company_ids: z.array(z.number().min(1)).min(2, 'Au moins 2 entreprises requises'),
});

export const updateParticipantSchema = z.object({
  company_id: z.number().min(1, 'ID entreprise requis'),
  is_muted: z.boolean().optional(),
  is_disabled: z.boolean().optional(),
});

// Validate function helper
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: Array<{ field: string; message: string }> } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));

  return { success: false, errors };
}
