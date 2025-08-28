import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthService } from '../auth/auth.service';

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  memberships: Membership[];
}

export interface Membership {
  organization_id: string;
  role: string;
  organization: Organization;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  settings: Record<string, any>;
  created_at: string;
}

@Controller('me')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private authService: AuthService) {}

  @Get()
  async getProfile(@Request() req): Promise<UserProfile> {
    const user = await this.authService.getUserById(req.user.userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    // TODO: Replace with actual database queries
    // For MVP, return demo data
    const memberships: Membership[] = [
      {
        organization_id: '550e8400-e29b-41d4-a716-446655440001',
        role: req.user.userId === '550e8400-e29b-41d4-a716-446655440010' ? 'owner' : 
              req.user.userId === '550e8400-e29b-41d4-a716-446655440011' ? 'coach' : 'student',
        organization: {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'Demo Academy',
          slug: 'demo-academy',
          settings: { features: { analytics: true, coaching: true } },
          created_at: new Date().toISOString(),
        },
      },
    ];

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      memberships,
    };
  }
}

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  @Get()
  async getOrganizations(@Request() req): Promise<{ organizations: Organization[] }> {
    // TODO: Replace with actual database query
    // For MVP, return demo data
    const organizations: Organization[] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Demo Academy',
        slug: 'demo-academy',
        settings: { features: { analytics: true, coaching: true } },
        created_at: new Date().toISOString(),
      },
    ];

    return { organizations };
  }
}
