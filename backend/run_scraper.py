#!/usr/bin/env python3
"""
Standalone scraper runner. Called as a subprocess by main.py to avoid
macOS sandbox issues with Playwright inside FastAPI background tasks.

Usage: python run_scraper.py <url> <max_reviews>
Output: JSON array of reviews to stdout
"""
import asyncio
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from google_scraper import scrape_google_reviews

if __name__ == "__main__":
    url = sys.argv[1]
    max_reviews = int(sys.argv[2])
    reviews = asyncio.run(scrape_google_reviews(url, max_reviews))
    print(json.dumps(reviews))
