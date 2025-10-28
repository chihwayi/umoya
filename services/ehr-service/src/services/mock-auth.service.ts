import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class MockAuthService {
  constructor(private jwtService: JwtService) {}

  async validateUser(email: string, password: string): Promise<any> {
    // Mock validation - accept any credentials for testing
    if (email && password) {
      return {
        id: '1',
        email: email,
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        tenantId: 'bulawayo-general'
      };
    }
    return null;
  }

  async login(user: any) {
    const payload = { 
      email: user.email, 
      sub: user.id, 
      role: user.role,
      tenantId: user.tenantId 
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    };
  }
}


