import {
  Controller, Get, Param, Res, UseGuards, Request,
  Post, Body, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { DicomSeries } from '../entities/dicom-series.entity';
import { CdssService } from '../services/cdss.service';
import { ImagingService } from '../services/imaging.service';
import { TenantService } from '../services/tenant.service';

@Controller('imaging')
@UseGuards(JwtAuthGuard)
export class DicomController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
    private readonly imagingService: ImagingService,
  ) {}

  /**
   * GET /imaging/:orderId/dicom-series
   * List all DICOM series for an imaging order.
   */
  @Get(':orderId/dicom-series')
  async getSeriesForOrder(
    @Param('orderId') orderId: string,
    @Request() req: any,
  ) {
    const tenantId = req.headers['x-tenant-id'];
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) return { series: [] };

    const seriesRepo = tenantDb.getRepository(DicomSeries);
    const series = await seriesRepo.find({
      where: { imagingOrderId: orderId },
      order: { uploadedAt: 'ASC' },
    });
    return { series };
  }

  /**
   * GET /imaging/:orderId/ai-review
   * Return AI draft + heatmap regions for viewer overlay.
   */
  @Get(':orderId/ai-review')
  async getAiReview(
    @Param('orderId') orderId: string,
    @Request() req: any,
  ) {
    const tenantId = req.headers['x-tenant-id'];
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) return { hasReview: false };

    const draft = await this.imagingService.getAiDraftForOrder(tenantDb, orderId);
    if (!draft) {
      return { hasReview: false };
    }

    if (!draft.heatmapRegions || draft.heatmapRegions.length === 0) {
      const attnResult = await this.cdssService.generateAttentionMap(
        {
          imaging_order_id: orderId,
          draft_report_text: draft.reportText ?? '',
          findings: draft.findings ?? [],
          image_width: 512,
          image_height: 512,
        },
        tenantId,
      );

      await this.imagingService.saveHeatmapRegions(tenantDb, orderId, attnResult.heatmap_regions);
      draft.heatmapRegions = attnResult.heatmap_regions;
    }

    return {
      hasReview: true,
      reportText: draft.reportText,
      findings: draft.findings,
      confidence: draft.confidence,
      heatmapRegions: draft.heatmapRegions,
    };
  }

  /**
   * GET /imaging/wado/:studyUid/:seriesUid/:instanceUid
   * WADO-RS proxy — serves DICOM instance bytes from MinIO.
   */
  @Get('wado/:studyUid/:seriesUid/:instanceUid')
  async wadoProxy(
    @Param('studyUid') studyUid: string,
    @Param('seriesUid') seriesUid: string,
    @Param('instanceUid') instanceUid: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const tenantId = req.headers['x-tenant-id'];
    const objectKey = `dicom/${tenantId}/${studyUid}/${seriesUid}/${instanceUid}.dcm`;

    try {
      const buffer = await this.imagingService.getDicomBuffer(objectKey);
      res.setHeader('Content-Type', 'application/dicom');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(buffer);
    } catch {
      res.status(404).json({ error: 'DICOM instance not found' });
    }
  }

  /**
   * POST /imaging/:orderId/upload-dicom
   * Upload a DICOM file for an order.
   */
  @Post(':orderId/upload-dicom')
  @UseInterceptors(FileInterceptor('dicom'))
  async uploadDicom(
    @Param('orderId') orderId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: {
      patientId: string;
      studyInstanceUid: string;
      seriesInstanceUid: string;
      modality?: string;
    },
    @Request() req: any,
  ) {
    const tenantId = req.headers['x-tenant-id'];
    const objectKey = `dicom/${tenantId}/${body.studyInstanceUid}/${body.seriesInstanceUid}/${Date.now()}.dcm`;

    await this.imagingService.uploadDicomToMinio(objectKey, file.buffer, file.mimetype);

    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      return { uploaded: true, objectKey };
    }

    const seriesRepo = tenantDb.getRepository(DicomSeries);
    let series = await seriesRepo.findOne({
      where: { imagingOrderId: orderId, seriesInstanceUid: body.seriesInstanceUid },
    });

    if (!series) {
      series = seriesRepo.create({
        imagingOrderId: orderId,
        patientId: body.patientId,
        studyInstanceUid: body.studyInstanceUid,
        seriesInstanceUid: body.seriesInstanceUid,
        modality: body.modality ?? 'CT',
        instanceCount: 0,
        minioPrefix: `dicom/${tenantId}/${body.studyInstanceUid}/${body.seriesInstanceUid}`,
        uploadedAt: new Date(),
      });
    }
    series.instanceCount += 1;
    await seriesRepo.save(series);

    return { uploaded: true, objectKey, seriesId: series.id };
  }
}
