import { Injectable, Inject, ConflictException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { type DrizzleClient, mediaAssets, users, systemSettings } from '@moments/db';
import { RegisterDto, LoginDto } from './dto';

@Injectable()
export class AuthService {
  private readonly adminUsernames: Set<string>;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleClient,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    // Parse ADMIN_USERNAMES from env (comma-separated, case-insensitive)
    const adminUsernamesStr = this.configService.get<string>('ADMIN_USERNAMES', '');
    this.adminUsernames = new Set(
      adminUsernamesStr
        .split(',')
        .map((u) => u.trim().toLowerCase())
        .filter((u) => u.length > 0),
    );
  }

  isAdmin(username: string): boolean {
    return this.adminUsernames.has(username.toLowerCase());
  }

  async register(dto: RegisterDto) {
    const [setting] = await this.db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, 'registration_open'))
      .limit(1);

    if (setting?.value === 'false') {
      throw new ForbiddenException('Registration is currently disabled');
    }

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

    if (!user.isActive) {
      throw new UnauthorizedException('Account has been disabled');
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
      user: await this.buildUserResponse(user),
    };
  }

  async getProfile(userId: string) {
    const [user] = await this.db
      .select({
        user: users,
        avatarUrl: mediaAssets.publicUrl,
      })
      .from(users)
      .leftJoin(mediaAssets, eq(users.avatarMediaId, mediaAssets.id))
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.buildUserResponse(user.user, user.avatarUrl);
  }

  private async buildUserResponse(user: typeof users.$inferSelect, avatarUrlOverride?: string | null) {
    const avatarUrl = avatarUrlOverride ?? await this.resolveAvatarUrl(user.avatarMediaId);
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl,
      bio: user.bio,
      locale: user.locale,
      theme: user.theme,
      background: user.background,
      isAdmin: this.isAdmin(user.username),
      createdAt: user.createdAt.toISOString(),
    };
  }

  private async resolveAvatarUrl(avatarMediaId: string | null) {
    if (!avatarMediaId) return null;

    const [asset] = await this.db
      .select({ publicUrl: mediaAssets.publicUrl })
      .from(mediaAssets)
      .where(eq(mediaAssets.id, avatarMediaId))
      .limit(1);

    return asset?.publicUrl ?? null;
  }
}
