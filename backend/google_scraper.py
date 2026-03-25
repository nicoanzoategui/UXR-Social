import asyncio
import sys
from playwright.async_api import async_playwright
from datetime import datetime
import re
from typing import List, Dict, Optional
import os
import random

async def scrape_google_reviews(url: str, max_reviews: int = 50) -> List[Dict]:
    """
    Scrapes reviews from a Google Maps URL using Playwright.
    """
    reviews_data = []
    debug_dir = "debug_scrapes"
    os.makedirs(debug_dir, exist_ok=True)

    CHROME_CDP = "http://localhost:3007"

    async with async_playwright() as p:
        # Connect to Chrome for Testing via CDP (avoids macOS Mach port rendezvous crash).
        # Chrome is launched independently by start_project.sh with proper anti-bot flags.
        try:
            browser = await p.chromium.connect_over_cdp(CHROME_CDP, timeout=10000)
            print("Connected to Chrome via CDP.", file=sys.stderr)
        except Exception as e:
            print(f"Could not connect to Chrome CDP ({e}). Falling back to local Firefox.", file=sys.stderr)
            browser = await p.firefox.launch(headless=True)

        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            viewport={'width': 1280, 'height': 900},
            locale='es-AR',
        )

        # Spoof navigator.webdriver to avoid bot detection
        await context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
            window.chrome = { runtime: {} };
        """)

        page = await context.new_page()

        print(f"[{datetime.now().strftime('%H:%M:%S')}] Navigating to: {url}", file=sys.stderr)

        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=90000)
            await page.wait_for_timeout(5000)
        except Exception as e:
            print(f"Navigation error: {e}", file=sys.stderr)
            await browser.close()
            return []

        # --- 1. Dismiss consent / cookie dialogs ---
        consent_selectors = [
            'button:has-text("Aceptar todo")',
            'button:has-text("Accept all")',
            'button:has-text("Rechazar todo")',
            'button:has-text("Agree")',
            'button[aria-label*="Aceptar"]',
            'form[action*="consent"] button',
        ]
        for sel in consent_selectors:
            try:
                btn = page.locator(sel).first
                if await btn.is_visible(timeout=2000):
                    await btn.click()
                    await page.wait_for_timeout(2000)
                    print(f"Dismissed dialog: {sel}", file=sys.stderr)
                    break
            except Exception:
                pass

        # --- 2. Dismiss Maps-specific popups ---
        maps_dismiss = [
            'button[aria-label*="Cerrar"]',
            'button[jsaction*="close"]',
            'button:has-text("No, gracias")',
            'button:has-text("Más tarde")',
        ]
        for sel in maps_dismiss:
            try:
                btn = page.locator(sel).first
                if await btn.is_visible(timeout=2000):
                    await btn.click()
                    await page.wait_for_timeout(1000)
            except Exception:
                pass

        # --- 3. Ensure we're on the Maps Place page, not redirected to Search ---
        current_url = page.url
        print(f"Current URL after load: {current_url}", file=sys.stderr)

        # If redirected to google.com/search, navigate directly to maps.google.com
        if "/search" in current_url and "tbm=map" in current_url:
            print("Redirected to Google Search. Re-navigating to maps.google.com...", file=sys.stderr)
            maps_url = url.replace("www.google.com/maps", "maps.google.com/maps")
            try:
                await page.goto(maps_url, wait_until="domcontentloaded", timeout=60000)
                await page.wait_for_timeout(5000)
            except Exception as e:
                print(f"Re-navigation error: {e}", file=sys.stderr)

        # --- 4. Click the Reviews tab ---
        review_tab_selectors = [
            'button[aria-label*="Reseñas"]',
            'button[aria-label*="Reviews"]',
            'div[role="tab"]:has-text("Reseñas")',
            'div[role="tab"]:has-text("Reviews")',
            'button[data-tab-index="1"]',
            '.Gpq6kf button',   # Stars rating button in sidebar
            'span[aria-label*="estrellas"]',
        ]

        clicked_reviews = False
        for sel in review_tab_selectors:
            try:
                elem = page.locator(sel).first
                if await elem.is_visible(timeout=3000):
                    await elem.click()
                    await page.wait_for_timeout(4000)
                    clicked_reviews = True
                    print(f"Clicked reviews via: {sel}", file=sys.stderr)
                    break
            except Exception:
                pass

        if not clicked_reviews:
            print("Could not click reviews tab. Trying to scroll to reveal reviews...", file=sys.stderr)
            try:
                sidebar = page.locator('.m6QErb').first
                if await sidebar.is_visible(timeout=3000):
                    await sidebar.evaluate("el => el.scrollTop += 400")
                    await page.wait_for_timeout(2000)
            except Exception:
                pass

        # Save debug screenshot
        try:
            await page.screenshot(path=os.path.join(debug_dir, "hunting_test.png"))
        except Exception:
            pass

        # --- 5. Scroll and collect reviews ---
        # Current Google Maps review selectors (2024-2025)
        REVIEW_SELECTOR = '[data-review-id]'

        scraped_ids: set = set()
        no_new_count = 0

        while len(reviews_data) < max_reviews and no_new_count < 8:
            elements = page.locator(REVIEW_SELECTOR)
            count = await elements.count()
            print(f"Found {count} review elements...", file=sys.stderr)

            if count == 0:
                no_new_count += 1
                await page.wait_for_timeout(2000)
                continue

            found_new = False
            for i in range(count):
                if len(reviews_data) >= max_reviews:
                    break

                review = elements.nth(i)
                review_id = await review.get_attribute("data-review-id") or f"r_{i}"

                if review_id in scraped_ids:
                    continue

                found_new = True
                scraped_ids.add(review_id)

                try:
                    # Expand full text if there's a "Más" button
                    more_btn = review.locator('button[aria-label*="Más"], button:has-text("Más"), [jsaction*="review.expandReview"]').first
                    if await more_btn.count() > 0:
                        try:
                            await more_btn.click(timeout=1000)
                            await page.wait_for_timeout(300)
                        except Exception:
                            pass

                    # Author
                    author_el = review.locator('.d4r55, .TSv7u, [class*="fontHeadlineSmall"]').first
                    author = (await author_el.inner_text()).strip() if await author_el.count() > 0 else "Anonymous"

                    # Text
                    text_el = review.locator('.wiI7pw, .MyEned, [class*="review-full-text"], span[jsname="bN97Pc"]').first
                    text = (await text_el.inner_text()).strip() if await text_el.count() > 0 else ""

                    # Rating
                    rating = 5.0
                    rating_el = review.locator('span[role="img"][aria-label*="estrellas"], span[role="img"][aria-label*="stars"]').first
                    if await rating_el.count() > 0:
                        aria = await rating_el.get_attribute("aria-label") or ""
                        m = re.search(r'(\d+)[,.]?(\d*)', aria)
                        if m:
                            rating = float(f"{m.group(1)}.{m.group(2) or '0'}")

                    # Date
                    date_el = review.locator('.rsqaWe, .dehysf').first
                    date_str = (await date_el.inner_text()).strip() if await date_el.count() > 0 else "recently"

                    if text or author != "Anonymous":
                        reviews_data.append({
                            "comment_id": f"google_{review_id}",
                            "author_name": author,
                            "comment_text": text,
                            "comment_date_str": date_str,
                            "rating": rating,
                            "network": "Google",
                            "account_name": "Google Maps",
                        })
                        print(f"Scraped: {author[:30]} | {text[:50]}...", file=sys.stderr)

                except Exception as e:
                    print(f"Skipping review {i}: {e}", file=sys.stderr)
                    continue

            if not found_new:
                no_new_count += 1
            else:
                no_new_count = 0

            # Scroll the reviews panel to load more
            try:
                panel = page.locator('.m6QErb[aria-label], .DxyBCb').first
                if await panel.count() > 0:
                    await panel.evaluate("el => el.scrollTop += 1200")
                else:
                    await page.mouse.wheel(0, random.randint(800, 1500))
            except Exception:
                await page.mouse.wheel(0, random.randint(800, 1500))

            await page.wait_for_timeout(random.randint(1200, 2000))

        await browser.close()
        print(f"Completed scrape. Total reviews: {len(reviews_data)}", file=sys.stderr)

    return reviews_data


if __name__ == "__main__":
    url = "https://www.google.com/maps/place/UTN+FRBA/@-34.5984756,-58.420138,17z/data=!4m8!3m7!1s0x95bccb29a8a81745:0x228e93816431940!8m2!3d-34.5984756!4d-58.4175631!9m1!1b1!16s%2Fg%2F12270ytm?entry=ttu"
    results = asyncio.run(scrape_google_reviews(url, 5))
    print(f"Final Count: {len(results)}")
    for r in results:
        print(f"Author: {r['author_name']} | Text: {r['comment_text'][:50]}...")
