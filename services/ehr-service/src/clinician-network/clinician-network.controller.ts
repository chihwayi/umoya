import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ClinicianIdentityService } from './clinician-identity.service';
import { ClinicianNetworkService, TopicSort } from './clinician-network.service';
import { CreateTopicDto } from './dto/create-topic.dto';

// S287 — Clinician Network discussion UI backend. Routes under
// clinician-network/*, guarded by JwtAuthGuard (same pattern as
// health-education.controller.ts). All topic/reply responses are anonymized
// views: no author_clinician_id anywhere, isOwnPost computed server-side.
@Controller('clinician-network')
@UseGuards(JwtAuthGuard)
export class ClinicianNetworkController {
  constructor(
    private readonly network: ClinicianNetworkService,
    private readonly identities: ClinicianIdentityService,
  ) {}

  private async viewerClinicianId(req): Promise<string | null> {
    try {
      return await this.identities.findClinicianIdForUser(req.tenantDb, req.user.sub);
    } catch {
      return null;
    }
  }

  @Get('me')
  getMe(@Req() req) {
    return this.network.getMe(req.tenantDb, req.user.sub);
  }

  @Get('panels')
  async listPanels(@Req() req) {
    const viewerId = await this.viewerClinicianId(req);
    return this.network.listPanels(viewerId);
  }

  @Post('panels/:id/join')
  joinPanel(@Param('id') id: string, @Body() body: { inviteToken?: string }, @Req() req) {
    return this.network.joinPanel(req.tenantDb, req.user.sub, id, body?.inviteToken);
  }

  @Get('panels/:id/topics')
  async listTopics(
    @Param('id') id: string,
    @Query('sort') sort: string,
    @Req() req,
  ) {
    const viewerId = await this.viewerClinicianId(req);
    const normalized: TopicSort =
      sort === 'discussed' || sort === 'unresolved' ? sort : 'recent';
    return this.network.listTopics(id, viewerId, normalized);
  }

  @Post('topics')
  async createTopic(
    @Body() dto: CreateTopicDto & { forcePost?: boolean },
    @Req() req,
  ) {
    const { forcePost, ...topicDto } = dto;
    const result = await this.network.createTopic(
      req.tenantDb,
      req.user.sub,
      topicDto,
      forcePost === true,
    );
    if (!result.created) {
      return result;
    }
    // Re-read as an anonymized view (isOwnPost: true for the author).
    const viewerId = await this.viewerClinicianId(req);
    const topic = await this.network.getTopic(result.topic.id, viewerId);
    return { created: true as const, topic };
  }

  @Get('topics/:id')
  async getTopic(@Param('id') id: string, @Req() req) {
    const viewerId = await this.viewerClinicianId(req);
    return this.network.getTopic(id, viewerId);
  }

  @Get('topics/:id/replies')
  async listReplies(@Param('id') id: string, @Req() req) {
    const viewerId = await this.viewerClinicianId(req);
    return this.network.listReplies(id, viewerId);
  }

  @Post('topics/:id/replies')
  async createReply(
    @Param('id') id: string,
    @Body() body: { body?: string; parentReplyId?: string | null },
    @Req() req,
  ) {
    const reply = await this.network.createReply(req.tenantDb, req.user.sub, {
      topicId: id,
      parentReplyId: body?.parentReplyId ?? null,
      body: body?.body ?? '',
    });
    // ReplyRow carries no author identity; decorate for the composer UI.
    const me = await this.network.getMe(req.tenantDb, req.user.sub);
    return {
      ...reply,
      authorHandle: me.displayHandle,
      isOwnPost: true,
    };
  }

  @Post('topics/:id/resolve')
  resolveTopic(
    @Param('id') id: string,
    @Body() body: { resolvedReplyId?: string | null },
    @Req() req,
  ) {
    return this.network.resolveTopic(req.tenantDb, req.user.sub, id, body?.resolvedReplyId ?? null);
  }
}
