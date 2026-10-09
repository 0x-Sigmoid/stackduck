const dns: typeof import('node:dns/promises') = require('node:dns/promises');
const https: typeof import('node:https') = require('node:https');
import { EventEmitter } from 'node:events';
import { createServer, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { isPublicAddress, postWebhook, validateWebhookTarget } from '../src/alerts/webhook-target';

describe('webhook destination security', () => {
  it.each([
    '127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.1', '169.254.169.254',
    '0.0.0.0', '100.64.0.1', '198.18.0.1', '192.0.2.1', '224.0.0.1',
    '::1', '::', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1',
    '2001:db8::1', '2001::1', '2002:7f00:1::1', '3fff::1',
  ])('rejects nonpublic address %s', (ip) => expect(isPublicAddress(ip)).toBe(false));

  it.each(['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111', '2001:4860:4860::8888'])(
    'accepts public address %s', (ip) => expect(isPublicAddress(ip)).toBe(true),
  );

  it.each(['http://example.com/hook', 'file:///secret', 'https://user:pass@example.com', 'https://127.1', 'https://2130706433'])(
    'rejects unsafe URL %s', async (url) => {
      await expect(validateWebhookTarget(url)).rejects.toThrow();
    },
  );

  it('rejects a DNS name that resolves to a private IP', async () => {
    const dns = jest.fn().mockResolvedValue([{ address: '10.0.0.1', family: 4 }]);
    await expect(validateWebhookTarget('https://example.com', false, dns)).rejects.toThrow('public');
  });

  it('rejects mixed public/private DNS answers', async () => {
    const dns = jest.fn().mockResolvedValue([
      { address: '8.8.8.8', family: 4 }, { address: '::1', family: 6 },
    ]);
    await expect(validateWebhookTarget('https://example.com', false, dns)).rejects.toThrow('public');
  });

  it('returns the checked IP so transport can pin it', async () => {
    const dns = jest.fn().mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
    expect((await validateWebhookTarget('https://example.com', false, dns)).address).toBe('8.8.8.8');
  });

  it('permits literal loopback only with the explicit development override', async () => {
    await expect(validateWebhookTarget('http://127.0.0.1/hook')).rejects.toThrow();
    expect((await validateWebhookTarget('http://127.0.0.1/hook', true)).address).toBe('127.0.0.1');
    await expect(validateWebhookTarget('http://10.0.0.1/hook', true)).rejects.toThrow();
  });

  it('pins the validated IP while retaining the HTTPS host for TLS verification', async () => {
    const resolver = jest.spyOn(dns, 'lookup').mockResolvedValue([{ address: '8.8.8.8', family: 4 }] as any);
    const transport = jest.spyOn(https, 'request').mockImplementation(((url, options, callback) => {
      expect(url.hostname).toBe('example.test');
      expect(options.agent).toBe(false);
      expect(options.rejectUnauthorized).not.toBe(false);
      const pinned = jest.fn();
      options.lookup('example.test', { all: false }, pinned);
      expect(pinned).toHaveBeenCalledWith(null, '8.8.8.8', 4);
      const req = new EventEmitter() as any;
      req.destroy = jest.fn();
      req.end = () => {
        callback({ statusCode: 204, destroy: jest.fn() });
        req.emit('close');
      };
      return req;
    }) as any);
    try {
      await postWebhook('https://example.test/hook', { value: 5 });
      expect(resolver).toHaveBeenCalledTimes(1);
      expect(transport).toHaveBeenCalledTimes(1);
    } finally { transport.mockRestore(); resolver.mockRestore(); }
  });

  it('delivers JSON but refuses redirects without making a second request', async () => {
    let calls = 0;
    let received = '';
    const server: Server = createServer((req, res) => {
      calls++;
      req.on('data', (data) => received += data);
      req.on('end', () => res.writeHead(302, { Location: 'http://127.0.0.1/secret' }).end());
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const port = (server.address() as AddressInfo).port;
      await expect(postWebhook('http://127.0.0.1:' + port, { value: 5 }, true)).rejects.toThrow('Redirects');
      expect(calls).toBe(1);
      expect(JSON.parse(received)).toEqual({ value: 5 });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
