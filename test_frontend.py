import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        
        errors = []
        page.on("pageerror", lambda err: errors.append(err.message))
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        
        print("Navigating to http://localhost:4173...")
        response = await page.goto('http://localhost:4173')
        print(f"Status Code: {response.status}")
        
        await page.wait_for_timeout(3000)
        
        title = await page.title()
        print(f"Page Title: {title}")
        
        kpi_tiles = await page.locator(".text-\\[10px\\].uppercase").count()
        print(f"KPI Tiles found: {kpi_tiles}")
        
        if errors:
            print("Console Errors found:")
            for e in errors:
                print(e)
        else:
            print("No console errors! App rendered successfully.")
            
        await browser.close()

asyncio.run(main())
