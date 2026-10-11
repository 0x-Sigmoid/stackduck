import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Repository, MoreThan, IsNull, In } from 'typeorm';
import { Resend } from 'resend';
import { AuditService, maskEmail } from '../common/audit.service';
import { RefreshToken, User } from '../entities/user.entity';
import { Project } from '../entities/project.entity';
import { Connector } from '../entities/connector.entity';
import { MetricPoint } from '../entities/metric-point.entity';
import { AlertRule } from '../entities/alert-rule.entity';
import { IntegrationToken } from '../entities/integration-token.entity';
import { PasswordResetToken } from '../entities/password-reset.entity';
import { CredentialsService } from '../credentials/credentials.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email?: string | null; displayName?: string | null };
}

/**
 * Cost-12 placeholder hash. Compared whenever an account (or its password
 * hash) is missing, so a failed login takes the same bcrypt work as a wrong
 * password and response timing cannot be used to enumerate registered emails.
 * Generated once at module load; never matches a real password.
 */
const DUMMY_HASH = bcrypt.hashSync(`dummy:${crypto.randomBytes(16).toString('hex')}`, 12);

/** Identical message for wrong-password and no-such-account — never reveal which. */
const LOGIN_FAILED = 'Invalid email or password.';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(RefreshToken) private readonly refresh: Repository<RefreshToken>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(Connector) private readonly connectors: Repository<Connector>,
    @InjectRepository(MetricPoint) private readonly points: Repository<MetricPoint>,
    @InjectRepository(AlertRule) private readonly rules: Repository<AlertRule>,
    @InjectRepository(IntegrationToken) private readonly integrations: Repository<IntegrationToken>,
    @InjectRepository(PasswordResetToken) private readonly resets: Repository<PasswordResetToken>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly creds: CredentialsService,
  ) {}

  async validateLocal(email: string, password: string): Promise<User> {
    const user = await this.users.findOne({ where: { email: email.toLowerCase() } });
    const stored = user?.passwordHash ?? DUMMY_HASH;
    const ok = await bcrypt.compare(password, stored);
    if (!user?.passwordHash || !ok) {
      this.audit.event('auth.login.failure', { email: maskEmail(email), reason: 'invalid_credentials' });
      throw new UnauthorizedException({ error: { code: 'invalid_credentials', message: LOGIN_FAILED } });
    }
    this.audit.event('auth.login.success', { user_id: user.id, email: maskEmail(user.email) });
    return user;
  }

  /** Email/password signup — replicates the signup/consent-checkbox flow. */
  async register(email: string, password: string, consent: boolean, displayName?: string): Promise<TokenPair> {
    if (!consent) {
      this.audit.event('auth.register.rejected', { email: maskEmail(email), reason: 'consent_required' });
      throw new UnauthorizedException({
        error: { code: 'consent_required', message: 'You must accept the terms to create an account.' },
      });
    }
    const existing = await this.users.findOne({ where: { email: email.toLowerCase() } });
    if (existing) {
      // See report note: this response does confirm the email is registered.
      this.audit.event('auth.register.rejected', { email: maskEmail(email), reason: 'email_taken' });
      throw new UnauthorizedException({
        error: { code: 'email_taken', message: 'That email is already registered — sign in instead.' },
      });
    }
    const user = await this.users.save(
      this.users.create({
        email: email.toLowerCase(),
        passwordHash: await bcrypt.hash(password, 12),
        displayName,
        consentAcceptedAt: new Date(),
      }),
    );
    this.audit.event('auth.register.success', { user_id: user.id, email: maskEmail(user.email), consent: true });
    return this.issueTokens(user);
  }

  /** OAuth upsert: find by provider link, else by email (link), else create. */
  async upsertOAuth(
    provider: 'google' | 'github',
    providerId: string,
    email: string | undefined,
    displayName: string | undefined,
    photoUrl: string | undefined,
    consent: boolean,
  ): Promise<TokenPair> {
    const providerKey = `${provider}:${providerId}`;
    let user = await this.users.findOne({ where: { providerKey } });
    if (!user && email) {
      const byEmail = await this.users.findOne({ where: { email: email.toLowerCase() } });
      user = byEmail ?? null;
      if (user) {
        user.providerKey = user.providerKey ?? providerKey;
        user.displayName = user.displayName ?? displayName;
        user.photoUrl = user.photoUrl ?? photoUrl;
        if (consent && !user.consentAcceptedAt) user.consentAcceptedAt = new Date();
        await this.users.save(user);
      }
    }
    if (!user) {
      if (!consent) {
        throw new UnauthorizedException({
          error: { code: 'consent_required', message: 'You must accept the terms to create an account.' },
        });
      }
      user = await this.users.save(
        this.users.create({
          email: email?.toLowerCase() ?? null,
          displayName,
          photoUrl,
          providerKey,
          consentAcceptedAt: new Date(),
        }),
      );
    }
    this.audit.event('auth.oauth.success', { provider, user_id: user.id, email: maskEmail(user.email), consent });
    return this.issueTokens(user);
  }

  async issueTokens(user: User): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<JwtSignOptions['expiresIn']>('JWT_ACCESS_TTL') ?? '15m',
      },
    );
    const opaque = crypto.randomBytes(48).toString('hex');
    const ttl = this.config.get<string>('JWT_REFRESH_TTL') ?? '30d';
    const ms = parseTtlMs(ttl);
    await this.refresh.save(
      this.refresh.create({
        userId: user.id,
        tokenHash: crypto.createHash('sha256').update(opaque).digest('hex'),
        expiresAt: new Date(Date.now() + ms),
      }),
    );
    return {
      accessToken,
      refreshToken: opaque,
      user: { id: user.id, email: user.email, displayName: user.displayName },
    };
  }

  async rotateRefresh(opaque: string): Promise<TokenPair> {
    const hash = crypto.createHash('sha256').update(opaque).digest('hex');
    const row = await this.refresh.findOne({
      where: { tokenHash: hash, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
    });
    if (!row) {
      this.audit.event('auth.refresh.rejected', { reason: 'invalid_or_expired' });
      throw new UnauthorizedException({
        error: { code: 'invalid_refresh', message: 'Session expired — sign in again.' },
      });
    }
    // Rotation: the presented token is revoked BEFORE a replacement is issued,
    // so a replayed (stolen) copy fails the revokedAt IS NULL lookup above.
    row.revokedAt = new Date();
    await this.refresh.save(row);
    const user = await this.users.findOneOrFail({ where: { id: row.userId } });
    this.audit.event('auth.refresh.rotated', { user_id: user.id });
    return this.issueTokens(user);
  }

  async revokeRefresh(opaque: string): Promise<void> {
    const hash = crypto.createHash('sha256').update(opaque).digest('hex');
    const res = await this.refresh.update({ tokenHash: hash, revokedAt: IsNull() }, { revokedAt: new Date() });
    this.audit.event('auth.logout', { revoked: (res.affected ?? 0) > 0 });
  }

  async me(userId: string): Promise<User | null> {
    return this.users.findOne({ where: { id: userId } });
  }

  /** Profile + preferences update. Prefs merge against an allowlist — never wholesale. */
  async updateMe(
    userId: string,
    patch: { displayName?: string | null; photoUrl?: string | null; prefs?: Record<string, unknown> },
  ): Promise<User> {
    const user = await this.users.findOneOrFail({ where: { id: userId } });
    if (patch.displayName !== undefined) user.displayName = patch.displayName?.trim() ? patch.displayName.trim().slice(0, 80) : null;
    if (patch.photoUrl !== undefined) user.photoUrl = patch.photoUrl?.trim() ? patch.photoUrl.trim().slice(0, 2000) : null;
    if (patch.prefs !== undefined) user.prefs = sanitizePrefs({ ...(user.prefs ?? {}), ...patch.prefs });
    const saved = await this.users.save(user);
    this.audit.event('auth.profile.updated', { user_id: userId });
    return saved;
  }

  /**
   * Full account deletion: projects (connectors + alert rules cascade via FK,
   * metric points deleted explicitly — they carry no FK), sessions, import
   * tokens, reset tokens, then the user row.
   */
  async deleteMe(userId: string): Promise<void> {
    const owned = await this.projects.find({ where: { ownerId: userId }, select: ['id'] });
    const ids = owned.map((p) => p.id);
    if (ids.length > 0) {
      await this.points.delete({ projectId: In(ids) });
      await this.projects.delete({ id: In(ids) });
    }
    await this.refresh.delete({ userId });
    await this.integrations.delete({ userId });
    await this.resets.delete({ userId });
    await this.users.delete({ id: userId });
    this.audit.event('auth.account.deleted', { user_id: userId, projects: ids.length });
  }

  /**
   * Password-reset request. Always resolves successfully (even for unknown or
   * OAuth-only accounts) so the endpoint cannot enumerate registrations. The
   * email goes via Resend when configured, otherwise it is logged for local dev.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.users.findOne({ where: { email: email.toLowerCase() } });
    if (user?.passwordHash) {
      await this.resets.delete({ userId: user.id });
      const opaque = crypto.randomBytes(32).toString('hex');
      await this.resets.save(
        this.resets.create({
          userId: user.id,
          tokenHash: crypto.createHash('sha256').update(opaque).digest('hex'),
          expiresAt: new Date(Date.now() + 3600000),
        }),
      );
      const app = this.config.get<string>('PUBLIC_APP_URL') ?? 'http://localhost:5173';
      const link = `${app.replace(/\/+$/, '')}/signin?reset=${opaque}`;
      const subject = 'Reset your Stackduck password';
      const html = `<p>Someone requested a password reset for this email address. This link works once and expires in one hour:</p><p><a href="${link}">Choose a new password</a></p><p>If that wasn't you, ignore this email.</p>`;
      const apiKey = this.config.get<string>('RESEND_API_KEY') ?? '';
      if (apiKey) {
        try {
          const { error } = await new Resend(apiKey).emails.send({
            from: this.config.get<string>('ALERT_FROM_EMAIL') ?? 'Stackduck <alerts@stackduck.app>',
            to: [user.email!],
            subject,
            html,
          });
          if (error) this.logger.warn(`password-reset email failed: ${error.message}`);
        } catch (e) {
          this.logger.warn(`password-reset email failed: ${(e as Error).message}`);
        }
      } else {
        this.logger.log(`PASSWORD-RESET (unsent — no RESEND_API_KEY) to ${maskEmail(user.email)}: ${link}`);
      }
    }
    this.audit.event('auth.password_reset.requested', { email: maskEmail(email) });
  }

  /** One-shot reset consume: valid token ⇒ new bcrypt-12 hash, all rows cleared. */
  async confirmPasswordReset(opaque: string, password: string): Promise<void> {
    const hash = crypto.createHash('sha256').update(opaque).digest('hex');
    const row = await this.resets.findOne({
      where: { tokenHash: hash, expiresAt: MoreThan(new Date()) },
    });
    if (!row) {
      this.audit.event('auth.password_reset.rejected', { reason: 'invalid_or_expired' });
      throw new UnauthorizedException({
        error: { code: 'invalid_reset', message: 'That reset link is invalid or expired — request a fresh one.' },
      });
    }
    await this.users.update({ id: row.userId }, { passwordHash: await bcrypt.hash(password, 12) });
    await this.resets.delete({ userId: row.userId });
    this.audit.event('auth.password_reset.completed', { user_id: row.userId });
  }

  /** Import-time provider token storage (GitHub repo / GCP project listing). */
  async storeIntegrationToken(userId: string, provider: 'github' | 'google', accessToken: string, scope?: string): Promise<void> {
    const enc = this.creds.encrypt(accessToken);
    const existing = await this.integrations.findOne({ where: { userId, provider } });
    if (existing) {
      existing.accessTokenEnc = enc;
      existing.scope = scope ?? existing.scope;
      await this.integrations.save(existing);
    } else {
      await this.integrations.save(this.integrations.create({ userId, provider, accessTokenEnc: enc, scope }));
    }
    this.audit.event('auth.integration.stored', { user_id: userId, provider });
  }

  async readIntegrationToken(userId: string, provider: 'github' | 'google'): Promise<string | null> {
    const row = await this.integrations.findOne({ where: { userId, provider } });
    if (!row) return null;
    try {
      return this.creds.decrypt(row.accessTokenEnc);
    } catch {
      return null;
    }
  }

  async listIntegrations(userId: string): Promise<Array<{ provider: string; updatedAt: Date }>> {
    const rows = await this.integrations.find({ where: { userId } });
    return rows.map((r) => ({ provider: r.provider, updatedAt: r.updatedAt }));
  }
}

/** Prefs allowlist — unknown keys are dropped, wrong types fall back to current. */
function sanitizePrefs(merged: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (merged['defaultWindowDays'] === 7 || merged['defaultWindowDays'] === 30 || merged['defaultWindowDays'] === 90) {
    out['defaultWindowDays'] = merged['defaultWindowDays'];
  }
  if (merged['portfolioSort'] === 'updated' || merged['portfolioSort'] === 'name') {
    out['portfolioSort'] = merged['portfolioSort'];
  }
  for (const k of ['emailProductUpdates', 'emailWeeklyDigest']) {
    if (typeof merged[k] === 'boolean') out[k] = merged[k];
  }
  return out;
}

function parseTtlMs(ttl: string): number {
  const m = ttl.match(/^(\d+)([smhd])$/);
  if (!m || !m[1] || !m[2]) return 30 * 86400000;
  const n = Number(m[1]);
  return ({ s: 1000, m: 60000, h: 3600000, d: 86400000 } as Record<string, number>)[m[2]]! * n;
}
