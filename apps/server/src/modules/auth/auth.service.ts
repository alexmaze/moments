import { Injectable, Inject, ConflictException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import type { AuthConfig } from '@moments/config';
import { DRIZZLE } from '../../database/database.module';
import { type DrizzleClient, mediaAssets, users, systemSettings } from '@moments/db';
import { RegisterDto, LoginDto } from './dto';
import { MediaService } from '../media/media.service';

@Injectable()
export class AuthService {
  private readonly adminUsernames: Set<string>;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleClient,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mediaService: MediaService,
  ) {
    const auth = this.configService.getOrThrow<AuthConfig>('auth');
    this.adminUsernames = new Set(auth.adminUsernames);
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
        avatarPath: mediaAssets.storagePath,
      })
      .from(users)
      .leftJoin(mediaAssets, eq(users.avatarMediaId, mediaAssets.id))
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.buildUserResponse(
      user.user,
      user.avatarPath ? await this.mediaService.getSignedUrl(user.avatarPath) : null,
    );
  }

  private async buildUserResponse(user: typeof users.$inferSelect, avatarUrlOverride?: string | null) {
    const avatarUrl = avatarUrlOverride ?? await this.mediaService.signMediaAssetUrl(user.avatarMediaId, this.mediaService.avatarCiParams);
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
}
