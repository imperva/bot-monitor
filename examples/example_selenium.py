import os
from selenium import webdriver
from selenium.webdriver.common.keys import Keys
import time


def main():
    print(os.getpid())
    input ("Inject the bot-monitor script and press any key")
 
    driver = webdriver.Chrome('chromedriver.exe')
    
    time.sleep(1)
    driver.get('https://www.example.com')
    time.sleep(1)
    driver.close()   
 
 
 if __name__ == '__main__':
    main()
