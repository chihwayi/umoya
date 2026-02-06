"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const schedule_1 = require("@nestjs/schedule");
const tenant_controller_1 = require("./controllers/tenant.controller");
const admin_maintenance_controller_1 = require("./controllers/admin-maintenance.controller");
const tenant_user_controller_1 = require("./controllers/tenant-user.controller");
const tenant_analytics_controller_1 = require("./controllers/tenant-analytics.controller");
const tenant_service_1 = require("./services/tenant.service");
const tenant_analytics_service_1 = require("./services/tenant-analytics.service");
const database_provisioning_service_1 = require("./services/database-provisioning.service");
const tenant_database_service_1 = require("./services/tenant-database.service");
const auth_service_1 = require("./services/auth.service");
const audit_service_1 = require("./services/audit.service");
const email_service_1 = require("./services/email.service");
const health_monitor_service_1 = require("./services/health-monitor.service");
const backup_service_1 = require("./services/backup.service");
const storage_service_1 = require("./services/storage.service");
const auth_controller_1 = require("./controllers/auth.controller");
const backup_controller_1 = require("./controllers/backup.controller");
const jwt_strategy_1 = require("./strategies/jwt.strategy");
const tenant_entity_1 = require("./entities/tenant.entity");
const tenant_user_entity_1 = require("./entities/tenant-user.entity");
const tenant_analytics_entity_1 = require("./entities/tenant-analytics.entity");
const admin_user_entity_1 = require("./entities/admin-user.entity");
const audit_log_entity_1 = require("./entities/audit-log.entity");
let TenantModule = class TenantModule {
};
exports.TenantModule = TenantModule;
exports.TenantModule = TenantModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot(),
            schedule_1.ScheduleModule.forRoot(),
            jwt_1.JwtModule.register({
                secret: process.env.JWT_SECRET || 'medicore-super-secret-key',
                signOptions: { expiresIn: '24h' },
            }),
            typeorm_1.TypeOrmModule.forRoot({
                type: 'postgres',
                url: process.env.DATABASE_URL,
                entities: [tenant_entity_1.Tenant, tenant_user_entity_1.TenantUser, tenant_analytics_entity_1.TenantAnalytics, admin_user_entity_1.AdminUser, audit_log_entity_1.AuditLog],
                synchronize: false,
            }),
            typeorm_1.TypeOrmModule.forFeature([tenant_entity_1.Tenant, tenant_user_entity_1.TenantUser, tenant_analytics_entity_1.TenantAnalytics, admin_user_entity_1.AdminUser, audit_log_entity_1.AuditLog]),
        ],
        controllers: [tenant_controller_1.TenantController, tenant_user_controller_1.TenantUserController, tenant_analytics_controller_1.TenantAnalyticsController, auth_controller_1.AuthController, admin_maintenance_controller_1.AdminMaintenanceController, backup_controller_1.BackupController],
        providers: [
            tenant_service_1.TenantService,
            tenant_analytics_service_1.TenantAnalyticsService,
            database_provisioning_service_1.DatabaseProvisioningService,
            tenant_database_service_1.TenantDatabaseService,
            auth_service_1.AuthService,
            audit_service_1.AuditService,
            email_service_1.EmailService,
            health_monitor_service_1.HealthMonitorService,
            backup_service_1.BackupService,
            storage_service_1.StorageService,
            jwt_strategy_1.JwtStrategy
        ],
        exports: [tenant_service_1.TenantService, tenant_analytics_service_1.TenantAnalyticsService, tenant_database_service_1.TenantDatabaseService, auth_service_1.AuthService],
    })
], TenantModule);
//# sourceMappingURL=tenant.module.js.map