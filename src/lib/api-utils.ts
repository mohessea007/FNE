import { NextResponse } from 'next/server';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Array<{ field: string; message: string }>;
}

// Success response
export function successResponse<T>(data: T, message?: string, status = 200): NextResponse {
  return NextResponse.json(
    {
      success: true,
      message,
      data,
    } as ApiResponse<T>,
    { status }
  );
}

// Error response
export function errorResponse(
  message: string,
  status = 400,
  errors?: Array<{ field: string; message: string }>
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      message,
      errors,
    } as ApiResponse,
    { status }
  );
}

// Not found response
export function notFoundResponse(message = 'Ressource non trouvée'): NextResponse {
  return errorResponse(message, 404);
}

// Unauthorized response
export function unauthorizedResponse(message = 'Non autorisé'): NextResponse {
  return errorResponse(message, 401);
}

// Forbidden response
export function forbiddenResponse(message = 'Accès interdit'): NextResponse {
  return errorResponse(message, 403);
}

// Server error response
export function serverErrorResponse(message = 'Erreur serveur interne'): NextResponse {
  return errorResponse(message, 500);
}

// Validation error response
export function validationErrorResponse(
  errors: Array<{ field: string; message: string }>
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      message: 'Erreur de validation',
      errors,
    } as ApiResponse,
    { status: 400 }
  );
}

// Parse JSON body safely
export async function parseJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// Get API key from headers
export function getApiKeyFromHeaders(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  const apiKeyHeader = request.headers.get('X-API-KEY');

  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  if (authHeader) {
    const match = authHeader.match(/Bearer\s+(.*)$/i);
    if (match) {
      return match[1];
    }
    return authHeader;
  }

  return null;
}

// Get JWT token from headers
export function getTokenFromHeaders(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  
  if (authHeader) {
    const match = authHeader.match(/Bearer\s+(.*)$/i);
    if (match) {
      return match[1];
    }
  }

  return null;
}
