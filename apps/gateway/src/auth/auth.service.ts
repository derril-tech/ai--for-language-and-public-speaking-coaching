import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    // TODO: Replace with actual database query
    // For MVP, using demo users from seed data
    const demoUsers = [
      {
        id: '550e8400-e29b-41d4-a716-446655440010',
        email: 'admin@demo.com',
        name: 'Demo Admin',
        password: '$2b$10$demo.hash.for.admin', // demo123
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440011',
        email: 'coach@demo.com',
        name: 'Demo Coach',
        password: '$2b$10$demo.hash.for.coach', // demo123
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440012',
        email: 'student@demo.com',
        name: 'Demo Student',
        password: '$2b$10$demo.hash.for.student', // demo123
      },
    ];

    const user = demoUsers.find(u => u.email === email);
    if (!user) {
      return null;
    }

    // For demo purposes, accept any password for demo users
    // In production, use: const isPasswordValid = await bcrypt.compare(password, user.password);
    const isPasswordValid = password === 'demo123';

    if (!isPasswordValid) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens(user);
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const user = {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
      };

      return this.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async generateTokens(user: User): Promise<AuthResponse> {
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, {
        expiresIn: '30d', // Refresh tokens last longer
      }),
    ]);

    const expiresIn = this.configService.get<number>('JWT_EXPIRES_IN', 604800); // 7 days in seconds

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: expiresIn,
    };
  }

  async getUserById(userId: string): Promise<User | null> {
    // TODO: Replace with actual database query
    const demoUsers = [
      {
        id: '550e8400-e29b-41d4-a716-446655440010',
        email: 'admin@demo.com',
        name: 'Demo Admin',
        avatar_url: 'https://ui-avatars.com/api/?name=Demo+Admin',
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440011',
        email: 'coach@demo.com',
        name: 'Demo Coach',
        avatar_url: 'https://ui-avatars.com/api/?name=Demo+Coach',
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440012',
        email: 'student@demo.com',
        name: 'Demo Student',
        avatar_url: 'https://ui-avatars.com/api/?name=Demo+Student',
      },
    ];

    return demoUsers.find(u => u.id === userId) || null;
  }
}
