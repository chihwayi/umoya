import { DataSource } from 'typeorm';
interface ProvisioningBundleManifest {
    id: string;
    label: string;
    version: string;
    description?: string;
}
interface ApplySchemaOptions {
    bundles?: string[];
    appliedBy?: string;
}
export declare class DatabaseProvisioningService {
    private dataSource;
    private readonly logger;
    constructor(dataSource: DataSource);
    private emitProvisioningEvent;
    getProvisioningBundlesManifest(): ProvisioningBundleManifest[];
    private normalizeStatements;
    private ensureSchemaVersionTable;
    private hasBundleVersion;
    private recordBundleVersion;
    private ensureUpdatedAtTriggerFunction;
    private enforceUserRoleConstraint;
    private getProvisioningBundles;
    getCoreSchemaStatements(): string[];
    createDatabase(databaseName: string): Promise<string>;
    private generateConnectionString;
    applyClinicSchema(connectionString: string, options?: ApplySchemaOptions): Promise<void>;
    private getClinicSchema;
    private getIcd10MappingStatements;
    private getTriggerStatements;
    private getSnomedUpgradeStatements;
    private getHivTestingUpgradeStatements;
    private applySnomedUpgrades;
    applySnomedUpgradesToTenant(databaseName: string): Promise<void>;
    private applyHivTestingUpgrades;
    applyHivTestingUpgradesToTenant(databaseName: string): Promise<void>;
    private seedLookupTables;
    private seedDefaultUsers;
    private seedLabCatalog;
    private seedImagingCatalog;
    deleteDatabase(databaseName: string): Promise<void>;
}
export {};
