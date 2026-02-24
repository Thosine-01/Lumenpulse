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
    const mockUsersService: Partial<UsersService> = {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      findAll: jest.fn().mockResolvedValue([mockUser]),
      // eslint-disable-next-line @typescript-eslint/unbound-method
      findById: jest.fn().mockResolvedValue(mockUser),
      // eslint-disable-next-line @typescript-eslint/unbound-method
      update: jest.fn().mockImplementation((id: string, updateData: Partial<User>) => {
        return Promise.resolve({ ...mockUser, ...updateData });
      }),
    };

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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const mockRequest = {
        user: { id: 'test-id', email: 'test@example.com' },
      } as any;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const result = await controller.getProfile(mockRequest);

      expect(result).toBeDefined();
      expect(result.id).toBe('test-id');
      expect(result.email).toBe('test@example.com');
      expect(result.displayName).toBe('John Doe');
    });
  });

  describe('PATCH /users/me', () => {
    it('should update user profile', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const mockRequest = {
        user: { id: 'test-id', email: 'test@example.com' },
      } as any;
      const updateData = {
        displayName: 'Updated Name',
        bio: 'Updated bio',
      };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const result = await controller.updateProfile(mockRequest, updateData);

      expect(result).toBeDefined();
      expect(result.displayName).toBe('Updated Name');
      expect(result.bio).toBe('Updated bio');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.update).toHaveBeenCalledWith('test-id', {
        displayName: 'Updated Name',
        bio: 'Updated bio',
      });
    });

    it('should not allow password updates', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const mockRequest = {
        user: { id: 'test-id', email: 'test@example.com' },
      } as any;
      const updateData = {
        displayName: 'Updated Name',
        passwordHash: 'should-not-update',
      };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await controller.updateProfile(mockRequest, updateData);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.update).toHaveBeenCalledWith('test-id', {
        displayName: 'Updated Name',
      });
    });
  });
});
