import { Injectable, UnauthorizedException } from '@nestjs/common';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/types';

const RP_NAME = 'Newlands Clinic Umoya';
const RP_ID = process.env.WEBAUTHN_RP_ID ?? 'localhost';
const ORIGIN = process.env.WEBAUTHN_ORIGIN ?? 'http://localhost:3000';

@Injectable()
export class WebAuthnService {
  async generateRegistrationOptions(userId: string, userEmail: string, db: any) {
    const existing: { credential_id: string }[] = await db.query(
      `SELECT credential_id FROM webauthn_credentials WHERE user_id = $1`,
      [userId],
    );

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: userId,
      userName: userEmail,
      attestationType: 'none',
      excludeCredentials: existing.map((c) => ({
        id: Buffer.from(c.credential_id, 'base64url') as unknown as Uint8Array,
        type: 'public-key' as const,
      })),
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    });

    await db.query(
      `INSERT INTO webauthn_challenges (user_id, challenge, type) VALUES ($1, $2, 'registration')
       ON CONFLICT DO NOTHING`,
      [userId, options.challenge],
    );

    return options;
  }

  async verifyRegistration(
    userId: string,
    response: RegistrationResponseJSON,
    deviceName: string,
    db: any,
  ): Promise<{ verified: boolean; credentialId: string }> {
    const rows: { challenge: string }[] = await db.query(
      `SELECT challenge FROM webauthn_challenges WHERE user_id = $1 AND type = 'registration' AND expires_at > NOW()`,
      [userId],
    );
    const row = rows?.[0] ?? null;
    if (!row) throw new UnauthorizedException('Challenge expired or not found');

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: row.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new UnauthorizedException('WebAuthn registration verification failed');
    }

    const { credentialID, credentialPublicKey, counter, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;

    const credIdBase64url = Buffer.from(credentialID).toString('base64url');

    await db.query(
      `INSERT INTO webauthn_credentials (user_id, credential_id, public_key, counter, device_type, backed_up, name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        credIdBase64url,
        Buffer.from(credentialPublicKey).toString('base64'),
        counter,
        credentialDeviceType ?? 'singleDevice',
        credentialBackedUp ?? false,
        deviceName,
      ],
    );

    await db.query(
      `DELETE FROM webauthn_challenges WHERE user_id = $1 AND type = 'registration'`,
      [userId],
    );

    return { verified: true, credentialId: credIdBase64url };
  }

  async generateAuthenticationOptions(userId: string, db: any) {
    const credentials: { credential_id: string }[] = await db.query(
      `SELECT credential_id FROM webauthn_credentials WHERE user_id = $1`,
      [userId],
    );

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials: credentials.map((c) => ({
        id: Buffer.from(c.credential_id, 'base64url') as unknown as Uint8Array,
        type: 'public-key' as const,
      })),
      userVerification: 'preferred',
    });

    await db.query(
      `INSERT INTO webauthn_challenges (user_id, challenge, type) VALUES ($1, $2, 'authentication')`,
      [userId, options.challenge],
    );

    return options;
  }

  async verifyAuthentication(userId: string, response: AuthenticationResponseJSON, db: any): Promise<boolean> {
    const challengeRows: { challenge: string }[] = await db.query(
      `SELECT challenge FROM webauthn_challenges WHERE user_id = $1 AND type = 'authentication' AND expires_at > NOW()`,
      [userId],
    );
    const challengeRow = challengeRows?.[0] ?? null;
    if (!challengeRow) throw new UnauthorizedException('Challenge expired or not found');

    const credRows: { public_key: string; counter: number }[] = await db.query(
      `SELECT public_key, counter FROM webauthn_credentials WHERE credential_id = $1 AND user_id = $2`,
      [response.id, userId],
    );
    const cred = credRows?.[0] ?? null;
    if (!cred) throw new UnauthorizedException('Credential not found');

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      authenticator: {
        credentialID: Buffer.from(response.id, 'base64url') as unknown as Uint8Array,
        credentialPublicKey: Buffer.from(cred.public_key, 'base64') as unknown as Uint8Array,
        counter: cred.counter,
      },
    });

    if (verification.verified) {
      await db.query(
        `UPDATE webauthn_credentials SET counter = $2, last_used_at = NOW() WHERE credential_id = $1`,
        [response.id, verification.authenticationInfo.newCounter],
      );
      await db.query(
        `DELETE FROM webauthn_challenges WHERE user_id = $1 AND type = 'authentication'`,
        [userId],
      );
    }

    return verification.verified;
  }

  async listCredentials(userId: string, db: any) {
    return db.query(
      `SELECT id, name, device_type, backed_up, last_used_at, created_at FROM webauthn_credentials WHERE user_id = $1`,
      [userId],
    );
  }

  async removeCredential(credentialDbId: string, userId: string, db: any): Promise<void> {
    await db.query(
      `DELETE FROM webauthn_credentials WHERE id = $1 AND user_id = $2`,
      [credentialDbId, userId],
    );
  }
}
