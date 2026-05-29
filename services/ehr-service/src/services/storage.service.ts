import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { Readable } from 'stream';

interface UploadOptions {
  tenantId?: string;
  studyId: string;
  filename?: string;
  buffer: Buffer;
  contentType?: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly driverEnabled: boolean;
  private readonly bucketName: string;
  private readonly internalClient?: S3Client;
  private readonly presignClient?: S3Client;
  private readonly publicBaseUrl?: string;

  constructor() {
    const driver = (process.env.STORAGE_DRIVER || '').toLowerCase();
    this.driverEnabled = driver === 's3' || driver === 'minio';
    this.bucketName = process.env.STORAGE_S3_BUCKET || 'umoya-imaging';
    this.publicBaseUrl = process.env.STORAGE_S3_PUBLIC_BASE_URL;

    if (!this.driverEnabled) {
      this.logger.log('Object storage driver disabled. Falling back to database blobs.');
      return;
    }

    const accessKey = process.env.STORAGE_S3_ACCESS_KEY;
    const secretKey = process.env.STORAGE_S3_SECRET_KEY;

    if (!accessKey || !secretKey) {
      this.driverEnabled = false;
      this.logger.warn('Object storage driver enabled but credentials missing. Falling back to database blobs.');
      return;
    }

    const forcePathStyle = (process.env.STORAGE_S3_FORCE_PATH_STYLE || 'true') === 'true';

    this.internalClient = new S3Client({
      region: process.env.STORAGE_S3_REGION || 'us-east-1',
      endpoint: process.env.STORAGE_S3_ENDPOINT || undefined,
      forcePathStyle,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
    });

    if (this.publicBaseUrl) {
      this.presignClient = new S3Client({
        region: process.env.STORAGE_S3_REGION || 'us-east-1',
        endpoint: this.publicBaseUrl,
        forcePathStyle,
        credentials: {
          accessKeyId: accessKey,
          secretAccessKey: secretKey,
        },
      });
    } else {
      this.presignClient = this.internalClient;
    }

    this.ensureBucketExists().catch((error) => {
      this.logger.error('Failed to ensure imaging bucket exists', error);
    });
  }

  isEnabled() {
    return this.driverEnabled && !!this.internalClient;
  }

  async uploadStudyAsset(options: UploadOptions): Promise<string | null> {
    if (!this.isEnabled() || !this.internalClient) {
      return null;
    }

    const key = this.buildObjectKey(options);

    await this.internalClient.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: options.buffer,
        ContentType: options.contentType || 'application/octet-stream',
      }),
    );

    return key;
  }

  async getObjectData(key: string): Promise<{ buffer: Buffer; contentType?: string } | null> {
    if (!this.isEnabled() || !this.internalClient) {
      return null;
    }

    const result = await this.internalClient.send(
      new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }),
    );

    if (!result.Body) {
      return null;
    }

    const buffer = await this.streamToBuffer(result.Body as Readable);
    return { buffer, contentType: result.ContentType };
  }

  async deleteObject(key: string): Promise<void> {
    if (!this.isEnabled() || !this.internalClient) {
      return;
    }

    await this.internalClient.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }),
    );
  }

  async getSignedUrl(key: string, expiresInSeconds = 300): Promise<string | null> {
    if (!this.isEnabled() || !this.presignClient) {
      return null;
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return getSignedUrl(this.presignClient, command, { expiresIn: expiresInSeconds });
  }

  private async ensureBucketExists() {
    if (!this.internalClient) {
      return;
    }

    try {
      await this.internalClient.send(
        new HeadBucketCommand({
          Bucket: this.bucketName,
        }),
      );
    } catch (error: any) {
      if (error?.$metadata?.httpStatusCode === 404) {
        await this.internalClient.send(
          new CreateBucketCommand({
            Bucket: this.bucketName,
          }),
        );
        this.logger.log(`Created imaging bucket "${this.bucketName}"`);
      } else if (error?.name === 'NotFound') {
        await this.internalClient.send(
          new CreateBucketCommand({
            Bucket: this.bucketName,
          }),
        );
      } else {
        this.logger.warn(`Bucket check failed for ${this.bucketName}: ${error?.message}`);
      }
    }
  }

  private buildObjectKey(options: UploadOptions) {
    const tenantSegment = options.tenantId || 'shared';
    const filenameSafe = options.filename?.replace(/\s+/g, '_') || 'image.dcm';
    return `imaging/${tenantSegment}/${options.studyId}/${Date.now()}-${uuid()}-${filenameSafe}`;
  }


  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }
}

