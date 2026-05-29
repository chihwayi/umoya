import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private s3Client: S3Client | null = null;
  private bucketName: string;
  private useS3: boolean;

  constructor() {
    this.bucketName = process.env.S3_BUCKET_NAME || process.env.STORAGE_BUCKET || 'umoya-reports';
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
   * Upload a buffer to S3 and return key, bucket, size, sha256 (for post-visit recording storage).
   */
  async uploadBuffer(
    bucket: string,
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<{ key: string; bucket: string; size: number; sha256: string }> {
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    if (!this.useS3 || !this.s3Client) {
      this.logger.warn(`[File Storage] Would upload to ${bucket}/${key} (S3 not configured)`);
      return { key, bucket, size: buffer.length, sha256 };
    }
    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          Metadata: { uploadedAt: new Date().toISOString() },
        }),
      );
      this.logger.log(`File uploaded to S3: ${bucket}/${key}`);
      return { key, bucket, size: buffer.length, sha256 };
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Failed to upload buffer to S3: ${err.message}`);
      throw error;
    }
  }

  /**
   * Get a time-limited signed download URL for an object (for post-visit recording playback).
   */
  async getSignedDownloadUrl(bucket: string, key: string, expiresInSeconds = 900): Promise<string> {
    if (!this.useS3 || !this.s3Client) {
      this.logger.warn('[File Storage] S3 not configured; cannot generate signed URL');
      return '';
    }
    try {
      const command = new GetObjectCommand({ Bucket: bucket, Key: key });
      return getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Failed to generate signed URL: ${err.message}`);
      throw error;
    }
  }

  async downloadBuffer(bucket: string, key: string): Promise<Buffer> {
    if (!this.useS3 || !this.s3Client) {
      throw new Error('S3 not configured; cannot download object');
    }

    const response = await this.s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const body = response.Body as any;
    if (!body) return Buffer.alloc(0);

    if (typeof body.transformToByteArray === 'function') {
      return Buffer.from(await body.transformToByteArray());
    }

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      body.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      body.on('end', () => resolve(Buffer.concat(chunks)));
      body.on('error', reject);
    });
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
