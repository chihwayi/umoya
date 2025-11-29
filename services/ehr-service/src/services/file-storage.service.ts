import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private s3Client: S3Client | null = null;
  private bucketName: string;
  private useS3: boolean;

  constructor() {
    this.bucketName = process.env.S3_BUCKET_NAME || process.env.STORAGE_BUCKET || 'medicore-reports';
    this.useS3 = process.env.USE_S3 === 'true' || process.env.STORAGE_DRIVER === 's3' || !!process.env.AWS_ACCESS_KEY_ID;

    if (this.useS3) {
      try {
        this.s3Client = new S3Client({
          region: process.env.AWS_REGION || process.env.STORAGE_REGION || 'us-east-1',
          endpoint: process.env.STORAGE_ENDPOINT, // For MinIO or custom S3-compatible storage
          forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === 'true',
          credentials: process.env.AWS_ACCESS_KEY_ID
            ? {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
              }
            : undefined,
        });
        this.logger.log(`S3 file storage initialized (bucket: ${this.bucketName})`);
      } catch (error: any) {
        this.logger.warn(`Failed to initialize S3: ${error.message}. File storage disabled.`);
        this.useS3 = false;
      }
    } else {
      this.logger.warn('S3 not configured. Files will not be persisted. Set USE_S3=true and AWS credentials to enable.');
    }
  }

  /**
   * Upload a file to S3 and return a URL
   */
  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    contentType: string,
    folder: string = 'reports',
  ): Promise<string | null> {
    if (!this.useS3 || !this.s3Client) {
      this.logger.warn(`[File Storage] Would upload ${fileName} to S3 (not configured)`);
      return null;
    }

    try {
      const key = `${folder}/${Date.now()}-${fileName}`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
        Metadata: {
          uploadedAt: new Date().toISOString(),
        },
      });

      await this.s3Client.send(command);
      this.logger.log(`File uploaded to S3: ${key}`);

      // Generate a presigned URL (valid for 7 days)
      const getCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const url = await getSignedUrl(this.s3Client, getCommand, { expiresIn: 7 * 24 * 60 * 60 }); // 7 days
      return url;
    } catch (error: any) {
      this.logger.error(`Failed to upload file to S3: ${error.message}`);
      return null;
    }
  }

  /**
   * Get a presigned URL for a file
   */
  async getFileUrl(key: string, expiresIn: number = 3600): Promise<string | null> {
    if (!this.useS3 || !this.s3Client) {
      return null;
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });
      return url;
    } catch (error: any) {
      this.logger.error(`Failed to generate presigned URL: ${error.message}`);
      return null;
    }
  }

  /**
   * Delete a file from S3
   */
  async deleteFile(key: string): Promise<boolean> {
    if (!this.useS3 || !this.s3Client) {
      return false;
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.log(`File deleted from S3: ${key}`);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to delete file from S3: ${error.message}`);
      return false;
    }
  }

  /**
   * Store report file and return URL
   */
  async storeReportFile(
    fileBuffer: Buffer,
    reportName: string,
    format: string,
    executionId: string,
  ): Promise<string | null> {
    const extension = format === 'pdf' ? 'pdf' : format === 'excel' ? 'xlsx' : 'csv';
    const contentType =
      format === 'pdf'
        ? 'application/pdf'
        : format === 'excel'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv';

    const fileName = `report-${reportName.replace(/[^a-z0-9]/gi, '_')}-${executionId.substring(0, 8)}.${extension}`;

    return this.uploadFile(fileBuffer, fileName, contentType, 'analytics-reports');
  }
}

