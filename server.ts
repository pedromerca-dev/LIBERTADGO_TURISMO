import 'dotenv/config';
import fs from 'fs';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Server } from 'http';
import { apiRouter } from './src/server/routes.ts';
import { bootstrapAdminFromEnv, validateSecurityConfig, csrfProtectionMiddleware } from './src/server/authService.ts';
import {
  validateDatabaseConfig,
  verifyDatabaseConnectivity,
  checkDatabaseHealth,
  closeDatabaseConnections,
} from './src/server/repositories/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let isShuttingDown = false;

function registerGracefulShutdown(server: Server): void {
  const shutdown = async (signal: string) => {
    if (isShuttingDown) {
      console.log(`[LibertadGO] Shutdown already in progress. Signal ${signal} ignored.`);
      return;
    }
    isShuttingDown = true;
    console.log(`[LibertadGO] Received ${signal}. Initiating graceful shutdown...`);

    // Safety timer: force exit if termination takes longer than 10 seconds
    const forcedTimeout = setTimeout(() => {
      console.error('[LibertadGO] Graceful shutdown timed out after 10s. Forcing exit.');
      process.exit(1);
    }, 10000);
    forcedTimeout.unref();

    try {
      // 1. Stop accepting new incoming HTTP connections
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) return reject(err);
          console.log('[LibertadGO] HTTP server stopped accepting new requests.');
          resolve();
        });
      });

      // 2. Gracefully close persistent PostgreSQL connection pool
      await closeDatabaseConnections();

      console.log('[LibertadGO] Graceful shutdown completed cleanly.');
      clearTimeout(forcedTimeout);
      process.exit(0);
    } catch (err) {
      console.error('[LibertadGO] Error during graceful shutdown:', err);
      clearTimeout(forcedTimeout);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
}

async function startServer() {
  const app = express();

  // AI Studio and development dev-server port handling
  const portArgIndex = process.argv.indexOf('--port');
  const cliPort = portArgIndex !== -1 && process.argv[portArgIndex + 1] ? Number(process.argv[portArgIndex + 1]) : null;
  const hostArgIndex = process.argv.indexOf('--host');
  const cliHost = hostArgIndex !== -1 && process.argv[hostArgIndex + 1] ? process.argv[hostArgIndex + 1] : null;

  // In AI Studio or development, use port 3000. In production (Cloud Run), honor process.env.PORT (8080).
  const PORT = (cliPort && !isNaN(cliPort))
    ? cliPort
    : (process.env.NODE_ENV === 'production' && process.env.PORT ? Number(process.env.PORT) : 3000);
  const HOST = cliHost || '0.0.0.0';

  const distPath = path.resolve(__dirname, 'dist');
  const isProduction =
    process.env.NODE_ENV === 'production' &&
    fs.existsSync(path.join(distPath, 'index.html'));

  let configError: string | null = null;

  try {
    // 1. Fail-fast security and database configuration checks
    validateSecurityConfig();
    validateDatabaseConfig();

    // 2. Verify database connectivity before declaring server ready
    await verifyDatabaseConnectivity();

    // 3. Bootstrap initial admin if environment variables are provided
    await bootstrapAdminFromEnv();
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (isProduction) {
      configError = errorMsg;
      console.error(`[LibertadGO Configuration Alert] ${errorMsg}`);
      console.warn(
        `[LibertadGO] The server will listen on ${HOST}:${PORT} to maintain Cloud Run service health. Database-dependent endpoints will return 503 until configuration is set.`
      );
    } else {
      console.log(`[LibertadGO Dev Startup Note] ${errorMsg}`);
    }
  }

  app.use(express.json());
  app.use(csrfProtectionMiddleware);

  // High-priority Health Endpoints for Cloud Run & Uptime Monitoring
  const handleHealthCheck = async (_req: express.Request, res: express.Response) => {
    res.setHeader('Content-Type', 'application/json');
    const dbHealth = await checkDatabaseHealth();
    res.json({
      status: dbHealth.connected || !isProduction ? 'healthy' : 'degraded',
      database: dbHealth.connected ? 'connected' : (isProduction ? 'not_configured' : 'in_memory'),
      environment: isProduction ? 'production' : 'development',
      timestamp: new Date().toISOString(),
    });
  };

  app.get('/api/health', handleHealthCheck);
  app.get('/health', handleHealthCheck);

  // If production security or database configuration is incomplete, protect database endpoints
  if (configError) {
    app.use(['/api/auth', '/api/creators', '/api/admin'], (_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.status(503).json({
        success: false,
        error: 'Servicio no disponible: configuración de producción incompleta en Cloud Run.',
      });
    });
  }

  // API Router (destinations, places, and catalog routes remain accessible)
  app.use('/api', apiRouter);

  // Archivos públicos
  app.use(express.static(path.resolve(__dirname, 'public')));

  if (isProduction) {
    // Frontend compilado por Vite
    app.use(express.static(distPath));

    // Fallback exclusivo para rutas web de la SPA React
    app.get('*', (req, res) => {
      // Bloquear estrictamente que cualquier solicitud a /api/* devuelva el HTML de la SPA
      if (req.path.startsWith('/api')) {
        res.setHeader('Content-Type', 'application/json');
        res.status(404).json({ success: false, error: 'Endpoint API no encontrado' });
        return;
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    // En desarrollo, evitar que solicitudes no coincidentes de /api caigan en el middleware SPA de Vite
    app.use('/api', (_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.status(404).json({ success: false, error: 'Endpoint API no encontrado' });
    });

    // Servidor de desarrollo Vite con HMR desactivado para evitar colisiones de puerto WebSocket
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  }

  const server = app.listen(PORT, HOST, () => {
    console.log(
      `[LibertadGO] Server running on ${HOST}:${PORT}`
    );
    console.log(
      `[LibertadGO] Environment: ${isProduction ? 'production' : 'development'}`
    );
    if (configError) {
      console.warn(
        `[LibertadGO] Running in setup/catalog-only mode due to missing production configuration.`
      );
    }
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    console.error('[LibertadGO] HTTP server error:', err.message);
    if (err.code === 'EADDRINUSE') {
      console.error(`[LibertadGO] Port ${PORT} is already in use.`);
    }
  });

  // 4. Register orderly shutdown handlers for Cloud Run SIGTERM / SIGINT
  registerGracefulShutdown(server);
}

startServer().catch((err) => {
  console.error('[LibertadGO] Failed to start server:', err?.message || err);
  process.exit(1);
});
