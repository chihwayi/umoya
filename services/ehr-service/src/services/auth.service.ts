import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { LoginDto } from '../dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async login(loginDto: LoginDto, tenantDb: DataSource, ipAddress: string, userAgent: string) {
    const userRepository = tenantDb.getRepository(User);
    
    const user = await userRepository.findOne({
      where: { email: loginDto.email }
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account is not active');
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);
    
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    user.lastLogin = new Date();
    await userRepository.save(user);

    // Check if password change is required
    if (user.mustChangePassword) {
      return {
        token: this.jwtService.sign(
          { sub: user.id, email: user.email, role: user.role, temporary: true },
          { expiresIn: '15m' }
        ),
        mustChangePassword: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        },
        message: 'Password change required'
      };
    }

    // Generate JWT token
    const payload = { 
      sub: user.id, 
      email: user.email, 
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName
    };

    return {
      token: this.jwtService.sign(payload),
      mustChangePassword: false,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        specialization: user.specialization,
        mustChangePassword: user.mustChangePassword
      }
    };
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string, tenantDb: DataSource) {
    const userRepository = tenantDb.getRepository(User);
    
    const user = await userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify old password
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isOldPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password with same salt rounds as tenant service
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user
    user.passwordHash = hashedPassword;
    user.mustChangePassword = false;
    user.passwordChangedAt = new Date();

    await userRepository.save(user);
  }

  async forcePasswordChange(userId: string, newPassword: string, tenantDb: DataSource) {
    const userRepository = tenantDb.getRepository(User);
    
    const user = await userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Hash new password with same salt rounds as tenant service
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user
    user.passwordHash = hashedPassword;
    user.mustChangePassword = false;
    user.passwordChangedAt = new Date();

    await userRepository.save(user);
  }

  async validateUser(payload: any): Promise<any> {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      firstName: payload.firstName,
      lastName: payload.lastName
    };
  }
}