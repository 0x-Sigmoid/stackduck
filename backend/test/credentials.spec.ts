import 'reflect-metadata';
import crypto from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { CredentialsService } from '../src/credentials/credentials.service';
import { StripeConnector } from '../src/connectors/providers/stripe.connector';

it('tests production credential encryption and authenticated decryption', () => {
  const service = new CredentialsService(new ConfigService({
    CREDENTIALS_ENCRYPTION_KEY: crypto.randomBytes(32).toString('base64'),
  }));
  const encrypted = service.encrypt('secret');
  expect(service.decrypt(encrypted)).toBe('secret');
  const parts = encrypted.split(':');
  parts[2] = Buffer.alloc(16).toString('base64');
  expect(() => service.decrypt(parts.join(':'))).toThrow();
});

it('tests production webhook signature verification and freshness', () => {
  const body = Buffer.from('{"value":5}');
  const now = Date.now();
  const seconds = Math.floor(now / 1000);
  const signature = crypto.createHmac('sha256', 'secret').update(seconds + '.').update(body).digest('hex');
  expect(CredentialsService.verifyWebhookSignature(String(seconds), body, 'secret', signature, now)).toBe('ok');
  expect(CredentialsService.verifyWebhookSignature(String(seconds), Buffer.from('{}'), 'secret', signature, now)).toBe('bad_signature');
  expect(CredentialsService.verifyWebhookSignature(String(seconds), body, 'secret', signature, now + 600_000)).toBe('stale_timestamp');
});

it('tests the production Stripe signature verifier', () => {
  const body = Buffer.from('{"id":"evt_1"}');
  const seconds = Math.floor(Date.now() / 1000);
  const signature = crypto.createHmac('sha256', 'secret').update(seconds + '.').update(body).digest('hex');
  expect(StripeConnector.verifySignature(body, 'secret', 't=' + seconds + ',v1=' + signature)).toBe(true);
  expect(StripeConnector.verifySignature(body, 'wrong', 't=' + seconds + ',v1=' + signature)).toBe(false);
});
