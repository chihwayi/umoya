import { Injectable, NotFoundException, ConflictException, Optional, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { CreateUserDto, UpdateUserDto } from '../dto/users.dto';
import { NotificationCenterService } from './notification-center.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @Optional() private readonly notificationCenterService?: NotificationCenterService,
  ) {}
  async getAllUsers(tenantDb: DataSource, role?: string): Promise<User[]> {
    const userRepository = tenantDb.getRepository(User);
    
    let query = userRepository.createQueryBuilder('user')
      .where('user.isActive = :isActive', { isActive: true });
    
    if (role) {
      query = query.andWhere('user.role = :role', { role });
    }
    
    return query.orderBy('user.createdAt', 'DESC').getMany();
  }

  async getUserById(id: string, tenantDb: DataSource): Promise<User> {
    const userRepository = tenantDb.getRepository(User);
    const user = await userRepository.findOne({ where: { id, isActive: true } });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    return user;
  }

  async createUser(createUserDto: CreateUserDto, tenantDb: DataSource): Promise<User & { tempPassword: string }> {
    const userRepository = tenantDb.getRepository(User);
    
    // Check if email already exists
    const existingUser = await userRepository.findOne({ 
      where: { email: createUserDto.email } 
    });
    
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = userRepository.create({
      ...createUserDto,
      passwordHash,
      mustChangePassword: true,
      isActive: true
    });

    const savedUser = await userRepository.save(user);

    // S221: staff_invitation trigger — email the new staff member their
    // temporary credentials (must be changed on first login). Config-gated,
    // best-effort; the admin still sees the temp password in the response.
    if (this.notificationCenterService && savedUser.email) {
      try {
        await this.notificationCenterService.notifyTrigger(tenantDb, 'staff_invitation', {
          recipientEmail: savedUser.email,
          subject: 'You have been invited to Umoya',
          message:
            `Hello ${savedUser.firstName || ''} ${savedUser.lastName || ''},\n\n` +
            `An account has been created for you (role: ${savedUser.role}).\n` +
            `Login email: ${savedUser.email}\n` +
            `Temporary password: ${tempPassword}\n\n` +
            `You will be required to change this password on first login.`,
        });
      } catch (notifyError: any) {
        this.logger.warn(`staff_invitation notification failed: ${notifyError?.message}`);
      }
    }

    return Object.assign(savedUser, { tempPassword });
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto, tenantDb: DataSource): Promise<User> {
    const userRepository = tenantDb.getRepository(User);
    const user = await this.getUserById(id, tenantDb);
    
    // Check email uniqueness if email is being updated
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await userRepository.findOne({ 
        where: { email: updateUserDto.email } 
      });
      
      if (existingUser) {
        throw new ConflictException('Email already exists');
      }
    }

    Object.assign(user, updateUserDto);
    return userRepository.save(user);
  }

  async deactivateUser(id: string, tenantDb: DataSource): Promise<{ message: string }> {
    const userRepository = tenantDb.getRepository(User);
    const user = await this.getUserById(id, tenantDb);
    
    user.isActive = false;
    await userRepository.save(user);
    
    return { message: 'User deactivated successfully' };
  }

  async activateUser(id: string, tenantDb: DataSource): Promise<{ message: string }> {
    const userRepository = tenantDb.getRepository(User);
    const user = await userRepository.findOne({ where: { id } });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    user.isActive = true;
    await userRepository.save(user);
    
    return { message: 'User activated successfully' };
  }

  async resetPassword(id: string, tenantDb: DataSource): Promise<{ message: string; tempPassword: string }> {
    const userRepository = tenantDb.getRepository(User);
    const user = await this.getUserById(id, tenantDb);
    
    // Generate new temporary password
    const tempPassword = Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    
    user.passwordHash = passwordHash;
    user.mustChangePassword = true;
    user.passwordChangedAt = null;
    
    await userRepository.save(user);
    
    return { 
      message: 'Password reset successfully',
      tempPassword 
    };
  }
}
