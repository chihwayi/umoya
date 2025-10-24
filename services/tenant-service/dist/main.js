"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const tenant_module_1 = require("./tenant.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(tenant_module_1.TenantModule);
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    app.enableCors();
    const port = process.env.PORT || 3001;
    await app.listen(port);
    console.log(`🏥 MediCore Tenant Service running on port ${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map