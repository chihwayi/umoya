import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AdminUser, AdminRole } from '../entities/admin-user.entity';
import { AuditService } from './audit.service';

export interface LoginDto {
  email: string;
  password: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: AdminRole;
  iat?: number;
  exp?: number;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(AdminUser)
    private adminUserRepository: Repository<AdminUser>,
    private jwtService: JwtService,
    private auditService: AuditService,
  ) {}

  async login(loginDto: LoginDto, ipAddress: string, userAgent: string) {
    const { email, password } = loginDto;
    
    const user = await this.adminUserRepository.findOne({
      where: { email: email.toLowerCase() }
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.isLocked) {
      throw new UnauthorizedException('Account is locked. Please try again later.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isPasswordValid) {
      await this.handleFailedLogin(user);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed attempts on successful login
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.lastLogin = new Date();
    await this.adminUserRepository.save(user);

    // Log successful login
    await this.auditService.log(user.id, 'login', 'auth', null, null, null, ipAddress, userAgent);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  async validateUser(payload: JwtPayload): Promise<AdminUser> {
    const user = await this.adminUserRepository.findOne({
      where: { id: payload.sub, isActive: true }
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.adminUserRepository.findOne({
      where: { id: userId }
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isOldPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    user.passwordHash = passwordHash;
    user.mustChangePassword = false;
    await this.adminUserRepository.save(user);

    await this.auditService.log(userId, 'password_change', 'auth', userId);
  }

  private async handleFailedLogin(user: AdminUser) {
    user.failedLoginAttempts += 1;
    
    // Lock account after 5 failed attempts for 30 minutes
    if (user.failedLoginAttempts >= 5) {
      user.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
    }
    
    await this.adminUserRepository.save(user);
  }

  async createAdminUser(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: AdminRole;
  }) {
    const existingUser = await this.adminUserRepository.findOne({
      where: { email: userData.email.toLowerCase() }
    });

    if (existingUser) {
      throw new BadRequestException('User already exists');
    }

    const passwordHash = await bcrypt.hash(userData.password, 12);
    
    const user = this.adminUserRepository.create({
      ...userData,
      email: userData.email.toLowerCase(),
      passwordHash,
      mustChangePassword: true,
    });

    return this.adminUserRepository.save(user);
  }
}