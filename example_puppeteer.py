import asyncio
import os
from pyppeteer import launch
import time


async def main():
    print(os.getpid())
    input ("Inject the bot-monitor script and press any key")
 
    browser = await launch({"headless":False})
    page = await browser.newPage()
    time.sleep(3)
    await page.goto('about:blank')
    time.sleep(1000)
    await browser.close()   
 
asyncio.run(main())   
