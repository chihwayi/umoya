import { DataSource } from 'typeorm';
export declare class DatabaseProvisioningService {
    private dataSource;
    private readonly logger;
    constructor(dataSource: DataSource);
    createDatabase(databaseName: string): Promise<string>;
    private generateConnectionString;
    private runSchemaMigration;
    deleteDatabase(databaseName: string): Promise<void>;
}
