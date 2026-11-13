/**
 * Authentication Routes for LibertadGO
 * Endpoints: /api/auth/register, /api/auth/login, /api/auth/logout, /api/auth/me
 */

import { Router, Request, Response } from 'express';
import { RegisterUserSchema, LoginUserSchema } from './creatorsSchemas.ts';
import { getAuthRepository, getCreatorsRepository } from './repositories/index.ts';
import { hashPassword, verifyPassword, createToken, requireAuth, revokeToken } from './authService.ts';
import { authRateLimiter } from './rateLimiter.ts';

export const authRouter = Router();

const isProduction = process.env.NODE_ENV === 'production';
const COOKIE_NAME = 'libertadgo_token';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};

// POST /api/auth/register
authRouter.post('/register', authRateLimiter, async (req: Request, res: Response) => {
  const parseResult = RegisterUserSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((i) => i.message).join(', ');
    res.status(400).json({ success: false, error: errorMsg });
    return;
  }

  const { email, password, name } = parseResult.data;
  const authRepo = getAuthRepository();

  try {
    const existing = await authRepo.findUserByEmail(email);
    if (existing) {
      res.status(409).json({
        success: false,
        error: 'Ya existe una cuenta registrada con este correo electrónico',
      });
      return;
    }

    // Public registration always assigns USER role. Admin is only created via bootstrapAdminFromEnv.
    const newUser = await authRepo.createUser({
      email,
      passwordHash: hashPassword(password),
      name,
      role: 'USER',
    });

    const token = createToken({
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
    });

    // Set HttpOnly, SameSite strict session cookie
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
          avatarUrl: newUser.avatarUrl,
          createdAt: newUser.createdAt,
        },
        token,
      },
      message: 'Cuenta creada exitosamente',
    });
  } catch (err) {
    console.error('[Auth Error] Error registering user:', err);
    res.status(500).json({ success: false, error: 'Error interno al registrar usuario' });
  }
});

// POST /api/auth/login
authRouter.post('/login', authRateLimiter, async (req: Request, res: Response) => {
  const parseResult = LoginUserSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((i) => i.message).join(', ');
    res.status(400).json({ success: false, error: errorMsg });
    return;
  }

  const { email, password } = parseResult.data;
  const authRepo = getAuthRepository();

  try {
    const user = await authRepo.findUserByEmail(email);
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Credenciales inválidas. Verifica tu correo o contraseña.',
      });
      return;
    }

    const isValid = verifyPassword(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({
        success: false,
        error: 'Credenciales inválidas. Verifica tu correo o contraseña.',
      });
      return;
    }

    const token = createToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    // Set HttpOnly, SameSite strict session cookie
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatarUrl: user.avatarUrl,
        },
        token,
      },
    });
  } catch (err) {
    console.error('[Auth Error] Error logging in:', err);
    res.status(500).json({ success: false, error: 'Error interno al iniciar sesión' });
  }
});

// POST /api/auth/logout
authRouter.post('/logout', async (req: Request, res: Response) => {
  // Extract token from Authorization header or cookie
  const authHeader = req.headers.authorization;
  let token: string | null = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers.cookie) {
    const match = req.headers.cookie.match(/libertadgo_token=([^;]+)/);
    if (match) token = match[1];
  } else if (req.body?.token) {
    token = req.body.token;
  }

  if (token) {
    try {
      await revokeToken(token, req.user?.userId);
    } catch (err) {
      console.warn('[Auth Warning] Error invalidating token:', err);
    }
  }

  // Clear session cookie
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
  });

  res.json({ success: true, message: 'Sesión cerrada correctamente' });
});

// GET /api/auth/me
authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'No autorizado' });
    return;
  }

  try {
    const authRepo = getAuthRepository();
    const creatorsRepo = getCreatorsRepository();

    const user = await authRepo.findUserById(req.user.userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'Usuario no encontrado' });
      return;
    }

    const creatorProfile = await creatorsRepo.findCreatorProfileByUserId(user.id);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt,
        },
        creatorProfile,
      },
    });
  } catch (err) {
    console.error('[Auth Error] Error getting current user:', err);
    res.status(500).json({ success: false, error: 'Error al consultar información del usuario' });
  }
});
