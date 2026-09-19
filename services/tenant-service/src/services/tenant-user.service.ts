import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { TenantUser, UserStatus } from '../entities/tenant-user.entity';
import { CreateTenantUserDto } from '../dto/create-tenant-user.dto';

// passwordHash is select:false on TenantUser, but an entity built via
// .create({ passwordHash }) still carries the real value in memory until
// it's stripped — select:false only hides it on a fresh SELECT.
function omitPasswordHash(user: TenantUser): TenantUser {
  const { passwordHash: _omit, ...rest } = user as any;
  return rest as TenantUser;
}

@Injectable()
export class TenantUserService {
  constructor(
    @InjectRepository(TenantUser)
    private tenantUserRepository: Repository<TenantUser>,
  ) {}

  async createTenantUser(tenantId: string, createUserDto: CreateTenantUserDto): Promise<TenantUser> {
    // Check if email already exists
    const existingUser = await this.tenantUserRepository.findOne({
      where: { email: createUserDto.email }
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(createUserDto.temporaryPassword, 10);

    const user = this.tenantUserRepository.create({
      ...createUserDto,
      tenantId,
      passwordHash,
      mustChangePassword: true,
    });

    const saved = await this.tenantUserRepository.save(user);
    return omitPasswordHash(saved);
  }

  async getTenantUsers(tenantId: string): Promise<TenantUser[]> {
    return this.tenantUserRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' }
    });
  }

  async updateUserStatus(userId: string, status: UserStatus): Promise<TenantUser> {
    const user = await this.tenantUserRepository.findOne({
      where: { id: userId }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.status = status;
    return this.tenantUserRepository.save(user);
  }

  async resetUserPassword(userId: string, newPassword: string): Promise<TenantUser> {
    const user = await this.tenantUserRepository.findOne({
      where: { id: userId }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.mustChangePassword = true;
    const saved = await this.tenantUserRepository.save(user);
    return omitPasswordHash(saved);
  }

  async deleteUser(userId: string): Promise<void> {
    const result = await this.tenantUserRepository.delete(userId);
    if (result.affected === 0) {
      throw new NotFoundException('User not found');
    }
  }

  async getUsersByTenant(tenantId: string): Promise<TenantUser[]> {
    return this.tenantUserRepository.find({
      where: { tenantId },
      relations: ['tenant']
    });
  }
}