import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  Request,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { TenantService } from '../services/tenant.service';
import { ProviderMessagingService } from '../services/provider-messaging.service';
import { MessageTemplateService } from '../services/message-template.service';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class ProviderMessagingController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly messagingService: ProviderMessagingService,
    private readonly templateService: MessageTemplateService,
  ) {}

  // Send Message
  @Post()
  async sendMessage(
    @Body() messageData: any,
    @Headers('x-tenant-id') tenantSlug: string,
    @Request() req: any,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantSlug);
    messageData.sender_id = req.user.userId;
    return this.messagingService.sendMessage(messageData, tenantDb);
  }

  // Get Inbox
  @Get('inbox')
  async getInbox(
    @Query() filters: any,
    @Headers('x-tenant-id') tenantSlug: string,
    @Request() req: any,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantSlug);
    return this.messagingService.getInbox(req.user.userId, filters, tenantDb);
  }

  // Get Sent Messages
  @Get('sent')
  async getSentMessages(
    @Query() filters: any,
    @Headers('x-tenant-id') tenantSlug: string,
    @Request() req: any,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantSlug);
    return this.messagingService.getSentMessages(req.user.userId, filters, tenantDb);
  }

  // Get Unread Count
  @Get('unread-count')
  async getUnreadCount(
    @Headers('x-tenant-id') tenantSlug: string,
    @Request() req: any,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantSlug);
    const count = await this.messagingService.getUnreadCount(req.user.userId, tenantDb);
    return { count };
  }

  // Search Messages
  @Get('search')
  async searchMessages(
    @Query('q') query: string,
    @Headers('x-tenant-id') tenantSlug: string,
    @Request() req: any,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantSlug);
    return this.messagingService.searchMessages(req.user.userId, query, tenantDb);
  }

  // Get Message Threads
  @Get('threads')
  async getThreads(
    @Headers('x-tenant-id') tenantSlug: string,
    @Request() req: any,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantSlug);
    const threads = await tenantDb.query(
      `SELECT t.*, 
              (SELECT COUNT(*) FROM provider_messages WHERE thread_id = t.id AND status != 'deleted') as message_count,
              (SELECT COUNT(*) FROM provider_messages WHERE thread_id = t.id AND status IN ('sent', 'delivered') AND read_at IS NULL AND recipient_id = $1) as unread_count
       FROM message_threads t
       WHERE t.participants @> $2::jsonb AND t.is_archived = false
       ORDER BY t.last_message_at DESC NULLS LAST`,
      [req.user.userId, JSON.stringify([req.user.userId])]
    );
    return threads;
  }

  // Get Thread Messages
  @Get('threads/:id')
  async getThreadMessages(
    @Param('id') threadId: string,
    @Headers('x-tenant-id') tenantSlug: string,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantSlug);
    return this.messagingService.getMessageThread(threadId, tenantDb);
  }

  // Create Thread
  @Post('threads')
  async createThread(
    @Body() threadData: any,
    @Headers('x-tenant-id') tenantSlug: string,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantSlug);
    return this.messagingService.createThread(threadData, tenantDb);
  }

  // Archive Thread
  @Post('threads/:id/archive')
  async archiveThread(
    @Param('id') threadId: string,
    @Headers('x-tenant-id') tenantSlug: string,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantSlug);
    await tenantDb.query(
      `UPDATE message_threads SET is_archived = true, updated_at = NOW() WHERE id = $1`,
      [threadId]
    );
    return { message: 'Thread archived successfully' };
  }

  // Get Message Details
  @Get(':id')
  async getMessage(
    @Param('id') messageId: string,
    @Headers('x-tenant-id') tenantSlug: string,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantSlug);
    return this.messagingService.getMessageById(messageId, tenantDb);
  }

  // Reply to Message
  @Post(':id/reply')
  async replyToMessage(
    @Param('id') messageId: string,
    @Body() replyData: any,
    @Headers('x-tenant-id') tenantSlug: string,
    @Request() req: any,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantSlug);
    replyData.sender_id = req.user.userId;
    return this.messagingService.replyToMessage(messageId, replyData, tenantDb);
  }

  // Forward Message
  @Post(':id/forward')
  async forwardMessage(
    @Param('id') messageId: string,
    @Body() forwardData: any,
    @Headers('x-tenant-id') tenantSlug: string,
    @Request() req: any,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantSlug);
    forwardData.sender_id = req.user.userId;
    return this.messagingService.forwardMessage(messageId, forwardData, tenantDb);
  }

  // Mark as Read
  @Put(':id/read')
  async markAsRead(
    @Param('id') messageId: string,
    @Headers('x-tenant-id') tenantSlug: string,
    @Request() req: any,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantSlug);
    await this.messagingService.markAsRead(messageId, req.user.userId, tenantDb);
    return { message: 'Message marked as read' };
  }

  // Mark as Unread
  @Put(':id/unread')
  async markAsUnread(
    @Param('id') messageId: string,
    @Headers('x-tenant-id') tenantSlug: string,
    @Request() req: any,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantSlug);
    await this.messagingService.markAsUnread(messageId, req.user.userId, tenantDb);
    return { message: 'Message marked as unread' };
  }

  // Archive Message
  @Post(':id/archive')
  async archiveMessage(
    @Param('id') messageId: string,
    @Headers('x-tenant-id') tenantSlug: string,
    @Request() req: any,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantSlug);
    await this.messagingService.archiveMessage(messageId, req.user.userId, tenantDb);
    return { message: 'Message archived successfully' };
  }

  // Delete Message
  @Delete(':id')
  async deleteMessage(
    @Param('id') messageId: string,
    @Headers('x-tenant-id') tenantSlug: string,
    @Request() req: any,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantSlug);
    await this.messagingService.deleteMessage(messageId, req.user.userId, tenantDb);
    return { message: 'Message deleted successfully' };
  }

  // Add Attachment
  @Post(':id/attachments')
  @UseInterceptors(FileInterceptor('file'))
  async addAttachment(
    @Param('id') messageId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() metadata: any,
    @Headers('x-tenant-id') tenantSlug: string,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantSlug);
    
    const attachmentData = {
      file_name: file.originalname,
      file_path: file.path,
      file_size: file.size,
      mime_type: file.mimetype,
      ...metadata,
    };

    return this.messagingService.addAttachment(messageId, attachmentData, tenantDb);
  }

  // Get Attachments
  @Get(':id/attachments')
  async getAttachments(
    @Param('id') messageId: string,
    @Headers('x-tenant-id') tenantSlug: string,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantSlug);
    const attachments = await tenantDb.query(
      `SELECT * FROM message_attachments WHERE message_id = $1`,
      [messageId]
    );
    return attachments;
  }

  // Delete Attachment
  @Delete(':id/attachments/:attachmentId')
  async deleteAttachment(
    @Param('id') messageId: string,
    @Param('attachmentId') attachmentId: string,
    @Headers('x-tenant-id') tenantSlug: string,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantSlug);
    await tenantDb.query(
      `DELETE FROM message_attachments WHERE id = $1 AND message_id = $2`,
      [attachmentId, messageId]
    );
    return { message: 'Attachment deleted successfully' };
  }

  // Create Task from Message
  @Post(':id/tasks')
  async createTask(
    @Param('id') messageId: string,
    @Body() taskData: any,
    @Headers('x-tenant-id') tenantSlug: string,
    @Request() req: any,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantSlug);
    taskData.assigned_by = req.user.userId;
    return this.messagingService.createTaskFromMessage(messageId, taskData, tenantDb);
  }

  // Get Tasks from Message
  @Get(':id/tasks')
  async getTasks(
    @Param('id') messageId: string,
    @Headers('x-tenant-id') tenantSlug: string,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantSlug);
    return this.messagingService.getMessageTasks(messageId, tenantDb);
  }

  // Update Task
  @Put('tasks/:taskId')
  async updateTask(
    @Param('taskId') taskId: string,
    @Body() updates: any,
    @Headers('x-tenant-id') tenantSlug: string,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantSlug);
    return this.messagingService.updateTask(taskId, updates, tenantDb);
  }

  // Complete Task
  @Post('tasks/:taskId/complete')
  async completeTask(
    @Param('taskId') taskId: string,
    @Body() completionData: any,
    @Headers('x-tenant-id') tenantSlug: string,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantSlug);
    return this.messagingService.updateTask(
      taskId,
      { status: 'completed', completion_notes: completionData.completion_notes },
      tenantDb
    );
  }

  // Get Templates
  @Get('templates/list')
  async getTemplates(
    @Query('category') category: string,
    @Headers('x-tenant-id') tenantSlug: string,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantSlug);
    return this.templateService.getTemplates(category, tenantDb);
  }

  // Get Template Details
  @Get('templates/:id')
  async getTemplate(
    @Param('id') templateId: string,
    @Headers('x-tenant-id') tenantSlug: string,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantSlug);
    return this.templateService.getTemplateById(templateId, tenantDb);
  }

  // Create Template
  @Post('templates')
  async createTemplate(
    @Body() templateData: any,
    @Headers('x-tenant-id') tenantSlug: string,
    @Request() req: any,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantSlug);
    templateData.created_by = req.user.userId;
    return this.templateService.createTemplate(templateData, tenantDb);
  }

  // Update Template
  @Put('templates/:id')
  async updateTemplate(
    @Param('id') templateId: string,
    @Body() updates: any,
    @Headers('x-tenant-id') tenantSlug: string,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantSlug);
    return this.templateService.updateTemplate(templateId, updates, tenantDb);
  }

  // Delete Template
  @Delete('templates/:id')
  async deleteTemplate(
    @Param('id') templateId: string,
    @Headers('x-tenant-id') tenantSlug: string,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantSlug);
    await this.templateService.deleteTemplate(templateId, tenantDb);
    return { message: 'Template deleted successfully' };
  }

  // Apply Template
  @Post('templates/:id/apply')
  async applyTemplate(
    @Param('id') templateId: string,
    @Body() variables: any,
    @Headers('x-tenant-id') tenantSlug: string,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantSlug);
    return this.templateService.applyTemplate(templateId, variables, tenantDb);
  }
}


