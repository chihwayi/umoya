import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CreateDemoAccessRequestDto } from '../dto/create-demo-access-request.dto';
import { UpdateDemoAccessRequestDto } from '../dto/update-demo-access-request.dto';
import { DemoAccessRequestService } from '../services/demo-access-request.service';

@ApiTags('demo access requests')
@Controller('demo-access-requests')
export class DemoAccessRequestController {
  constructor(private readonly demoAccessRequestService: DemoAccessRequestService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a public request for guided Umoya test access' })
  @ApiResponse({ status: 201, description: 'Demo access request submitted successfully' })
  async createRequest(@Body(ValidationPipe) body: CreateDemoAccessRequestDto) {
    const request = await this.demoAccessRequestService.createRequest(body);
    return {
      message: 'Request received. We will review it and prepare a guided test environment.',
      request,
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiQuery({ name: 'status', required: false, enum: ['new', 'reviewing', 'approved', 'provisioned', 'rejected'] })
  @ApiOperation({ summary: 'List demo access requests for super admin review' })
  async listRequests(@Query('status') status?: 'new' | 'reviewing' | 'approved' | 'provisioned' | 'rejected') {
    return this.demoAccessRequestService.listRequests(status);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update demo access request review status and provisioning notes' })
  async updateRequest(
    @Param('id') id: string,
    @Body(ValidationPipe) body: UpdateDemoAccessRequestDto,
  ) {
    return this.demoAccessRequestService.updateRequest(id, body);
  }

  @Post(':id/provision-tenant')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Provision a testing tenant directly from an approved demo access request' })
  async provisionTenant(@Param('id') id: string) {
    return this.demoAccessRequestService.provisionTestingTenant(id);
  }
}
