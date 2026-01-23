"""
Data ingestion module for fetching external data.
"""

from .news_fetcher import NewsFetcher, NewsArticle, fetch_news

__all__ = ['NewsFetcher', 'NewsArticle', 'fetch_news']