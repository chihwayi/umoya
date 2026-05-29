import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

@Injectable()
export class MinioService {
  private readonly logger = new Logger(MinioService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName = process.env.STORAGE_S3_BUCKET || 'umoya-documents';

  constructor() {
    this.s3Client = new S3Client({
      endpoint: process.env.STORAGE_S3_ENDPOINT,
      region: process.env.STORAGE_S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.STORAGE_S3_ACCESS_KEY,
        secretAccessKey: process.env.STORAGE_S3_SECRET_KEY,
      },
      forcePathStyle: process.env.STORAGE_S3_FORCE_PATH_STYLE === 'true',
    });
  }

  async uploadFile(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      });

      await this.s3Client.send(command);
      return key;
    } catch (error) {
      this.logger.error(`Failed to upload file ${key}:`, error);
      throw error;
    }
  }

  async uploadBuffer(bucket: string, key: string, buffer: Buffer, mimeType: string): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: bucket || this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      });

      await this.s3Client.send(command);
      return key;
    } catch (error) {
      this.logger.error(`Failed to upload buffer ${key}:`, error);
      throw error;
    }
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      this.logger.error(`Failed to generate signed URL for ${key}:`, error);
      throw error;
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      this.logger.error(`Failed to delete file ${key}:`, error);
      throw error;
    }
  }

  async getObjectBuffer(bucket: string, key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: bucket || this.bucketName,
      Key: key,
    });
    const result = await this.s3Client.send(command);
    if (!result.Body) {
      throw new Error(`Object not found: ${key}`);
    }
    const chunks: Buffer[] = [];
    for await (const chunk of result.Body as Readable) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  generateFileKey(tenantId: string, patientId: string, fileName: string): string {
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `${tenantId}/patients/${patientId}/documents/${timestamp}_${sanitizedFileName}`;
  }
}
