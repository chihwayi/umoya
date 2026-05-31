import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { AdminUser, AdminRole } from '../entities/admin-user.entity';
import { AuditService } from './audit.service';
import { TokenDenylistService } from './token-denylist.service';

export interface LoginDto {
  email: string;
  password: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: AdminRole;
  jti?: string;
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
    private tokenDenylist: TokenDenylistService,
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
      jti: randomUUID(),
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
    // Server-side revocation: a logged-out (or force-revoked) token is rejected
    // even though its signature is still valid and it hasn't expired yet.
    if (payload.jti && (await this.tokenDenylist.isRevoked(payload.jti))) {
      throw new UnauthorizedException('Session has been revoked');
    }

    const user = await this.adminUserRepository.findOne({
      where: { id: payload.sub, isActive: true }
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    // Carry the token's identity/expiry through so logout can revoke exactly this token.
    (user as any).tokenId = payload.jti;
    (user as any).tokenExp = payload.exp;
    return user;
  }

  /** Revoke the caller's current token (logout). TTL = the token's remaining lifetime. */
  async logout(jti: string | undefined, exp: number | undefined, userId?: string, ipAddress?: string, userAgent?: string): Promise<void> {
    if (!jti) return;
    const ttlSeconds = exp ? exp - Math.floor(Date.now() / 1000) : 8 * 3600;
    if (ttlSeconds <= 0) return; // already expired — nothing to revoke
    await this.tokenDenylist.revoke(jti, ttlSeconds);
    if (userId) {
      await this.auditService.safeLog(userId, 'logout', 'auth', null, null, null, ipAddress, userAgent);
    }
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

  // ── Multi-admin management (RBAC) ──────────────────────────────────────────

  private toSafeAdmin(u: AdminUser) {
    return {
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      isActive: u.isActive,
      mustChangePassword: u.mustChangePassword,
      twoFactorEnabled: u.twoFactorEnabled,
      lastLogin: u.lastLogin,
      lockedUntil: u.lockedUntil,
      createdAt: u.createdAt,
    };
  }

  private generateTempPassword(): string {
    // Meets policy: upper, lower, digit, symbol; 14 chars.
    const sets = ['ABCDEFGHJKMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '!@#$%^&*'];
    let pw = sets.map((s) => s[Math.floor(Math.random() * s.length)]).join('');
    const all = sets.join('');
    while (pw.length < 14) pw += all[Math.floor(Math.random() * all.length)];
    return pw.split('').sort(() => Math.random() - 0.5).join('');
  }

  private normalizeRole(role: string): AdminRole {
    const r = String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (r === 'super_admin' || r === 'superadmin') return AdminRole.SUPER_ADMIN;
    if (r === 'admin') return AdminRole.ADMIN;
    if (r === 'support') return AdminRole.SUPPORT;
    throw new BadRequestException(`Invalid role: ${role}`);
  }

  async listAdmins() {
    const admins = await this.adminUserRepository.find({ order: { createdAt: 'ASC' } });
    return admins.map((a) => this.toSafeAdmin(a));
  }

  /** Create an admin with a generated temp password (shown once to the creator). */
  async provisionAdmin(data: { email: string; firstName: string; lastName: string; role: string }) {
    const role = this.normalizeRole(data.role);
    const existing = await this.adminUserRepository.findOne({ where: { email: data.email.toLowerCase() } });
    if (existing) throw new BadRequestException('An admin with that email already exists');

    const tempPassword = this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const user = this.adminUserRepository.create({
      email: data.email.toLowerCase(),
      firstName: data.firstName,
      lastName: data.lastName,
      role,
      passwordHash,
      mustChangePassword: true,
      isActive: true,
    });
    const saved = await this.adminUserRepository.save(user);
    return { admin: this.toSafeAdmin(saved), tempPassword };
  }

  private async assertNotLastSuperAdmin(targetId: string) {
    const target = await this.adminUserRepository.findOne({ where: { id: targetId } });
    if (target?.role !== AdminRole.SUPER_ADMIN) return;
    const activeSupers = await this.adminUserRepository.count({
      where: { role: AdminRole.SUPER_ADMIN, isActive: true },
    });
    if (activeSupers <= 1) {
      throw new BadRequestException('Cannot remove or demote the last active super admin');
    }
  }

  async setAdminRole(targetId: string, role: string) {
    const newRole = this.normalizeRole(role);
    const target = await this.adminUserRepository.findOne({ where: { id: targetId } });
    if (!target) throw new BadRequestException('Admin not found');
    if (newRole !== AdminRole.SUPER_ADMIN) await this.assertNotLastSuperAdmin(targetId);
    target.role = newRole;
    await this.adminUserRepository.save(target);
    return this.toSafeAdmin(target);
  }

  async setAdminStatus(targetId: string, isActive: boolean, actingUserId: string) {
    if (targetId === actingUserId && !isActive) {
      throw new BadRequestException('You cannot disable your own account');
    }
    const target = await this.adminUserRepository.findOne({ where: { id: targetId } });
    if (!target) throw new BadRequestException('Admin not found');
    if (!isActive) await this.assertNotLastSuperAdmin(targetId);
    target.isActive = isActive;
    if (isActive) { target.failedLoginAttempts = 0; target.lockedUntil = null; }
    await this.adminUserRepository.save(target);
    return this.toSafeAdmin(target);
  }

  async resetAdminPassword(targetId: string) {
    const target = await this.adminUserRepository.findOne({ where: { id: targetId } });
    if (!target) throw new BadRequestException('Admin not found');
    const tempPassword = this.generateTempPassword();
    target.passwordHash = await bcrypt.hash(tempPassword, 12);
    target.mustChangePassword = true;
    target.failedLoginAttempts = 0;
    target.lockedUntil = null;
    await this.adminUserRepository.save(target);
    return { admin: this.toSafeAdmin(target), tempPassword };
  }

  async deleteAdmin(targetId: string, actingUserId: string) {
    if (targetId === actingUserId) {
      throw new BadRequestException('You cannot delete your own account');
    }
    await this.assertNotLastSuperAdmin(targetId);
    const target = await this.adminUserRepository.findOne({ where: { id: targetId } });
    if (!target) throw new BadRequestException('Admin not found');
    await this.adminUserRepository.remove(target);
    return { deleted: true };
  }
}