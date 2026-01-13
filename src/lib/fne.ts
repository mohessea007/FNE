const FNE_API_URL = process.env.FNE_API_URL || 'http://54.247.95.108/ws/external';

export interface FNEInvoiceItem {
  reference: string;
  description: string;
  quantity: number;
  amount: number;
  discount?: number;
  measurementUnit: string;
  taxes?: string[];
  customTaxes?: Array<{ name: string; amount: number }>;
}

export interface FNEInvoiceData {
  invoiceType: 'sale' | 'purchase';
  paymentMethod: string;
  template: string;
  clientNcc: string;
  clientCompanyName?: string;
  clientPhone?: string;
  clientEmail?: string;
  clientSellerName: string;
  pointOfSale: string;
  establishment: string;
  commercialMessage?: string;
  footer?: string;
  items: FNEInvoiceItem[];
}

export interface FNEResponse {
  success: boolean;
  code: string;
  message: string;
  data: any;
}

export interface FNERefundItem {
  id: string;
  quantity: number;
}

// Convertir les codes de taxe du format interne (TVA18, TVAB9, TVAC0) vers le format FNE (TVA, TVAB, TVAC)
export function convertTaxToFNEFormat(taxes: string | string[] | undefined): string[] {
  if (!taxes) return [];
  
  // Si c'est déjà un tableau, le convertir
  if (Array.isArray(taxes)) {
    return taxes.map(tax => {
      if (tax.startsWith('TVA18')) return 'TVA';
      if (tax.startsWith('TVAB9')) return 'TVAB';
      if (tax.startsWith('TVAC0')) return 'TVAC';
      // Support des anciens formats
      if (tax === 'TVA' || tax === 'TVAB' || tax === 'TVAC' || tax === 'TVAD' || tax === 'TVAE') return tax;
      return tax;
    }).filter(Boolean);
  }
  
  // Si c'est une string, la convertir
  const taxString = taxes.toString();
  if (taxString.startsWith('TVA18')) return ['TVA'];
  if (taxString.startsWith('TVAB9')) return ['TVAB'];
  if (taxString.startsWith('TVAC0')) return ['TVAC'];
  // Support des anciens formats
  if (taxString === 'TVA' || taxString === 'TVAB' || taxString === 'TVAC' || taxString === 'TVAD' || taxString === 'TVAE') {
    return [taxString];
  }
  // Si c'est une string avec des virgules (ancien format), la splitter
  if (taxString.includes(',')) {
    return taxString.split(',').map(t => t.trim()).filter(Boolean);
  }
  
  return [];
}

// Call FNE API for invoice certification
export async function certifyInvoice(
  data: FNEInvoiceData,
  fneAuthToken: string
): Promise<FNEResponse> {
  try {
    const response = await fetch(`${FNE_API_URL}/invoices/sign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': fneAuthToken,
      },
      body: JSON.stringify(data),
    });

    const responseData = await response.json().catch(() => null);

    if (response.status === 201) {
      return {
        success: true,
        code: '201',
        message: 'Facture certifiée avec succès',
        data: responseData,
      };
    }

    return {
      success: false,
      code: String(response.status),
      message: responseData?.message || responseData?.error || 'Erreur lors de l\'appel à l\'API FNE',
      data: responseData,
    };
  } catch (error) {
    return {
      success: false,
      code: '500',
      message: `Erreur de connexion à l'API FNE: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: null,
    };
  }
}

// Call FNE API for refund
export async function refundInvoice(
  originalInvoiceRef: string,
  items: FNERefundItem[],
  fneAuthToken: string
): Promise<FNEResponse> {
  try {
    const response = await fetch(`${FNE_API_URL}/invoices/${originalInvoiceRef}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': fneAuthToken,
      },
      body: JSON.stringify({ items }),
    });

    const responseData = await response.json().catch(() => null);

    if (response.status === 201) {
      return {
        success: true,
        code: '201',
        message: 'Avoir créé avec succès',
        data: responseData,
      };
    }

    return {
      success: false,
      code: String(response.status),
      message: responseData?.message || responseData?.error || 'Erreur lors de la création de l\'avoir',
      data: responseData,
    };
  } catch (error) {
    return {
      success: false,
      code: '500',
      message: `Erreur de connexion à l'API FNE: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: null,
    };
  }
}

// Parse FNE token URL
export function parseFNEToken(token: string): { url: string; value: string } {
  let url = token;
  let value = token;

  if (token && !token.startsWith('http')) {
    url = `http://54.247.95.108/fr/verification/${token}`;
  }

  const match = url.match(/\/verification\/([^\/]+)/);
  if (match) {
    value = match[1];
  } else {
    value = token.split('/').pop() || token;
  }

  return { url, value };
}
