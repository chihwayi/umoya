import { Controller, Get, Post, Put, Delete, Body, Param, ValidationPipe, UseInterceptors, UploadedFile, UseGuards, Query, BadRequestException, NotFoundException, ForbiddenException, Res, Header, Req } from "@nestjs/common";
import * as QRCode from "qrcode";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { TenantBillingSummary, TenantService } from "../services/tenant.service";
import { PaymentService } from "../payment/payment.service";
import { SmsService } from "../services/sms.service";
import { StorageService } from "../services/storage.service";
import { CreateTenantDto } from "../dto/create-tenant.dto";
import { UpdateTenantDto } from "../dto/update-tenant.dto";
import { Tenant, TenantStatus } from "../entities/tenant.entity";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { AuditService } from "../services/audit.service";
import { ApiKeyService } from "../services/api-key.service";
import { TenantDatabaseService } from "../services/tenant-database.service";
import { AdminRole } from "../entities/admin-user.entity";
import { JwtService } from "@nestjs/jwt";
import { randomUUID } from "crypto";
import { TenantDhis2ConfigPayload, TenantDhis2ConfigView } from "../services/tenant.service";
import { getCountryPack, listCountryPacks, CountryPack } from "../config/country-packs";
import { getModeDefinition, DEPLOYMENT_MODES, ModeDefinition } from "../config/deployment-modes";

type SafeTenant = Omit<Tenant, "connectionString"> & { billingSummary: TenantBillingSummary };
type PublicTenant = Pick<Tenant, "id" | "subdomain" | "clinicName" | "status" | "logoUrl" | "enabledModules" | "subscriptionMode" | "packagePreset" | "subscriptionState" | "packageName"> & {
  deploymentMode: string;
  billingSummary: TenantBillingSummary;
};

@ApiTags("tenants")
@ApiBearerAuth()
@Controller("tenants")
export class TenantController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly paymentService: PaymentService,
    private readonly smsService: SmsService,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService,
    private readonly tenantDatabaseService: TenantDatabaseService,
    private readonly jwtService: JwtService,
    private readonly apiKeyService: ApiKeyService
  ) {}

  private assertRole(req: any, allowed: AdminRole[]) {
    const r = String(req?.user?.role || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
    const role = r === "superadmin" ? AdminRole.SUPER_ADMIN : (r as AdminRole);
    if (!role || !allowed.includes(role)) {
      throw new ForbiddenException("Insufficient privileges for this operation");
    }
  }

  /** Extract acting admin id + request context from the JWT-authenticated request. */
  private auditContext(req: any): { userId: string | null; ip?: string; ua?: string } {
    return {
      userId: req?.user?.id || null,
      ip: req?.ip || req?.headers?.["x-forwarded-for"] || undefined,
      ua: req?.headers?.["user-agent"] || undefined,
    };
  }

  private toSafeTenant(tenant: Tenant): SafeTenant {
    const { connectionString, ...safeTenant } = tenant;
    return {
      ...safeTenant,
      billingSummary: this.tenantService.getBillingSummary(tenant),
    };
  }

  private toPublicTenant(tenant: Tenant): PublicTenant {
    return {
      id: tenant.id,
      subdomain: tenant.subdomain,
      clinicName: tenant.clinicName,
      status: tenant.status,
      logoUrl: tenant.logoUrl,
      enabledModules: tenant.enabledModules,
      subscriptionMode: tenant.subscriptionMode,
      packagePreset: tenant.packagePreset,
      subscriptionState: tenant.subscriptionState,
      packageName: tenant.packageName,
      deploymentMode: tenant.deploymentMode ?? "clinic",
      billingSummary: this.tenantService.getBillingSummary(tenant),
    };
  }

  @Post("logo")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  @ApiOperation({ summary: "Upload tenant logo" })
  @ApiResponse({ status: 201, description: "Logo uploaded successfully" })
  async uploadLogo(@UploadedFile() file: any): Promise<{ url: string }> {
    const url = await this.storageService.uploadLogo(file);
    return { url };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Create new tenant" })
  @ApiResponse({ status: 201, description: "Tenant created successfully" })
  async createTenant(
    @Body(ValidationPipe) createTenantDto: CreateTenantDto,
    @Req() req: any
  ): Promise<{ tenant: SafeTenant; message: string }> {
    const tenant = await this.tenantService.createTenant(createTenantDto);
    const ctx = this.auditContext(req);
    await this.auditService.safeLog(
      ctx.userId, "create", "tenant", tenant.id,
      null,
      { clinicName: tenant.clinicName, subdomain: tenant.subdomain, tier: tenant.subscriptionTier, mode: tenant.subscriptionMode },
      ctx.ip, ctx.ua,
    );
    return {
      tenant: this.toSafeTenant(tenant),
      message: "Tenant created successfully. Database provisioning in progress."
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get all tenants" })
  @ApiResponse({ status: 200, description: "List of all tenants" })
  async getAllTenants(): Promise<SafeTenant[]> {
    const tenants = await this.tenantService.getAllTenants();
    return tenants.map((tenant) => this.toSafeTenant(tenant));
  }

  @Get("active")
  @ApiOperation({ summary: "Get active tenants (public-safe payload)" })
  @ApiResponse({ status: 200, description: "List of active tenants" })
  async getActiveTenants(): Promise<PublicTenant[]> {
    const tenants = await this.tenantService.getAllTenants();
    return tenants
      .filter((tenant) => tenant.status === TenantStatus.ACTIVE)
      .map((tenant) => this.toPublicTenant(tenant));
  }

  @Get("search")
  @ApiOperation({ summary: "Search active tenants by name or subdomain (public — mobile discovery)" })
  @ApiResponse({ status: 200, description: "Matching tenants" })
  async searchTenants(
    @Query("q") q: string,
  ): Promise<Array<{ id: string; slug: string; name: string; baseUrl: string; logoUrl?: string }>> {
    if (!q || q.trim().length < 2) return [];
    return this.tenantService.searchTenants(q.trim());
  }

  @Get("country-packs")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "List all supported country packs" })
  getCountryPacks(): CountryPack[] {
    return listCountryPacks();
  }

  @Get("deployment-modes")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "List all deployment mode definitions" })
  listDeploymentModes(): ModeDefinition[] {
    return Object.values(DEPLOYMENT_MODES);
  }

  @Get("billing/at-risk")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "List tenants approaching billing lapse or suspension" })
  async getBillingAtRisk(): Promise<any[]> {
    const now = new Date();
    const warningWindow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const tenants = await this.tenantService.findAll();
    return tenants
      .filter((t: any) => {
        if (t.subscriptionState === "grace") return true;
        if (t.subscriptionMode === "demo" && t.demoExpiresAt && new Date(t.demoExpiresAt) < warningWindow) return true;
        if (t.subscriptionMode === "paid" && t.billingEndsAt && new Date(t.billingEndsAt) < warningWindow) return true;
        return false;
      })
      .map((t: any) => ({
        id: t.id,
        clinicName: t.clinicName,
        subdomain: t.subdomain,
        subscriptionState: t.subscriptionState,
        subscriptionMode: t.subscriptionMode,
        billingEndsAt: t.billingEndsAt,
        demoExpiresAt: t.demoExpiresAt,
        graceEndsAt: t.graceEndsAt,
        autoDeleteAt: t.autoDeleteAt,
      }));
  }

  @Get("subdomain/:subdomain")
  async getTenantBySubdomain(@Param("subdomain") subdomain: string): Promise<PublicTenant> {
    const tenant = await this.tenantService.findBySubdomain(subdomain);
    return this.toPublicTenant(tenant);
  }

  @Get(":id/logo")
  @ApiOperation({ summary: "Stream tenant logo for mobile/web consumers" })
  async getTenantLogo(@Param("id") id: string, @Res() res: Response): Promise<void> {
    const tenant = await this.tenantService.findById(id);
    if (!tenant.logoUrl) {
      throw new NotFoundException("Tenant logo not configured");
    }

    const file = await this.storageService.getObjectByPublicUrl(tenant.logoUrl);
    res.setHeader("Content-Type", file.contentType || "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.status(200).send(file.body);
  }

  @Get(":id/qr")
  @ApiOperation({ summary: "Generate QR code PNG for mobile clinic selection" })
  @Header("Cache-Control", "public, max-age=3600")
  async getTenantQr(@Param("id") id: string, @Res() res: Response): Promise<void> {
    const tenant = await this.tenantService.findById(id);

    const ehrBase = (
      process.env.PUBLIC_EHR_BASE_URL ||
      (process.env.SERVER_HOST ? `http://${process.env.SERVER_HOST}:${process.env.PORT_EHR_SERVICE || "3013"}/api` : "") ||
      process.env.SERVICE_EHR_URL ||
      `http://localhost:${process.env.PORT_EHR_SERVICE || "3013"}/api`
    ).replace(/\/$/, "");

    const payload = JSON.stringify({
      id: tenant.id,
      slug: tenant.subdomain,
      name: tenant.clinicName,
      baseUrl: ehrBase.endsWith("/api") ? ehrBase : `${ehrBase}/api`,
    });

    const png = await QRCode.toBuffer(payload, {
      type: "png",
      width: 600,
      margin: 2,
      color: { dark: "#080E1A", light: "#FFFFFF" },
      errorCorrectionLevel: "H",
    });

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", `inline; filename="${tenant.subdomain}-qr.png"`);
    res.status(200).send(png);
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  async getTenantById(@Param("id") id: string): Promise<SafeTenant> {
    const tenant = await this.tenantService.findById(id);
    return this.toSafeTenant(tenant);
  }

  @Post(":id/confirm-payment")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Confirm a payment and extend tenant billing" })
  async confirmPayment(
    @Param("id") id: string,
    @Body() body: { monthsToExtend: number; reference?: string },
  ): Promise<{ ok: boolean; billingEndsAt: string }> {
    const tenant = await this.tenantService.findById(id);
    if (!tenant) throw new NotFoundException("Tenant not found");

    const monthsToExtend = Math.max(1, Math.min(24, Number(body.monthsToExtend) || 1));
    const currentBase =
      tenant.billingEndsAt && new Date(tenant.billingEndsAt) > new Date()
        ? new Date(tenant.billingEndsAt)
        : new Date();

    const newBillingEndsAt = new Date(currentBase);
    newBillingEndsAt.setMonth(newBillingEndsAt.getMonth() + monthsToExtend);

    await this.tenantService.updateTenant(id, {
      billingEndsAt: newBillingEndsAt.toISOString().slice(0, 10),
      subscriptionMode: "paid",
    } as any);

    // Reactivate if currently suspended due to billing lapse
    if (tenant.status === "suspended" && tenant.subscriptionState !== "demo") {
      await this.tenantService.updateTenant(id, { status: "active" } as any);
    }

    if (tenant.contactPhone) {
      await this.smsService.send(
        tenant.contactPhone,
        `Umoya: Payment confirmed for ${tenant.clinicName}. Access extended by ${monthsToExtend} month(s) until ${newBillingEndsAt.toDateString()}. Thank you.`,
      );
    }

    return { ok: true, billingEndsAt: newBillingEndsAt.toISOString() };
  }

  @Post(':id/payment/initiate')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Initiate a payment for subscription renewal' })
  async initiatePayment(
    @Param('id') id: string,
    @Body() body: { monthsToExtend: number; amountUsd: number },
  ): Promise<any> {
    const months = Math.max(1, Math.min(24, Number(body.monthsToExtend) || 1));
    const amount = Number(body.amountUsd) || months * 50;
    return this.paymentService.initiatePayment(id, months, amount);
  }

  @Get(":id/country-pack")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get resolved country pack for a tenant" })
  async getTenantCountryPack(@Param("id") id: string): Promise<CountryPack> {
    const tenant = await this.tenantService.findById(id);
    if (!tenant) throw new NotFoundException("Tenant not found");
    return getCountryPack(tenant.countryCode ?? tenant.country);
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Update tenant details" })
  @ApiResponse({ status: 200, description: "Tenant updated successfully" })
  async updateTenant(
    @Param("id") id: string,
    @Body(ValidationPipe) updateTenantDto: UpdateTenantDto,
    @Req() req: any
  ): Promise<SafeTenant> {
    // If the tier is changing, compute proration against the pre-update state
    // so it can be recorded on the audit trail alongside the change.
    const before = await this.tenantService.findById(id).catch(() => null);
    let proration: any = null;
    if (before && updateTenantDto.subscriptionTier && updateTenantDto.subscriptionTier !== before.subscriptionTier) {
      proration = this.tenantService.computeProration(before, updateTenantDto.subscriptionTier as any);
    }

    const tenant = await this.tenantService.updateTenant(id, updateTenantDto);
    const ctx = this.auditContext(req);
    await this.auditService.safeLog(
      ctx.userId, "update", "tenant", id, null,
      proration?.applicable ? { ...(updateTenantDto as any), proration } : (updateTenantDto as any),
      ctx.ip, ctx.ua,
    );
    return this.toSafeTenant(tenant);
  }

  @Put(":id/status")
  @UseGuards(JwtAuthGuard)
  async updateTenantStatus(
    @Param("id") id: string,
    @Body("status") status: TenantStatus,
    @Req() req: any
  ): Promise<SafeTenant> {
    const tenant = await this.tenantService.updateTenantStatus(id, status);
    const ctx = this.auditContext(req);
    const action = status === TenantStatus.SUSPENDED ? "tenant_suspend"
      : status === TenantStatus.ACTIVE ? "tenant_activate" : "update";
    await this.auditService.safeLog(
      ctx.userId, action, "tenant", id, null, { status }, ctx.ip, ctx.ua,
    );
    return this.toSafeTenant(tenant);
  }

  @Get(":id/audit")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get the audit trail for a tenant" })
  @ApiResponse({ status: 200, description: "Tenant audit log entries" })
  async getTenantAudit(
    @Param("id") id: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ): Promise<any> {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(200, Math.max(1, Number(limit) || 50));
    return this.auditService.getResourceAuditLogs(id, p, l);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Request tenant deletion (GDPR/CDPA soft-delete with grace period)" })
  async deleteTenant(
    @Param("id") id: string,
    @Req() req: any,
    @Query("force") force?: string,
    @Body("reason") reason?: string,
  ): Promise<{ message: string; purgeScheduledAt?: Date | null }> {
    const ctx = this.auditContext(req);

    // Explicit, irreversible hard purge (e.g. compliance directive / cleanup).
    if (String(force) === "true") {
      const existing = await this.tenantService.findById(id).catch(() => null);
      await this.tenantService.deleteTenant(id);
      await this.auditService.safeLog(
        ctx.userId, "delete", "tenant", id,
        existing ? { clinicName: existing.clinicName, subdomain: existing.subdomain } : null,
        { forcePurge: true }, ctx.ip, ctx.ua,
      );
      return { message: "Tenant permanently purged." };
    }

    // Default: GDPR/CDPA soft-delete — suspend now, purge after the grace window.
    const tenant = await this.tenantService.requestDeletion(id, reason || null, ctx.userId);
    await this.auditService.safeLog(
      ctx.userId, "delete", "tenant", id,
      null, { event: "deletion_requested", reason: reason || null, purgeScheduledAt: tenant.purgeScheduledAt },
      ctx.ip, ctx.ua,
    );
    return {
      message: "Tenant scheduled for deletion. Access suspended; can be cancelled before the purge date.",
      purgeScheduledAt: tenant.purgeScheduledAt,
    };
  }

  @Post(":id/cancel-deletion")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Cancel a pending tenant deletion within the grace window" })
  async cancelDeletion(@Param("id") id: string, @Req() req: any): Promise<SafeTenant> {
    const tenant = await this.tenantService.cancelDeletion(id);
    const ctx = this.auditContext(req);
    await this.auditService.safeLog(
      ctx.userId, "update", "tenant", id, null, { event: "deletion_cancelled", restoredStatus: tenant.status }, ctx.ip, ctx.ua,
    );
    return this.toSafeTenant(tenant);
  }

  @Post(":id/impersonate")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Mint a short-lived token to log in as a tenant user (super-admin only, audited)" })
  async impersonate(
    @Param("id") id: string,
    @Req() req: any,
    @Body("userId") userId?: string,
    @Body("reason") reason?: string,
  ): Promise<{ token: string; expiresInMinutes: number; deepLink: string; user: any }> {
    // Super-admin only, and a reason is mandatory for the audit record.
    this.assertRole(req, [AdminRole.SUPER_ADMIN]);
    if (!reason || !reason.trim()) {
      throw new BadRequestException("A reason is required to impersonate a tenant user");
    }

    const tenant = await this.tenantService.findById(id);
    if (tenant.status !== TenantStatus.ACTIVE) {
      throw new BadRequestException("Can only impersonate users of an active tenant");
    }

    const users = await this.tenantDatabaseService.getTenantUsers(id);
    const active = users.filter((u) => (u as any).isActive !== false);
    const target = userId
      ? active.find((u) => u.id === userId)
      : (active.find((u) => u.role === "admin") || active[0]);
    if (!target) throw new NotFoundException("No suitable tenant user found to impersonate");

    // Mint an EHR-compatible staff token (same JWT_SECRET, same claim shape),
    // short-lived (15 min) and clearly marked as an impersonation session.
    const expiresInMinutes = 15;
    const jti = randomUUID();
    const token = this.jwtService.sign(
      {
        sub: target.id,
        email: target.email,
        role: target.role,
        // EHR guards compare the token's tenantId against the X-Tenant-ID header,
        // which the EHR frontend sets to the SUBDOMAIN (not the UUID).
        tenantId: tenant.subdomain,
        firstName: (target as any).firstName,
        lastName: (target as any).lastName,
        mfaVerified: true,
        mfaRequired: false,
        sessionTimeoutMinutes: expiresInMinutes,
        jti,
        impersonation: true,
        impersonatedBy: req?.user?.id || null,
        impersonatorEmail: req?.user?.email || null,
      },
      { expiresIn: `${expiresInMinutes}m` },
    );

    // Browser-reachable URL (NOT the internal docker hostname EHR_FRONTEND_URL).
    const ehrBase = (process.env.PUBLIC_EHR_FRONTEND_URL || process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/+$/, "");
    // Token in the URL fragment (#) — never sent to servers / not in access logs.
    const deepLink = `${ehrBase}/ehr/${tenant.subdomain}/impersonate#token=${encodeURIComponent(token)}`;

    const ctx = this.auditContext(req);
    await this.auditService.safeLog(
      ctx.userId, "login", "tenant", id,
      null,
      { event: "impersonation", targetUserId: target.id, targetEmail: target.email, targetRole: target.role, reason: reason.trim(), expiresInMinutes },
      ctx.ip, ctx.ua,
    );

    return {
      token,
      expiresInMinutes,
      deepLink,
      user: { id: target.id, email: target.email, role: target.role, firstName: (target as any).firstName, lastName: (target as any).lastName },
    };
  }

  // ── Per-tenant API keys ────────────────────────────────────────────────────

  @Get(":id/api-keys")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "List a tenant's API keys (secrets never returned)" })
  async listApiKeys(@Param("id") id: string): Promise<any> {
    await this.tenantService.findById(id); // 404 if tenant missing
    return this.apiKeyService.list(id);
  }

  @Post(":id/api-keys")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Create a tenant API key (full secret shown once)" })
  async createApiKey(
    @Param("id") id: string,
    @Req() req: any,
    @Body("name") name: string,
    @Body("scopes") scopes?: string[],
    @Body("expiresAt") expiresAt?: string,
  ): Promise<any> {
    this.assertRole(req, [AdminRole.SUPER_ADMIN]);
    await this.tenantService.findById(id);
    const ctx = this.auditContext(req);
    const result = await this.apiKeyService.create(id, { name, scopes, expiresAt, createdBy: ctx.userId });
    await this.auditService.safeLog(
      ctx.userId, "create", "tenant", id, null,
      { event: "api_key_created", keyId: result.key.id, keyPrefix: result.key.keyPrefix, scopes: result.key.scopes },
      ctx.ip, ctx.ua,
    );
    return result; // { key, secret }
  }

  @Delete(":id/api-keys/:keyId")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Revoke a tenant API key" })
  async revokeApiKey(@Param("id") id: string, @Param("keyId") keyId: string, @Req() req: any): Promise<any> {
    this.assertRole(req, [AdminRole.SUPER_ADMIN]);
    const key = await this.apiKeyService.revoke(id, keyId);
    const ctx = this.auditContext(req);
    await this.auditService.safeLog(
      ctx.userId, "update", "tenant", id, null, { event: "api_key_revoked", keyId }, ctx.ip, ctx.ua,
    );
    return key;
  }

  @Post("api-keys/verify")
  @ApiOperation({ summary: "Verify an API key (used by integrations to authenticate)" })
  async verifyApiKey(@Body("key") key: string): Promise<any> {
    const result = await this.apiKeyService.verify(key);
    return { valid: true, ...result };
  }

  @Get(":id/proration-preview")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Preview the prorated cost/credit of a tier change (no side effects)" })
  async prorationPreview(@Param("id") id: string, @Query("tier") tier: string): Promise<any> {
    const tenant = await this.tenantService.findById(id);
    if (!tier) throw new BadRequestException("tier query param is required");
    return this.tenantService.computeProration(tenant, tier as any);
  }

  @Get(":id/rate-limit")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get a tenant's API rate limit (requests/minute)" })
  async getRateLimit(@Param("id") id: string): Promise<{ apiRateLimitPerMin: number }> {
    await this.tenantService.findById(id);
    return this.apiKeyService.getRateLimit(id);
  }

  @Put(":id/rate-limit")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Set a tenant's API rate limit (requests/minute; 0 = unlimited)" })
  async setRateLimit(
    @Param("id") id: string,
    @Req() req: any,
    @Body("apiRateLimitPerMin") apiRateLimitPerMin: number,
  ): Promise<{ apiRateLimitPerMin: number }> {
    this.assertRole(req, [AdminRole.SUPER_ADMIN]);
    const result = await this.apiKeyService.setRateLimit(id, apiRateLimitPerMin);
    const ctx = this.auditContext(req);
    await this.auditService.safeLog(
      ctx.userId, "update", "tenant", id, null,
      { event: "rate_limit_changed", apiRateLimitPerMin: result.apiRateLimitPerMin }, ctx.ip, ctx.ua,
    );
    return result;
  }

  @Get(":id/health")
  @UseGuards(JwtAuthGuard)
  async checkTenantHealth(@Param("id") id: string): Promise<{ status: string; database: string }> {
    const tenant = await this.tenantService.findById(id);
    return {
      status: tenant.status,
      database: tenant.connectionString ? "connected" : "not_connected"
    };
  }

  @Get(":id/dhis2-config")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get tenant DHIS2 integration config (secret-safe view)" })
  async getTenantDhis2Config(@Param("id") id: string): Promise<TenantDhis2ConfigView | { configured: false }> {
    const config = await this.tenantService.getTenantDhis2Config(id);
    if (!config) {
      return { configured: false };
    }
    return config;
  }

  @Put(":id/dhis2-config")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Create/update tenant DHIS2 integration config" })
  async upsertTenantDhis2Config(
    @Param("id") id: string,
    @Body(ValidationPipe) body: TenantDhis2ConfigPayload,
  ): Promise<TenantDhis2ConfigView> {
    return this.tenantService.upsertTenantDhis2Config(id, body);
  }

  @Delete(":id/dhis2-config")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Delete tenant DHIS2 integration config" })
  async clearTenantDhis2Config(@Param("id") id: string): Promise<{ message: string }> {
    await this.tenantService.clearTenantDhis2Config(id);
    return { message: "Tenant DHIS2 config deleted" };
  }

  @Get(":id/subscription-payments/providers")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get supported tenant subscription payment providers" })
  async getSubscriptionPaymentProviders(@Param("id") id: string) {
    await this.tenantService.findById(id);
    return this.tenantService.getSubscriptionPaymentProviders();
  }

  @Get(":id/subscription-payments")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get tenant subscription payment history" })
  async getSubscriptionPayments(
    @Param("id") id: string,
    @Query("limit") limit?: string,
  ) {
    const parsedLimit = Number(limit);
    return this.tenantService.listSubscriptionPayments(id, Number.isFinite(parsedLimit) ? parsedLimit : undefined);
  }

  @Post(":id/subscription-payments/session")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Create online subscription payment session for tenant" })
  async createSubscriptionPaymentSession(
    @Param("id") id: string,
    @Body()
    body: {
      provider: string;
      amount?: number;
      currency?: string;
      monthsToExtend?: number;
      successUrl?: string;
      cancelUrl?: string;
      metadata?: Record<string, any>;
    },
  ) {
    if (!body || !String(body.provider || "").trim()) {
      throw new BadRequestException("provider is required");
    }
    return this.tenantService.createSubscriptionPaymentSession(id, body);
  }

  @Post(":id/subscription-payments/:paymentId/confirm")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Confirm/update tenant subscription payment status" })
  async confirmSubscriptionPayment(
    @Param("id") id: string,
    @Param("paymentId") paymentId: string,
    @Body()
    body: {
      status: "successful" | "failed" | "cancelled";
      externalPaymentId?: string;
      note?: string;
    },
  ) {
    return this.tenantService.confirmSubscriptionPayment(id, paymentId, body || { status: "failed" });
  }

  @Get(":id/deployment-mode")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get deployment mode for a tenant" })
  async getTenantDeploymentMode(
    @Param("id") id: string,
  ): Promise<{ mode: string; definition: ModeDefinition }> {
    const tenant = await this.tenantService.findById(id);
    if (!tenant) throw new NotFoundException("Tenant not found");
    return {
      mode: tenant.deploymentMode ?? "clinic",
      definition: getModeDefinition(tenant.deploymentMode),
    };
  }
}
