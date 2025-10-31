import { DataSource } from 'typeorm';
export declare class DatabaseProvisioningService {
    private dataSource;
    private readonly logger;
    constructor(dataSource: DataSource);
    createDatabase(databaseName: string): Promise<string>;
    private generateConnectionString;
    applyClinicSchema(connectionString: string): Promise<void>;
    private getClinicSchema;
    private getTriggerStatements;
    deleteDatabase(databaseName: string): Promise<void>;
}
