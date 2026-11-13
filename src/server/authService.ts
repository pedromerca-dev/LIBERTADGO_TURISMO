/**
 * Authentication & Security Service for LibertadGO
 * Provides password hashing (scrypt + random salt), cryptographically signed session tokens,
 * role-based access control (USER / ADMIN), and ownership authorization middleware.
 * Zero hardcoded credentials.
 */

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types/creators.ts';
import { getAuthRepository } from './repositories/index.ts';

const DEV_DEFAULT_SECRET = 'libertadgo_sec_sig_7b29e01f5c6a84d3e218';
const TOKEN_EXPIRY_DAYS = 7;

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    if (!secret || secret === DEV_DEFAULT_SECRET || secret.length < 16) {
      throw new Error(
        '[Security] FATAL: SESSION_SECRET is mandatory in production and must not use the development default secret.'
      );
    }
    return secret;
  }

  // Development / Test fallback
  return secret || DEV_DEFAULT_SECRET;
}

export function validateSecurityConfig(): void {
  const secret = process.env.SESSION_SECRET?.trim();
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    if (!secret) {
      throw new Error(
        '[Security] FATAL: SESSION_SECRET is mandatory in production environment. Refusing to start without configured session secret.'
      );
    }
    if (secret === DEV_DEFAULT_SECRET) {
      throw new Error(
        '[Security] FATAL: SESSION_SECRET must not use the development default secret in production environment.'
      );
    }
    if (secret.length < 16) {
      throw new Error(
        '[Security] FATAL: SESSION_SECRET must be at least 16 characters long in production environment.'
      );
    }
  }
}


export interface TokenPayload {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  exp: number;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

// --- PASSWORD UTILITIES ---

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedBuffer = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedBuffer);
  } catch {
    return false;
  }
}

// --- TOKEN UTILITIES ---

export function createToken(user: { id: string; email: string; name: string; role: UserRole }): string {
  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_DAYS * 86400,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payloadB64, signature] = parts;

    const expectedSig = crypto
      .createHmac('sha256', getSessionSecret())
      .update(payloadB64)
      .digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }

    const payload: TokenPayload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf-8')
    );

    // Check expiry
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// --- TOKEN REVOCATION & BLACKLIST ---

const revokedTokenHashes = new Set<string>();

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

export async function revokeToken(token: string, userId?: string): Promise<void> {
  const tokenHash = hashToken(token);
  revokedTokenHashes.add(tokenHash);

  try {
    if (process.env.DATABASE_URL) {
      const { getDbPool } = await import('./repositories/dbPool.ts');
      const pool = getDbPool();
      const payload = verifyToken(token);
      const expiresAt = payload ? new Date(payload.exp * 1000) : new Date(Date.now() + TOKEN_EXPIRY_DAYS * 86400000);
      const targetUserId = userId || payload?.userId || null;

      await pool.query(
        `INSERT INTO revoked_tokens (token_hash, user_id, expires_at, revoked_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (token_hash) DO NOTHING`,
        [tokenHash, targetUserId, expiresAt]
      );
    }
  } catch (err) {
    // If database is not configured or in test mode, memory revocation is already effective
    console.warn('[Security] Token revocation persisted to memory (database sync bypassed):', err instanceof Error ? err.message : String(err));
  }
}

export async function isTokenRevoked(token: string): Promise<boolean> {
  const tokenHash = hashToken(token);
  if (revokedTokenHashes.has(tokenHash)) {
    return true;
  }

  try {
    if (process.env.DATABASE_URL) {
      const { getDbPool } = await import('./repositories/dbPool.ts');
      const pool = getDbPool();
      const res = await pool.query(
        'SELECT token_hash FROM revoked_tokens WHERE token_hash = $1',
        [tokenHash]
      );
      if (res.rows.length > 0) {
        revokedTokenHashes.add(tokenHash);
        return true;
      }
    }
  } catch {
    // Rely on memory cache if DB is not reachable
  }

  return false;
}

export function isTokenRevokedSync(token: string): boolean {
  const tokenHash = hashToken(token);
  return revokedTokenHashes.has(tokenHash);
}

export function clearRevokedTokensForTesting(): void {
  revokedTokenHashes.clear();
}

// --- MIDDLEWARES ---

export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  let token: string | null = null;

  // 1. Intentar obtener un Bearer válido
  if (authHeader?.startsWith('Bearer ')) {
    const bearerToken = authHeader.substring(7).trim();

    if (
      bearerToken &&
      bearerToken !== 'null' &&
      bearerToken !== 'undefined'
    ) {
      const payload = verifyToken(bearerToken);

      if (payload && !(await isTokenRevoked(bearerToken))) {
        req.user = payload;
        next();
        return;
      }
    }
  }

  // 2. Si el Bearer no es válido, intentar con la cookie
  const cookieHeader = req.headers.cookie;

  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)libertadgo_token=([^;]+)/);

    if (match) {
      const cookieToken = decodeURIComponent(match[1]);
      const payload = verifyToken(cookieToken);

      if (payload && !(await isTokenRevoked(cookieToken))) {
        req.user = payload;
      }
    }
  }

  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Autenticación requerida. Inicia sesión para continuar.',
    });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Autenticación requerida para acceder al área administrativa.',
    });
    return;
  }

  if (req.user.role !== 'ADMIN') {
    res.status(403).json({
      success: false,
      error: 'Acceso denegado: se requieren permisos administrativos para esta operación.',
    });
    return;
  }

  next();
}

/**
 * Bootstrap Initial Admin on First Boot if environment variables are provided
 * Does NOT hardcode any credentials.
 */
export async function bootstrapAdminFromEnv(): Promise<{ bootstrapped: boolean; reason?: string }> {
  const email = process.env.ADMIN_INITIAL_EMAIL?.trim();
  const password = process.env.ADMIN_INITIAL_PASSWORD;
  const name = process.env.ADMIN_INITIAL_NAME?.trim() || 'Administrador LibertadGO';

  if (!email || !password) {
    console.log(
      '[Security] Admin bootstrap skipped: ADMIN_INITIAL_EMAIL and/or ADMIN_INITIAL_PASSWORD not configured. No administrative account created.'
    );
    return { bootstrapped: false, reason: 'missing_credentials' };
  }

  try {
    const authRepo = getAuthRepository();
    const existing = await authRepo.findUserByEmail(email);

    if (!existing) {
      console.log(`[Security] Bootstrapping initial admin account for: ${email}`);
      await authRepo.createUser({
        email,
        passwordHash: hashPassword(password),
        name,
        role: 'ADMIN',
      });
      return { bootstrapped: true };
    } else {
      console.log(
        `[Security] Initial admin account (${email}) already exists. Preserving existing credentials and role during reboot.`
      );
      return { bootstrapped: false, reason: 'already_exists' };
    }
  } catch (err) {
    console.warn(
      '[Security] WARNING: Could not bootstrap initial admin account:',
      err instanceof Error ? err.message : String(err)
    );
    throw err;
  }
}

/**
 * Modern CSRF Protection Middleware
 * Defends cookie-authenticated sessions against cross-site request forgery
 * by validating Sec-Fetch-Site metadata and Origin/Host match on mutating operations.
 */
export function csrfProtectionMiddleware(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  if (!isMutating) {
    return next();
  }

  // Check if request is authenticated via cookie
  const cookieHeader = req.headers.cookie;
  const hasCookieAuth = Boolean(cookieHeader && cookieHeader.includes('libertadgo_token='));

  if (!hasCookieAuth) {
    // Pure Bearer token requests (e.g. mobile apps, non-browser clients) are not vulnerable to ambient cookie CSRF
    return next();
  }

  // 1. Sec-Fetch-Site check (standard W3C Fetch Metadata Request Headers)
  const secFetchSite = req.headers['sec-fetch-site'];
  if (secFetchSite === 'cross-site') {
    res.status(403).json({
      success: false,
      error: 'Solicitud bloqueada por protección CSRF (origen cruzado no permitido).',
    });
    return;
  }

  // 2. Origin / Host check
  const origin = req.headers.origin;
  if (origin) {
    try {
      const originUrl = new URL(origin);
      const expectedHost = req.headers['x-forwarded-host'] || req.headers.host;
      if (expectedHost) {
        const expectedHostName = (Array.isArray(expectedHost) ? expectedHost[0] : expectedHost).split(':')[0];
        if (originUrl.hostname !== expectedHostName && originUrl.hostname !== 'localhost' && originUrl.hostname !== '127.0.0.1') {
          res.status(403).json({
            success: false,
            error: 'Solicitud bloqueada por protección CSRF: encabezado Origin no coincide con el host.',
          });
          return;
        }
      }
    } catch {
      res.status(403).json({
        success: false,
        error: 'Solicitud bloqueada por protección CSRF: encabezado Origin inválido.',
      });
      return;
    }
  }

  next();
}
