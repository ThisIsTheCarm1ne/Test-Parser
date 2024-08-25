import puppeteer from "puppeteer";
import fs from 'fs';

const URL = process.argv[2];
const region = process.argv[3];

if (!URL || !region) {
  console.error('URL or region wasn\'t specified. \nUsage: node index.js <URL> <Region>')
  process.exit(1);
}

writeDataToFile(await scrapePage(URL, region));

// Function launches puppeteer
// Which takes a screenshot of a page (passed by URL)
// And scrapes:
// price
// priceOld (if present)
// rating
// reviewCount
async function scrapePage(URL, region) {
  // when I launch it headless it works
  // in absolutley unpredictable way
  const browser = await puppeteer.launch( {headless: false} );
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080});

  await page.goto(URL);

  // This function takes CSS selector as an argument
  // Waits until element is visible on website
  // Checks if element exists
  // If exists - returns text inside element
  // If not - returns - null
  async function extractDataFromElements(selector) {
    const element = await safeQuerySelector(selector);

    if (element === null) {
      return null;
    }

    const text = await element.evaluate(el => el.textContent.trim());
    
    // Regex to get only numbers
    return text.match(/\d+(\.\d+)?/)[0];
  }

  // helper Function that detects if the element exists
  async function safeQuerySelector(selector) {
    try {
      await page.waitForSelector(selector, { timeout: 30000 });
      return await page.$(selector); // Return the element handle if found
    } catch (error) {
      console.log(`No element found for selector: ${selector}`);
      return null
    }
  }

  // Changes region on selected
  // by clicking on div
  // and accessing popup
  await page.waitForSelector('.Region_region__6OUBn > span:nth-child(2)', {
    visible: true,
  });

  await page.waitForNavigation({ waitUntil: 'domcontentloaded' });

  await page.evaluate(() => {
    document.querySelector('.Region_region__6OUBn').click();
  });

  await page.waitForSelector('.UiRegionListBase_list__cH0fK', {
    visible: true,
  });

  // Get the list of regions
  const regionList = await page.$$('.UiRegionListBase_list__cH0fK li.UiRegionListBase_item___ly_A', {
    visible: true
  });

  // Loop through list of regions
  // Checks if the region from list matches user input
  // clicks on it
  // Waits for the page to reload
  for (let regionFromList of regionList) {
    const regionText = await regionFromList.evaluate(el => el.textContent.trim());

    if (regionText === region) {
      await page.evaluate(element => {
        element.click();
      }, regionFromList);

      break;
    }
  }

  let price = await extractDataFromElements('.ProductPage_buyBlockDesktop__PIIyz > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > span:nth-child(2)');
  const priceOld = await extractDataFromElements('.ProductPage_buyBlockDesktop__PIIyz > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > span:nth-child(1)');
  // if there is no discount - it should select through alternative css selector
  if (price === null) {
    price = await extractDataFromElements('.ProductPage_buyBlockDesktop__PIIyz > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > span:nth-child(1)');
  }
  const rating = await extractDataFromElements('div.Summary_reviewsContainer__qTWIu:nth-child(6) > div:nth-child(1) > div:nth-child(1)');
  const reviewCount = await extractDataFromElements('div.Summary_reviewsContainer__qTWIu:nth-child(7) > div:nth-child(1) > div:nth-child(1)');

  // takes a screenshot of the entire page
  await page.screenshot( {path: 'screenshot.jpg', fullPage: true} );

  await browser.close();

  return {
    price: price,
    priceOld: priceOld,
    rating: rating,
    reviewCount: reviewCount
  }
}

// Function converts given object to json 
// and writes it to .txt file
function writeDataToFile(data) {
  // print with 2-space indentation
  const dataJsonConverted = JSON.stringify(data, null, 2);

  fs.writeFileSync('product.txt', dataJsonConverted, 'utf8');
}
