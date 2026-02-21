import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { News } from '../src/news/news.entity';
import { NewsService } from '../src/news/news.service';
import { NewsSentimentService } from '../src/news/news-sentiment.services';



function makeArticle(overrides: Partial<News> = {}): News {
  return {
    id: 'article-uuid-1',
    title: 'Bitcoin hits new high',
    url: 'https://example.com/btc',
    source: 'coindesk',
    publishedAt: new Date(),
    sentimentScore: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─── NewsSentimentService Unit Tests ────────────────────────────────────────

describe('NewsSentimentService', () => {
  let sentimentService: NewsSentimentService;
  let newsService: jest.Mocked<NewsService>;
  let httpService: jest.Mocked<HttpService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsSentimentService,
        {
          provide: HttpService,
          useValue: { post: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('http://localhost:8000'),
          },
        },
        {
          provide: NewsService,
          useValue: {
            findUnscoredArticles: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    sentimentService = module.get(NewsSentimentService);
    newsService = module.get(NewsService);
    httpService = module.get(HttpService);
  });

  // ── analyzeSentiment ──────────────────────────────────────────────────────

  describe('analyzeSentiment()', () => {
    it('should return score from Python service', async () => {
      httpService.post.mockReturnValue(
        of({ data: { sentiment: 0.75 } } as any),
      );

      const score = await sentimentService.analyzeSentiment('Bitcoin is up!');
      expect(score).toBe(0.75);
    });

    it('should return null when Python service is down (non-blocking)', async () => {
      httpService.post.mockReturnValue(
        throwError(() => new Error('ECONNREFUSED')),
      );

      const score = await sentimentService.analyzeSentiment('some text');
      expect(score).toBeNull(); // must never throw
    });

    it('should return null on timeout', async () => {
      httpService.post.mockReturnValue(
        throwError(() => ({ code: 'ECONNABORTED' })),
      );

      const score = await sentimentService.analyzeSentiment('some text');
      expect(score).toBeNull();
    });

    it('should handle score at boundary values (-1 and 1)', async () => {
      httpService.post.mockReturnValueOnce(
        of({ data: { sentiment: -1 } } as any),
      );
      expect(await sentimentService.analyzeSentiment('terrible news')).toBe(-1);

      httpService.post.mockReturnValueOnce(
        of({ data: { sentiment: 1 } } as any),
      );
      expect(await sentimentService.analyzeSentiment('great news')).toBe(1);
    });
  });

  // ── updateMissingSentiments (cron) ────────────────────────────────────────

  describe('updateMissingSentiments()', () => {
    it('should update articles that have no sentiment score', async () => {
      const articles = [makeArticle({ id: '1' }), makeArticle({ id: '2' })];
      newsService.findUnscoredArticles.mockResolvedValue(articles);
      httpService.post.mockReturnValue(
        of({ data: { sentiment: 0.5 } } as any),
      );

      await sentimentService.updateMissingSentiments();

      expect(newsService.update).toHaveBeenCalledTimes(2);
      expect(newsService.update).toHaveBeenCalledWith('1', { sentimentScore: 0.5 });
      expect(newsService.update).toHaveBeenCalledWith('2', { sentimentScore: 0.5 });
    });

    it('should skip update for articles where sentiment service fails', async () => {
      const articles = [makeArticle({ id: '1' })];
      newsService.findUnscoredArticles.mockResolvedValue(articles);
      httpService.post.mockReturnValue(
        throwError(() => new Error('service down')),
      );

      await sentimentService.updateMissingSentiments();

      // Should NOT update when score is null
      expect(newsService.update).not.toHaveBeenCalled();
    });

    it('should not throw when all articles fail scoring', async () => {
      const articles = [makeArticle(), makeArticle({ id: 'article-uuid-2' })];
      newsService.findUnscoredArticles.mockResolvedValue(articles);
      httpService.post.mockReturnValue(
        throwError(() => new Error('down')),
      );

      // Must complete without throwing
      await expect(sentimentService.updateMissingSentiments()).resolves.not.toThrow();
    });

    it('should do nothing when no unscored articles exist', async () => {
      newsService.findUnscoredArticles.mockResolvedValue([]);

      await sentimentService.updateMissingSentiments();

      expect(newsService.update).not.toHaveBeenCalled();
    });
  });
});

// ─── NewsService Unit Tests ──────────────────────────────────────────────────

describe('NewsService - sentiment methods', () => {
  let newsService: NewsService;

  const mockQueryBuilder: any = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
    getRawMany: jest.fn(),
    getMany: jest.fn(),
  };

  const mockRepo = {
    find: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsService,
        {
          provide: getRepositoryToken(News),
          useValue: mockRepo,
        },
      ],
    }).compile();

    newsService = module.get(NewsService);
    jest.clearAllMocks();
    mockRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
  });

  // ── findUnscoredArticles ──────────────────────────────────────────────────

  describe('findUnscoredArticles()', () => {
    it('should return only articles with null sentimentScore', async () => {
      const unscoredArticles = [makeArticle()];
      mockRepo.find.mockResolvedValue(unscoredArticles);

      const result = await newsService.findUnscoredArticles();

      expect(result).toEqual(unscoredArticles);
      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('should return empty array when all articles are scored', async () => {
      mockRepo.find.mockResolvedValue([]);
      const result = await newsService.findUnscoredArticles();
      expect(result).toEqual([]);
    });
  });

  // ── getSentimentSummary ───────────────────────────────────────────────────

  describe('getSentimentSummary()', () => {
    it('should return overall and bySource breakdown', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue({
        average: '0.4200',
        totalArticles: '10',
      });
      mockQueryBuilder.getRawMany.mockResolvedValue([
        { source: 'coindesk', averageScore: '0.6500', articleCount: '6' },
        { source: 'cointelegraph', averageScore: '0.1200', articleCount: '4' },
      ]);

      const result = await newsService.getSentimentSummary();

      expect(result.overall.averageSentiment).toBe(0.42);
      expect(result.overall.totalArticles).toBe(10);
      expect(result.bySource).toHaveLength(2);
      expect(result.bySource[0]).toEqual({
        source: 'coindesk',
        averageScore: 0.65,
        articleCount: 6,
      });
    });

    it('should return 0 for overall when no articles are scored', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue({
        average: null,
        totalArticles: '0',
      });
      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      const result = await newsService.getSentimentSummary();

      expect(result.overall.averageSentiment).toBe(0);
      expect(result.bySource).toEqual([]);
    });
  });

  // ── findBySentimentRange ──────────────────────────────────────────────────

  describe('findBySentimentRange()', () => {
    it('should return articles within the given score range', async () => {
      const articles = [makeArticle({ sentimentScore: 0.5 })];
      mockQueryBuilder.getMany.mockResolvedValue(articles);

      const result = await newsService.findBySentimentRange(0.3, 0.8);
      expect(result).toEqual(articles);
    });

    it('should exclude articles with null sentimentScore', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      const result = await newsService.findBySentimentRange(0, 1);
      expect(result).toEqual([]);

      // Verify IS NOT NULL guard was applied
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'news.sentimentScore IS NOT NULL',
      );
    });
  });
});