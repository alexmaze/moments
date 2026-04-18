import { Injectable, Inject, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { type DrizzleClient, users } from '@moments/db';
import { RegisterDto, LoginDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleClient,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    // Check if username already exists
    const existing = await this.db
      .select()
      .from(users)
      .where(eq(users.username, dto.username))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('Username already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const [user] = await this.db
      .insert(users)
      .values({
        username: dto.username,
        displayName: dto.displayName,
        passwordHash,
      })
      .returning();

    return this.buildUserResponse(user);
  }

  async validateUser(dto: LoginDto) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.username, dto.username))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  async login(user: typeof users.$inferSelect) {
    const payload = { sub: user.id, username: user.username };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: this.buildUserResponse(user),
    };
  }

  async getProfile(userId: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.buildUserResponse(user);
  }

  private buildUserResponse(user: typeof users.$inferSelect) {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      locale: user.locale,
      theme: user.theme,
      background: user.background,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
