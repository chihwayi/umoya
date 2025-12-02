import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { DocumentService } from '../services/document.service';

@ApiTags('Documents')
@Controller('documents')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  // ==================== DOCUMENT MANAGEMENT ====================

  @Post('upload')
  @ApiOperation({ summary: 'Upload a document' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Document uploaded successfully' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Body() body: { patientId: string; documentType: string; documentName: string; description?: string },
    @UploadedFile() file: Express.Multer.File,
    @Req() req: RequestWithTenant & { user: any },
  ) {
    // TODO: Implement actual file storage
    const documentData = {
      documentType: body.documentType,
      documentName: body.documentName || file.originalname,
      filePath: `/uploads/${file.filename}`, // Placeholder
      fileUrl: null,
      fileSize: file.size,
      mimeType: file.mimetype,
      description: body.description,
    };

    return this.documentService.uploadDocument(body.patientId, documentData, req.user.sub, req.tenantDb);
  }

  @Get()
  @ApiOperation({ summary: 'Get documents for a patient' })
  @ApiQuery({ name: 'patientId', required: true })
  @ApiQuery({ name: 'documentType', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'tag', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'Documents retrieved successfully' })
  async getDocuments(@Query() filters: any, @Req() req: RequestWithTenant) {
    return this.documentService.getDocuments(filters.patientId, filters, req.tenantDb);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search documents' })
  @ApiQuery({ name: 'query', required: true })
  @ApiQuery({ name: 'patientId', required: false })
  @ApiQuery({ name: 'documentType', required: false })
  @ApiResponse({ status: 200, description: 'Search results retrieved' })
  async searchDocuments(@Query() params: any, @Req() req: RequestWithTenant) {
    return this.documentService.searchDocuments(params.query, params, req.tenantDb);
  }

  @Get('tags')
  @ApiOperation({ summary: 'Get all document tags' })
  @ApiResponse({ status: 200, description: 'Tags retrieved successfully' })
  async getAllTags(@Req() req: RequestWithTenant) {
    return this.documentService.getAllTags(req.tenantDb);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get document by ID' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({ status: 200, description: 'Document retrieved successfully' })
  async getDocumentById(@Param('id') id: string, @Req() req: RequestWithTenant & { user: any }) {
    return this.documentService.getDocumentById(id, req.user.sub, req.tenantDb);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update document metadata' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({ status: 200, description: 'Document updated successfully' })
  async updateDocument(
    @Param('id') id: string,
    @Body() updates: any,
    @Req() req: RequestWithTenant & { user: any },
  ) {
    return this.documentService.updateDocument(id, updates, req.user.sub, req.tenantDb);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a document' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({ status: 200, description: 'Document deleted successfully' })
  async deleteDocument(@Param('id') id: string, @Req() req: RequestWithTenant & { user: any }) {
    return this.documentService.deleteDocument(id, req.user.sub, req.tenantDb);
  }

  // ==================== VERSIONS ====================

  @Get(':id/versions')
  @ApiOperation({ summary: 'Get document version history' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({ status: 200, description: 'Versions retrieved successfully' })
  async getDocumentVersions(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.documentService.getDocumentVersions(id, req.tenantDb);
  }

  @Post(':id/versions')
  @ApiOperation({ summary: 'Upload new version' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'New version uploaded successfully' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadNewVersion(
    @Param('id') id: string,
    @Body() body: { changeSummary: string },
    @UploadedFile() file: Express.Multer.File,
    @Req() req: RequestWithTenant & { user: any },
  ) {
    const fileData = {
      filePath: `/uploads/${file.filename}`,
      fileUrl: null,
      fileSize: file.size,
      mimeType: file.mimetype,
    };

    return this.documentService.uploadNewVersion(id, fileData, body.changeSummary, req.user.sub, req.tenantDb);
  }

  @Post(':id/versions/:versionId/restore')
  @ApiOperation({ summary: 'Restore to a previous version' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiParam({ name: 'versionId', description: 'Version ID' })
  @ApiResponse({ status: 200, description: 'Version restored successfully' })
  async restoreVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @Req() req: RequestWithTenant & { user: any },
  ) {
    return this.documentService.restoreVersion(id, versionId, req.user.sub, req.tenantDb);
  }

  // ==================== SHARING ====================

  @Post(':id/share')
  @ApiOperation({ summary: 'Share a document' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({ status: 201, description: 'Document shared successfully' })
  async shareDocument(
    @Param('id') id: string,
    @Body() shareData: any,
    @Req() req: RequestWithTenant & { user: any },
  ) {
    return this.documentService.shareDocument(id, shareData, req.user.sub, req.tenantDb);
  }

  @Get('shared/with-me')
  @ApiOperation({ summary: 'Get documents shared with me' })
  @ApiResponse({ status: 200, description: 'Shared documents retrieved' })
  async getSharedDocuments(@Req() req: RequestWithTenant & { user: any }) {
    return this.documentService.getSharedDocuments(req.user.sub, req.user.role, req.tenantDb);
  }

  @Delete('sharing/:sharingId')
  @ApiOperation({ summary: 'Revoke document sharing' })
  @ApiParam({ name: 'sharingId', description: 'Sharing ID' })
  @ApiResponse({ status: 200, description: 'Sharing revoked successfully' })
  async revokeSharing(@Param('sharingId') sharingId: string, @Req() req: RequestWithTenant) {
    return this.documentService.revokeSharing(sharingId, req.tenantDb);
  }

  // ==================== SIGNATURES ====================

  @Post(':id/sign')
  @ApiOperation({ summary: 'Sign a document' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({ status: 201, description: 'Document signed successfully' })
  async signDocument(
    @Param('id') id: string,
    @Body() signatureData: any,
    @Req() req: RequestWithTenant & { user: any },
  ) {
    const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || null;
    return this.documentService.signDocument(id, signatureData, req.user.sub, ipAddress, req.tenantDb);
  }

  @Get(':id/signatures')
  @ApiOperation({ summary: 'Get document signatures' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({ status: 200, description: 'Signatures retrieved successfully' })
  async getDocumentSignatures(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.documentService.getDocumentSignatures(id, req.tenantDb);
  }

  // ==================== TAGS ====================

  @Post(':id/tags')
  @ApiOperation({ summary: 'Add a tag to document' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({ status: 201, description: 'Tag added successfully' })
  async addTag(
    @Param('id') id: string,
    @Body() body: { tagName: string },
    @Req() req: RequestWithTenant & { user: any },
  ) {
    return this.documentService.addTag(id, body.tagName, req.user.sub, req.tenantDb);
  }

  @Delete(':id/tags/:tagName')
  @ApiOperation({ summary: 'Remove a tag from document' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiParam({ name: 'tagName', description: 'Tag name' })
  @ApiResponse({ status: 200, description: 'Tag removed successfully' })
  async removeTag(@Param('id') id: string, @Param('tagName') tagName: string, @Req() req: RequestWithTenant) {
    return this.documentService.removeTag(id, tagName, req.tenantDb);
  }

  // ==================== ACCESS LOG ====================

  @Get(':id/access-log')
  @ApiOperation({ summary: 'Get document access log' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({ status: 200, description: 'Access log retrieved successfully' })
  async getDocumentAccessLog(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.documentService.getDocumentAccessLog(id, req.tenantDb);
  }

  // ==================== ANALYTICS ====================

  @Get('stats/:patientId')
  @ApiOperation({ summary: 'Get document statistics for patient' })
  @ApiParam({ name: 'patientId', description: 'Patient ID' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getDocumentStats(@Param('patientId') patientId: string, @Req() req: RequestWithTenant) {
    return this.documentService.getDocumentStats(patientId, req.tenantDb);
  }
}


  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { DocumentService } from '../services/document.service';

@ApiTags('Documents')
@Controller('documents')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  // ==================== DOCUMENT MANAGEMENT ====================

  @Post('upload')
  @ApiOperation({ summary: 'Upload a document' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Document uploaded successfully' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Body() body: { patientId: string; documentType: string; documentName: string; description?: string },
    @UploadedFile() file: Express.Multer.File,
    @Req() req: RequestWithTenant & { user: any },
  ) {
    // TODO: Implement actual file storage
    const documentData = {
      documentType: body.documentType,
      documentName: body.documentName || file.originalname,
      filePath: `/uploads/${file.filename}`, // Placeholder
      fileUrl: null,
      fileSize: file.size,
      mimeType: file.mimetype,
      description: body.description,
    };

    return this.documentService.uploadDocument(body.patientId, documentData, req.user.sub, req.tenantDb);
  }

  @Get()
  @ApiOperation({ summary: 'Get documents for a patient' })
  @ApiQuery({ name: 'patientId', required: true })
  @ApiQuery({ name: 'documentType', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'tag', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'Documents retrieved successfully' })
  async getDocuments(@Query() filters: any, @Req() req: RequestWithTenant) {
    return this.documentService.getDocuments(filters.patientId, filters, req.tenantDb);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search documents' })
  @ApiQuery({ name: 'query', required: true })
  @ApiQuery({ name: 'patientId', required: false })
  @ApiQuery({ name: 'documentType', required: false })
  @ApiResponse({ status: 200, description: 'Search results retrieved' })
  async searchDocuments(@Query() params: any, @Req() req: RequestWithTenant) {
    return this.documentService.searchDocuments(params.query, params, req.tenantDb);
  }

  @Get('tags')
  @ApiOperation({ summary: 'Get all document tags' })
  @ApiResponse({ status: 200, description: 'Tags retrieved successfully' })
  async getAllTags(@Req() req: RequestWithTenant) {
    return this.documentService.getAllTags(req.tenantDb);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get document by ID' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({ status: 200, description: 'Document retrieved successfully' })
  async getDocumentById(@Param('id') id: string, @Req() req: RequestWithTenant & { user: any }) {
    return this.documentService.getDocumentById(id, req.user.sub, req.tenantDb);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update document metadata' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({ status: 200, description: 'Document updated successfully' })
  async updateDocument(
    @Param('id') id: string,
    @Body() updates: any,
    @Req() req: RequestWithTenant & { user: any },
  ) {
    return this.documentService.updateDocument(id, updates, req.user.sub, req.tenantDb);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a document' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({ status: 200, description: 'Document deleted successfully' })
  async deleteDocument(@Param('id') id: string, @Req() req: RequestWithTenant & { user: any }) {
    return this.documentService.deleteDocument(id, req.user.sub, req.tenantDb);
  }

  // ==================== VERSIONS ====================

  @Get(':id/versions')
  @ApiOperation({ summary: 'Get document version history' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({ status: 200, description: 'Versions retrieved successfully' })
  async getDocumentVersions(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.documentService.getDocumentVersions(id, req.tenantDb);
  }

  @Post(':id/versions')
  @ApiOperation({ summary: 'Upload new version' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'New version uploaded successfully' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadNewVersion(
    @Param('id') id: string,
    @Body() body: { changeSummary: string },
    @UploadedFile() file: Express.Multer.File,
    @Req() req: RequestWithTenant & { user: any },
  ) {
    const fileData = {
      filePath: `/uploads/${file.filename}`,
      fileUrl: null,
      fileSize: file.size,
      mimeType: file.mimetype,
    };

    return this.documentService.uploadNewVersion(id, fileData, body.changeSummary, req.user.sub, req.tenantDb);
  }

  @Post(':id/versions/:versionId/restore')
  @ApiOperation({ summary: 'Restore to a previous version' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiParam({ name: 'versionId', description: 'Version ID' })
  @ApiResponse({ status: 200, description: 'Version restored successfully' })
  async restoreVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @Req() req: RequestWithTenant & { user: any },
  ) {
    return this.documentService.restoreVersion(id, versionId, req.user.sub, req.tenantDb);
  }

  // ==================== SHARING ====================

  @Post(':id/share')
  @ApiOperation({ summary: 'Share a document' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({ status: 201, description: 'Document shared successfully' })
  async shareDocument(
    @Param('id') id: string,
    @Body() shareData: any,
    @Req() req: RequestWithTenant & { user: any },
  ) {
    return this.documentService.shareDocument(id, shareData, req.user.sub, req.tenantDb);
  }

  @Get('shared/with-me')
  @ApiOperation({ summary: 'Get documents shared with me' })
  @ApiResponse({ status: 200, description: 'Shared documents retrieved' })
  async getSharedDocuments(@Req() req: RequestWithTenant & { user: any }) {
    return this.documentService.getSharedDocuments(req.user.sub, req.user.role, req.tenantDb);
  }

  @Delete('sharing/:sharingId')
  @ApiOperation({ summary: 'Revoke document sharing' })
  @ApiParam({ name: 'sharingId', description: 'Sharing ID' })
  @ApiResponse({ status: 200, description: 'Sharing revoked successfully' })
  async revokeSharing(@Param('sharingId') sharingId: string, @Req() req: RequestWithTenant) {
    return this.documentService.revokeSharing(sharingId, req.tenantDb);
  }

  // ==================== SIGNATURES ====================

  @Post(':id/sign')
  @ApiOperation({ summary: 'Sign a document' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({ status: 201, description: 'Document signed successfully' })
  async signDocument(
    @Param('id') id: string,
    @Body() signatureData: any,
    @Req() req: RequestWithTenant & { user: any },
  ) {
    const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || null;
    return this.documentService.signDocument(id, signatureData, req.user.sub, ipAddress, req.tenantDb);
  }

  @Get(':id/signatures')
  @ApiOperation({ summary: 'Get document signatures' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({ status: 200, description: 'Signatures retrieved successfully' })
  async getDocumentSignatures(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.documentService.getDocumentSignatures(id, req.tenantDb);
  }

  // ==================== TAGS ====================

  @Post(':id/tags')
  @ApiOperation({ summary: 'Add a tag to document' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({ status: 201, description: 'Tag added successfully' })
  async addTag(
    @Param('id') id: string,
    @Body() body: { tagName: string },
    @Req() req: RequestWithTenant & { user: any },
  ) {
    return this.documentService.addTag(id, body.tagName, req.user.sub, req.tenantDb);
  }

  @Delete(':id/tags/:tagName')
  @ApiOperation({ summary: 'Remove a tag from document' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiParam({ name: 'tagName', description: 'Tag name' })
  @ApiResponse({ status: 200, description: 'Tag removed successfully' })
  async removeTag(@Param('id') id: string, @Param('tagName') tagName: string, @Req() req: RequestWithTenant) {
    return this.documentService.removeTag(id, tagName, req.tenantDb);
  }

  // ==================== ACCESS LOG ====================

  @Get(':id/access-log')
  @ApiOperation({ summary: 'Get document access log' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({ status: 200, description: 'Access log retrieved successfully' })
  async getDocumentAccessLog(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.documentService.getDocumentAccessLog(id, req.tenantDb);
  }

  // ==================== ANALYTICS ====================

  @Get('stats/:patientId')
  @ApiOperation({ summary: 'Get document statistics for patient' })
  @ApiParam({ name: 'patientId', description: 'Patient ID' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getDocumentStats(@Param('patientId') patientId: string, @Req() req: RequestWithTenant) {
    return this.documentService.getDocumentStats(patientId, req.tenantDb);
  }
}

