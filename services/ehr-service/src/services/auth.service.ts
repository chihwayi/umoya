import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserStatus } from '../entities/user.entity';
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

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Account is not active');
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);
    
    if (!isPasswordValid) {
      // Increment failed login attempts
      user.failedLoginAttempts += 1;
      
      if (user.failedLoginAttempts >= 5) {
        user.status = UserStatus.SUSPENDED;
        await userRepository.save(user);
        throw new ForbiddenException('Account locked due to multiple failed login attempts');
      }
      
      await userRepository.save(user);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed login attempts on successful login
    user.failedLoginAttempts = 0;
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
        department: user.department,
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

    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update user
    user.passwordHash = hashedPassword;
    user.mustChangePassword = false;
    user.lastPasswordChange = new Date();

    await userRepository.save(user);
  }

  async forcePasswordChange(userId: string, newPassword: string, tenantDb: DataSource) {
    const userRepository = tenantDb.getRepository(User);
    
    const user = await userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update user
    user.passwordHash = hashedPassword;
    user.mustChangePassword = false;
    user.lastPasswordChange = new Date();

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