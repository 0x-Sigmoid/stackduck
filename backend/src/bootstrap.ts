import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { json, raw } from 'express';
import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';

/** Ingest is external input: keep it far below the batch cap's payload size. */
const INGEST_RAW_LIMIT = '100kb';
const STRIPE_RAW_LIMIT = '256kb';
const API_JSON_LIMIT = '256kb';

export async function createApiApp() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const config = app.get(ConfigService);
  const server = app.getHttpAdapter().getInstance() as {
    use: (...args: unknown[]) => void;
    set: (setting: string, value: unknown) => void;
  };

  // Behind Railway's proxy, trust the first hop so throttling keys on the real
  // client IP (otherwise every client shares the proxy's bucket) and so
  // `req.secure` reflects X-Forwarded-Proto when deciding cookie flags.
  server.set('trust proxy', 1);

  // Security headers on every response (Security Plan §3): HSTS, CSP,
  // X-Frame-Options, X-Content-Type-Options. This API returns JSON only and
  // renders nothing, so the CSP can be maximally restrictive.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
        },
      },
      frameguard: { action: 'deny' },
      noSniff: true,
      hsts: { maxAge: 15552000, includeSubDomains: true, preload: false },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  // Raw bodies for HMAC/Stripe/Kelviq signature verification must reach the
  // guards as exact bytes, so these routes bypass JSON parsing entirely.
  const ingestRaw = raw({ type: 'application/json', limit: INGEST_RAW_LIMIT });
  const stripeRaw = raw({ type: 'application/json', limit: STRIPE_RAW_LIMIT });
  const billingRaw = raw({ type: '*/*', limit: API_JSON_LIMIT });
  const jsonParser = json({ limit: API_JSON_LIMIT });
  server.use('/v1/ingest', ingestRaw);
  server.use('/v1/stripe', stripeRaw);
  server.use('/v1/billing/webhooks', billingRaw);
  server.use('/v1', (req: Request, _res: Response, next: NextFunction) => {
    if (Buffer.isBuffer((req as unknown as { body: unknown }).body)) return next();
    return jsonParser(req, _res, next);
  });

  // Body-parser failures happen outside Nest's exception layer — translate
  // them into the API error envelope instead of Express's default HTML page.
  const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
    const type = (err as { type?: string }).type;
    const status = (err as { status?: number }).status;
    if (type === 'entity.too.large' || status === 413) {
      res.status(413).json({
        error: { code: 'payload_too_large', message: 'Request body is larger than this endpoint accepts.' },
      });
      return;
    }
    if (type === 'entity.parse.failed') {
      res.status(400).json({ error: { code: 'invalid_json', message: 'Body must be valid JSON.' } });
      return;
    }
    next(err);
  };
  server.use(errorHandler);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Explicit CORS allowlist (Security Plan §3) — never a wildcard. Comma-list
  // allows a staging and a preview origin alongside the main app.
  const configured = [
    config.get<string>('PUBLIC_APP_URL') ?? 'http://localhost:5173',
    ...(config.get<string>('CORS_ALLOWED_ORIGINS') ?? '').split(','),
  ].map((o) => o.trim()).filter(Boolean);
  const allowed = new Set(configured);
  if (allowed.has('*')) throw new Error('CORS wildcard is not allowed — list explicit origins.');
  app.enableCors({ origin: [...allowed], credentials: false });

  return app;
}
