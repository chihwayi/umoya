import { Controller, Post, Body, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Push Tokens')
@Controller('push-tokens')
export class PushTokensController {
  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register or refresh a push notification token for the current user' })
  async upsertToken(
    @Request() req: RequestWithTenant,
    @Body() body: { token: string },
  ) {
    const userId = (req.user as any)?.id;
    await req.tenantDb.query(
      `INSERT INTO push_tokens (user_id, token, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (user_id, token)
       DO UPDATE SET updated_at = now()`,
      [userId, body.token],
    );
    return { saved: true };
  }
}
