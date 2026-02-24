import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUser: User = {
    id: 'test-id',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    displayName: 'John Doe',
    bio: 'Test user bio',
    avatarUrl: 'https://example.com/avatar.jpg',
    stellarPublicKey: 'GABC123',
    createdAt: new Date(),
    updatedAt: new Date(),
    passwordHash: 'hashed-password',
  };

  beforeEach(async () => {
    const mockUsersService = {
      findAll: jest.fn().mockResolvedValue([mockUser]),
      findById: jest.fn().mockResolvedValue(mockUser),
      update: jest.fn().mockResolvedValue(mockUser),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /users/me', () => {
    it('should return current user profile', async () => {
      const mockRequest = { user: { id: 'test-id' } };
      
      const result = await controller.getProfile(mockRequest as any);
      
      expect(result).toBeDefined();
      expect(result.id).toBe('test-id');
      expect(result.email).toBe('test@example.com');
      expect(result.displayName).toBe('John Doe');
    });
  });

  describe('PATCH /users/me', () => {
    it('should update user profile', async () => {
      const mockRequest = { user: { id: 'test-id' } };
      const updateData = {
        displayName: 'Updated Name',
        bio: 'Updated bio',
      };
      
      const result = await controller.updateProfile(mockRequest as any, updateData);
      
      expect(result).toBeDefined();
      expect(result.displayName).toBe('Updated Name');
      expect(result.bio).toBe('Updated bio');
      expect(service.update).toHaveBeenCalledWith('test-id', {
        displayName: 'Updated Name',
        bio: 'Updated bio',
      });
    });

    it('should not allow password updates', async () => {
      const mockRequest = { user: { id: 'test-id' } };
      const updateData = {
        displayName: 'Updated Name',
        passwordHash: 'should-not-update',
      };
      
      await controller.updateProfile(mockRequest as any, updateData);
      
      expect(service.update).toHaveBeenCalledWith('test-id', {
        displayName: 'Updated Name',
      });
    });
  });
});
