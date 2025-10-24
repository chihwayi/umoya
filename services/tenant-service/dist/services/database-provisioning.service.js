"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var DatabaseProvisioningService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseProvisioningService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const fs = require("fs");
const path = require("path");
let DatabaseProvisioningService = DatabaseProvisioningService_1 = class DatabaseProvisioningService {
    constructor(dataSource) {
        this.dataSource = dataSource;
        this.logger = new common_1.Logger(DatabaseProvisioningService_1.name);
    }
    async createDatabase(databaseName) {
        try {
            this.logger.log(`Creating database: ${databaseName}`);
            await this.dataSource.query(`CREATE DATABASE "${databaseName}"`);
            const connectionString = this.generateConnectionString(databaseName);
            await this.runSchemaMigration(connectionString);
            this.logger.log(`Database ${databaseName} created successfully`);
            return connectionString;
        }
        catch (error) {
            this.logger.error(`Failed to create database ${databaseName}:`, error);
            throw error;
        }
    }
    generateConnectionString(databaseName) {
        const host = process.env.DB_HOST || 'localhost';
        const port = process.env.DB_PORT || '5432';
        const username = process.env.DB_USERNAME || 'medicore';
        const password = process.env.DB_PASSWORD || 'medicore_password';
        return `postgresql://${username}:${password}@${host}:${port}/${databaseName}`;
    }
    async runSchemaMigration(connectionString) {
        const tenantDataSource = new typeorm_1.DataSource({
            type: 'postgres',
            url: connectionString,
        });
        try {
            await tenantDataSource.initialize();
            const schemaPath = path.join(__dirname, '../../../database/schemas/clinic-template.sql');
            const schema = fs.readFileSync(schemaPath, 'utf8');
            const statements = schema.split(';').filter(stmt => stmt.trim());
            for (const statement of statements) {
                if (statement.trim()) {
                    await tenantDataSource.query(statement);
                }
            }
            this.logger.log('Schema migration completed');
        }
        finally {
            await tenantDataSource.destroy();
        }
    }
    async deleteDatabase(databaseName) {
        try {
            await this.dataSource.query(`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = '${databaseName}' AND pid <> pg_backend_pid()
      `);
            await this.dataSource.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
            this.logger.log(`Database ${databaseName} deleted successfully`);
        }
        catch (error) {
            this.logger.error(`Failed to delete database ${databaseName}:`, error);
            throw error;
        }
    }
};
exports.DatabaseProvisioningService = DatabaseProvisioningService;
exports.DatabaseProvisioningService = DatabaseProvisioningService = DatabaseProvisioningService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], DatabaseProvisioningService);
//# sourceMappingURL=database-provisioning.service.js.map