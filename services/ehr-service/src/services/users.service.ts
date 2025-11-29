import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { CreateUserDto, UpdateUserDto } from '../dto/users.dto';

@Injectable()
export class UsersService {
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
    
    // Log temporary password for admin
    console.log(`🔑 TEMPORARY PASSWORD for ${savedUser.email}: ${tempPassword}`);
    
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
    
    console.log(`🔑 PASSWORD RESET for ${user.email}: ${tempPassword}`);
    
    return { 
      message: 'Password reset successfully',
      tempPassword 
    };
  }
}