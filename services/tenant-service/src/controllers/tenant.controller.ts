import { Controller, Get, Post, Put, Delete, Body, Param, ValidationPipe, UseInterceptors, UploadedFile, UseGuards, Query, BadRequestException, NotFoundException, Res, Header } from "@nestjs/common";
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
    private readonly storageService: StorageService
  ) {}

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
    @Body(ValidationPipe) createTenantDto: CreateTenantDto
  ): Promise<{ tenant: SafeTenant; message: string }> {
    const tenant = await this.tenantService.createTenant(createTenantDto);
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
        `MediCore: Payment confirmed for ${tenant.clinicName}. Access extended by ${monthsToExtend} month(s) until ${newBillingEndsAt.toDateString()}. Thank you.`,
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
    @Body(ValidationPipe) updateTenantDto: UpdateTenantDto
  ): Promise<SafeTenant> {
    const tenant = await this.tenantService.updateTenant(id, updateTenantDto);
    return this.toSafeTenant(tenant);
  }

  @Put(":id/status")
  @UseGuards(JwtAuthGuard)
  async updateTenantStatus(
    @Param("id") id: string,
    @Body("status") status: TenantStatus
  ): Promise<SafeTenant> {
    const tenant = await this.tenantService.updateTenantStatus(id, status);
    return this.toSafeTenant(tenant);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  async deleteTenant(@Param("id") id: string): Promise<{ message: string }> {
    await this.tenantService.deleteTenant(id);
    return { message: "Tenant deleted successfully" };
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
