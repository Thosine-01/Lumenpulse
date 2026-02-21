import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

import { firstValueFrom } from 'rxjs';
import { NewsService } from './news.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class NewsSentimentService {
  private readonly logger = new Logger(NewsSentimentService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly newsService: NewsService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Calls Python sentiment API
   */
  async analyzeSentiment(text: string): Promise<number | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${process.env.PYTHON_SERVICE_URL}/sentiment`,
          { text },
        ),
      );

      return response.data.score; // expects -1 to 1
    } catch (error) {
      this.logger.error('Sentiment service unavailable');
      return null; // IMPORTANT: never throw
    }
  }

  /**
   * Bulk sentiment updater (Cron job)
   */
    @Cron(CronExpression.EVERY_10_MINUTES)
  async updateMissingSentiments() {
    this.logger.log('Running sentiment update job...');


    const articlesWithoutSentiment =
      await this.newsService.findUnscoredArticles();

    for (const article of articlesWithoutSentiment) {
      const score = await this.analyzeSentiment(article.title);

      if (score !== null) {
        await this.newsService.update(article.id, { sentimentScore: score });
      } else {
        this.logger.warn(`Failed to score article: ${article.id}`);
      }
    }

    this.logger.log(
      `Sentiment update done. Processed: ${articlesWithoutSentiment.length} articles.`,
    );
  }
}