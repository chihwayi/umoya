import 'reflect-metadata';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { mkdirSync, writeFileSync } from 'fs';
import * as path from 'path';
import { Client } from 'pg';
import { PaymentsService } from '../services/ehr-service/src/services/payments.service';
import { Bill, BillStatus } from '../services/ehr-service/src/entities/billing.entity';
import {
  PaymentGatewayConfig,
  PaymentProviderType,
} from '../services/ehr-service/src/entities/payment-gateway-config.entity';
import { PaymentProviderEvent } from '../services/ehr-service/src/entities/payment-provider-event.entity';
import { PaymentVerificationAttempt } from '../services/ehr-service/src/entities/payment-verification-attempt.entity';

type TenantRow = {
  id: string;
  subdomain: string;
  databaseName: string;
  status: string;
};

type CreatedFixtureState = {
  configIds: string[];
  billIds: string[];
  transactionIds: string[];
};

type ProviderFixture = {
  providerType: PaymentProviderType;
  pathPrefix: string;
  phoneNumber: string;
  requiredConfig: Partial<PaymentGatewayConfig>;
};

const masterDatabaseUrl =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/medicore';

const providerFixtures: ProviderFixture[] = [
  {
    providerType: PaymentProviderType.ECOCASH,
    pathPrefix: '/ecocash',
    phoneNumber: '0772000000',
    requiredConfig: {
      merchantId: 'test-merchant-ecocash',
      integrationKey: 'test-integration-ecocash',
      apiKey: 'test-api-key-ecocash',
      apiSecret: 'test-api-secret-ecocash',
      webhookUrl: 'http://127.0.0.1/test/callback/ecocash',
      isTestMode: true,
      metadata: {
        initiationPath: '/ecocash/payments/initiate',
        statusPath: '/ecocash/payments/status',
        timeoutMs: 5000,
      },
    },
  },
  {
    providerType: PaymentProviderType.ONEMONEY,
    pathPrefix: '/onemoney',
    phoneNumber: '0782000000',
    requiredConfig: {
      merchantId: 'test-merchant-onemoney',
      apiKey: 'test-api-key-onemoney',
      apiSecret: 'test-api-secret-onemoney',
      webhookUrl: 'http://127.0.0.1/test/callback/onemoney',
      isTestMode: true,
      metadata: {
        initiationPath: '/onemoney/payments/initiate',
        statusPath: '/onemoney/payments/status',
        timeoutMs: 5000,
      },
    },
  },
];

async function main() {
  const masterClient = new Client({ connectionString: masterDatabaseUrl });
  await masterClient.connect();

  const serverState = new Map<string, { providerType: string; reference: string; status: string }>();
  const server = createProviderStubServer(serverState);
  const port = await startServer(server);
  const baseUrl = `http://127.0.0.1:${port}`;

  const evidenceDir = path.join(process.cwd(), 'scripts', 'evidence');
  mkdirSync(evidenceDir, { recursive: true });
  const evidencePath = path.join(evidenceDir, `moas04-live-gateway-validation-${new Date().toISOString().slice(0, 10)}.json`);

  const paymentsService = new PaymentsService();
  const tenants = await loadTenants(masterClient);
  const results: any[] = [];

  try {
    for (const tenant of tenants) {
      const tenantDb = await connectTenantDatabase(tenant.databaseName);
      const createdState: CreatedFixtureState = { configIds: [], billIds: [], transactionIds: [] };
      try {
        const bill = await ensureBillFixture(tenantDb, createdState);
        const providerResults = [];

        for (const fixture of providerFixtures) {
          await ensureGatewayFixture(tenantDb, fixture, baseUrl, createdState);
          const initiated =
            fixture.providerType === PaymentProviderType.ECOCASH
              ? await paymentsService.processEcoCashPayment(
                  {
                    billId: bill.id,
                    amount: Number(bill.totalAmount || 25),
                    phoneNumber: fixture.phoneNumber,
                    currency: String(bill.currency || 'USD'),
                  },
                  tenantDb,
                )
              : await paymentsService.processOneMoneyPayment(
                  {
                    billId: bill.id,
                    amount: Number(bill.totalAmount || 25),
                    phoneNumber: fixture.phoneNumber,
                    currency: String(bill.currency || 'USD'),
                  },
                  tenantDb,
                );

          const status = await paymentsService.getPaymentStatus(initiated.transactionId, tenantDb);
          const verification = await paymentsService.verifyPayment(
            initiated.transactionId,
            initiated.reference,
            tenantDb,
          );
          createdState.transactionIds.push(String(initiated.transactionId));

          providerResults.push({
            providerType: fixture.providerType,
            initiationStatus: initiated.status,
            refreshStatus: status.status,
            verificationStatus: verification.status,
            verified: verification.verified,
            reference: initiated.reference,
          });
        }

        results.push({
          tenant: tenant.subdomain,
          database: tenant.databaseName,
          providers: providerResults,
        });
      } finally {
        await cleanupFixtures(tenantDb, createdState);
        await tenantDb.destroy();
      }
    }
  } finally {
    await masterClient.end();
    await stopServer(server);
  }

  const report = {
    ok: results.every((tenant) =>
      tenant.providers.every(
        (provider: any) =>
          provider.initiationStatus === 'PENDING' &&
          provider.refreshStatus === 'COMPLETED' &&
          provider.verificationStatus === 'VERIFIED' &&
          provider.verified === true,
      ),
    ),
    generatedAt: new Date().toISOString(),
    tenants: results,
  };

  writeFileSync(evidencePath, JSON.stringify(report, null, 2));
  if (!report.ok) {
    throw new Error(`MOAS-04 live gateway validation failed. See ${evidencePath}`);
  }

  console.log(JSON.stringify({ ok: true, evidencePath, tenantCount: results.length, tenants: results }));
}

function createProviderStubServer(serverState: Map<string, { providerType: string; reference: string; status: string }>) {
  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      if (req.method === 'POST' && url.pathname.endsWith('/payments/initiate')) {
        const body = await readJsonBody(req);
        const transactionId = String(body.transactionId || '').trim();
        const providerType = String(body.providerType || '').trim() || (url.pathname.includes('ecocash') ? 'ecocash' : 'onemoney');
        const reference = String(body.reference || `REF_${transactionId}`).trim();
        serverState.set(transactionId, {
          providerType,
          reference,
          status: 'completed',
        });

        sendJson(res, 200, {
          status: 'pending_provider_confirmation',
          correlationId: `${providerType}-corr-${transactionId}`,
          reference,
          instructions: `Approve ${providerType} payment in your wallet.`,
        });
        return;
      }

      if (req.method === 'GET' && url.pathname.endsWith('/payments/status')) {
        const transactionId = String(url.searchParams.get('transactionId') || '').trim();
        const state = serverState.get(transactionId);
        if (!state) {
          sendJson(res, 404, { status: 'failed', message: 'transaction not found' });
          return;
        }

        sendJson(res, 200, {
          status: state.status,
          reference: state.reference,
          correlationId: `${state.providerType}-corr-${transactionId}`,
        });
        return;
      }

      sendJson(res, 404, { error: 'not_found' });
    } catch (error: any) {
      sendJson(res, 500, { error: error?.message || 'stub_failure' });
    }
  });
}

function startServer(server: ReturnType<typeof createServer>): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Unable to resolve stub server address'));
        return;
      }
      resolve(address.port);
    });
  });
}

function stopServer(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function readJsonBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res: ServerResponse, statusCode: number, payload: Record<string, any>) {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

async function loadTenants(masterClient: Client): Promise<TenantRow[]> {
  const { rows } = await masterClient.query<TenantRow>(
    `
      SELECT id, subdomain, "databaseName", status
      FROM tenants
      WHERE status IN ('active', 'pending', 'suspended')
      ORDER BY subdomain
    `,
  );
  return rows;
}

async function connectTenantDatabase(databaseName: string) {
  const url = new URL(masterDatabaseUrl);
  url.pathname = `/${databaseName}`;
  const client = new Client({ connectionString: url.toString() });
  await client.connect();

  return {
    query: async (sql: string, params?: any[]) => {
      const result = await client.query(sql, params);
      return result.rows;
    },
    getRepository: (entity: any) => buildRepositoryAdapter(entity, client),
    destroy: async () => {
      await client.end();
    },
  } as any;
}

async function ensureBillFixture(tenantDb: any, createdState: CreatedFixtureState) {
  const [patient] = await tenantDb.query(
    `SELECT id FROM patients ORDER BY created_at ASC NULLS LAST, id ASC LIMIT 1`,
  );
  const [user] = await tenantDb.query(
    `SELECT id FROM users ORDER BY created_at ASC NULLS LAST, id ASC LIMIT 1`,
  );
  if (!patient?.id || !user?.id) {
    throw new Error('Unable to create temporary bill fixture: missing patient or user row');
  }

  const [created] = await tenantDb.query(
    `
      INSERT INTO billing (
        invoice_number,
        patient_id,
        subtotal,
        tax_amount,
        discount_amount,
        total_amount,
        status,
        billing_date,
        due_date,
        currency,
        created_by
      )
      VALUES ($1, $2, $3, 0, 0, $3, $4, CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days', 'USD', $5)
      RETURNING id
    `,
    [`MOAS04-${Date.now()}`, patient.id, 25, BillStatus.PENDING, user.id],
  );

  createdState.billIds.push(created.id);
  return {
    id: created.id,
    patientId: patient.id,
    totalAmount: 25,
    currency: 'USD',
    status: BillStatus.PENDING,
  };
}

async function ensureGatewayFixture(
  tenantDb: any,
  fixture: ProviderFixture,
  baseUrl: string,
  createdState: CreatedFixtureState,
) {
  const [created] = await tenantDb.query(
    `
      INSERT INTO payment_gateway_configurations (
        provider_type,
        provider_name,
        api_url,
        merchant_id,
        integration_key,
        api_key,
        api_secret,
        webhook_url,
        is_active,
        is_test_mode,
        metadata
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE,TRUE,$9::jsonb)
      RETURNING id
    `,
    [
      fixture.providerType,
      fixture.providerType === PaymentProviderType.ECOCASH ? 'EcoCash Test' : 'OneMoney Test',
      baseUrl,
      fixture.requiredConfig.merchantId || null,
      fixture.requiredConfig.integrationKey || null,
      fixture.requiredConfig.apiKey || null,
      fixture.requiredConfig.apiSecret || null,
      fixture.requiredConfig.webhookUrl || null,
      JSON.stringify(fixture.requiredConfig.metadata || {}),
    ],
  );
  createdState.configIds.push(created.id);
  return created;
}

function buildRepositoryAdapter(entity: any, client: Client) {
  if (entity === Bill) {
    return {
      findOne: async ({ where }: any) => {
        const billId = where?.id;
        if (!billId) return null;
        const { rows } = await client.query(
          `
            SELECT id, patient_id AS "patientId", total_amount AS "totalAmount", currency, status
            FROM billing
            WHERE id = $1
            LIMIT 1
          `,
          [billId],
        );
        return rows[0] || null;
      },
    };
  }

  if (entity === PaymentGatewayConfig) {
    return {
      findOne: async ({ where }: any) => {
        const { rows } = await client.query(
          `
            SELECT
              id,
              provider_type AS "providerType",
              provider_name AS "providerName",
              api_url AS "apiUrl",
              merchant_id AS "merchantId",
              integration_key AS "integrationKey",
              api_key AS "apiKey",
              api_secret AS "apiSecret",
              webhook_url AS "webhookUrl",
              webhook_secret AS "webhookSecret",
              is_active AS "isActive",
              is_test_mode AS "isTestMode",
              metadata,
              created_at AS "createdAt",
              updated_at AS "updatedAt"
            FROM payment_gateway_configurations
            WHERE provider_type = $1
              AND is_active = $2
            ORDER BY updated_at DESC
            LIMIT 1
          `,
          [where?.providerType, where?.isActive ?? true],
        );
        return rows[0] || null;
      },
    };
  }

  if (entity === PaymentProviderEvent) {
    return {
      create: (input: any) => input,
      save: async (input: any) => {
        const { rows } = await client.query(
          `
            INSERT INTO payment_provider_events (
              transaction_id,
              bill_id,
              provider_type,
              event_type,
              provider_status,
              reference,
              correlation_id,
              request_payload,
              response_payload
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb)
            RETURNING
              id,
              transaction_id AS "transactionId",
              bill_id AS "billId",
              provider_type AS "providerType",
              event_type AS "eventType",
              provider_status AS "providerStatus",
              reference,
              correlation_id AS "correlationId",
              request_payload AS "requestPayload",
              response_payload AS "responsePayload",
              event_timestamp AS "eventTimestamp",
              created_at AS "createdAt",
              updated_at AS "updatedAt"
          `,
          [
            input.transactionId,
            input.billId || null,
            input.providerType,
            input.eventType,
            input.providerStatus || null,
            input.reference || null,
            input.correlationId || null,
            JSON.stringify(input.requestPayload || {}),
            JSON.stringify(input.responsePayload || {}),
          ],
        );
        return rows[0];
      },
      findOne: async ({ where }: any) => {
        const { rows } = await client.query(
          `
            SELECT
              id,
              transaction_id AS "transactionId",
              bill_id AS "billId",
              provider_type AS "providerType",
              event_type AS "eventType",
              provider_status AS "providerStatus",
              reference,
              correlation_id AS "correlationId",
              request_payload AS "requestPayload",
              response_payload AS "responsePayload",
              event_timestamp AS "eventTimestamp",
              created_at AS "createdAt",
              updated_at AS "updatedAt"
            FROM payment_provider_events
            WHERE transaction_id = $1
            ORDER BY event_timestamp DESC, created_at DESC
            LIMIT 1
          `,
          [where?.transactionId],
        );
        return rows[0] || null;
      },
    };
  }

  if (entity === PaymentVerificationAttempt) {
    return {
      create: (input: any) => input,
      save: async (input: any) => {
        const { rows } = await client.query(
          `
            INSERT INTO payment_verification_attempts (
              transaction_id,
              provider_type,
              reference,
              outcome,
              reason,
              response_payload
            )
            VALUES ($1,$2,$3,$4,$5,$6::jsonb)
            RETURNING
              id,
              transaction_id AS "transactionId",
              provider_type AS "providerType",
              reference,
              outcome,
              reason,
              response_payload AS "responsePayload",
              attempted_at AS "attemptedAt",
              created_at AS "createdAt",
              updated_at AS "updatedAt"
          `,
          [
            input.transactionId,
            input.providerType || null,
            input.reference || null,
            input.outcome,
            input.reason || null,
            JSON.stringify(input.responsePayload || {}),
          ],
        );
        return rows[0];
      },
      findOne: async ({ where }: any) => {
        const { rows } = await client.query(
          `
            SELECT
              id,
              transaction_id AS "transactionId",
              provider_type AS "providerType",
              reference,
              outcome,
              reason,
              response_payload AS "responsePayload",
              attempted_at AS "attemptedAt",
              created_at AS "createdAt",
              updated_at AS "updatedAt"
            FROM payment_verification_attempts
            WHERE transaction_id = $1
            ORDER BY attempted_at DESC, created_at DESC
            LIMIT 1
          `,
          [where?.transactionId],
        );
        return rows[0] || null;
      },
    };
  }

  throw new Error(`Unsupported repository adapter: ${entity?.name}`);
}

async function cleanupFixtures(tenantDb: any, createdState: CreatedFixtureState) {
  if (createdState.transactionIds.length > 0) {
    await tenantDb.query(
      `DELETE FROM payment_verification_attempts WHERE transaction_id = ANY($1::text[])`,
      [createdState.transactionIds],
    );
    await tenantDb.query(
      `DELETE FROM payment_provider_events WHERE transaction_id = ANY($1::text[])`,
      [createdState.transactionIds],
    );
  }
  if (createdState.configIds.length > 0) {
    await tenantDb.query(
      `DELETE FROM payment_gateway_configurations WHERE id = ANY($1::uuid[])`,
      [createdState.configIds],
    );
  }
  if (createdState.billIds.length > 0) {
    await tenantDb.query(
      `DELETE FROM billing WHERE id = ANY($1::uuid[])`,
      [createdState.billIds],
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
