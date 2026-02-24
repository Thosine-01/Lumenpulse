import { Controller, Get, Param, Patch, Body, Request, UseGuards, UsePipes } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll(): Promise<User[]> {
    return this.usersService.findAll();
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<User | null> {
    return this.usersService.findById(id);
  }

  @Get('me')
  async getProfile(@Request() req: any): Promise<ProfileResponseDto> {
    const userId = req.user.id;
    const user = await this.usersService.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    return new ProfileResponseDto({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      stellarPublicKey: user.stellarPublicKey,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  }

  @Patch('me')
  @UsePipes(new ValidationPipe())
  async updateProfile(
    @Request() req: any,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    const userId = req.user.id;
    
    // Only allow updating specific fields (strict DTO)
    const allowedUpdates: Partial<User> = {};
    if (updateProfileDto.displayName !== undefined) {
      allowedUpdates.displayName = updateProfileDto.displayName;
    }
    if (updateProfileDto.bio !== undefined) {
      allowedUpdates.bio = updateProfileDto.bio;
    }
    if (updateProfileDto.avatarUrl !== undefined) {
      allowedUpdates.avatarUrl = updateProfileDto.avatarUrl;
    }
    
    // Ensure password cannot be updated via this endpoint
    delete (allowedUpdates as any).passwordHash;
    
    const updatedUser = await this.usersService.update(userId, allowedUpdates);
    
    return new ProfileResponseDto({
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      displayName: updatedUser.displayName,
      bio: updatedUser.bio,
      avatarUrl: updatedUser.avatarUrl,
      stellarPublicKey: updatedUser.stellarPublicKey,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    });
  }
}
