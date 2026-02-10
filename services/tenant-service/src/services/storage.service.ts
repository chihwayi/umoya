import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, HeadBucketCommand, CreateBucketCommand, PutBucketPolicyCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.get<string>('BACKUP_BUCKET_NAME', 'medicore-backups');
    
    const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
    const endpoint = this.configService.get<string>('AWS_ENDPOINT');

    this.s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId: accessKeyId || 'minioadmin',
        secretAccessKey: secretAccessKey || 'minioadmin',
      },
      endpoint: endpoint || this.configService.get<string>('MINIO_URL'),
      forcePathStyle: true,
    });

    this.ensureBucketExists();
  }

  private async ensureBucketExists() {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucketName }));
    } catch (error) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        this.logger.log(`Bucket ${this.bucketName} not found, creating...`);
        try {
          await this.s3Client.send(new CreateBucketCommand({ Bucket: this.bucketName }));
          this.logger.log(`Bucket ${this.bucketName} created successfully`);
        } catch (createError) {
          this.logger.error(`Failed to create bucket ${this.bucketName}: ${createError}`);
          return;
        }
      } else {
        this.logger.error(`Error checking bucket existence: ${error}`);
        return;
      }
    }

    // Always try to ensure policy is public
    await this.setPublicPolicy();
  }

  private async setPublicPolicy() {
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'PublicReadGetObject',
          Effect: 'Allow',
          Principal: '*',
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${this.bucketName}/*`],
        },
      ],
    };

    try {
      await this.s3Client.send(new PutBucketPolicyCommand({
        Bucket: this.bucketName,
        Policy: JSON.stringify(policy),
      }));
      this.logger.log(`Public read policy set for bucket ${this.bucketName}`);
    } catch (error) {
      this.logger.error(`Failed to set bucket policy: ${error}`);
    }
  }

  async uploadLogo(file: any): Promise<string> {
    await this.ensureBucketExists();
    const fileExtension = file.originalname.split('.').pop();
    const key = `logos/${uuidv4()}.${fileExtension}`;

    try {
      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }));

      // Return the public URL (assuming public bucket or accessible via MinIO)
      const endpoint = this.configService.get<string>('MINIO_PUBLIC_URL') || this.configService.get<string>('AWS_ENDPOINT') || this.configService.get<string>('MINIO_URL');
      return `${endpoint}/${this.bucketName}/${key}`;
    } catch (error) {
      this.logger.error(`Failed to upload logo: ${error}`);
      throw error;
    }
  }
}
