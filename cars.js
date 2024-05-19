import puppeteer from 'puppeteer';

const URL = 'https://www.sixtcarsales.de/suchergebnisse/';
const DISCOUNT_PERCENTAGE = 30; // Prozent anpassen

const extractCarsFromPage = async (page) => {
  return await page.evaluate((discount) => {
    const carElements = document.querySelectorAll('main > div:nth-of-type(2) > section:nth-of-type(2) > div > ul > li');
    const cars = [];
    carElements.forEach((carElement) => {
      const carName = carElement.querySelector('a > div:nth-of-type(2) > div:nth-of-type(1)').innerText.trim();
      const carPrice = carElement.querySelector('a > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(1) > div > span:nth-of-type(1)').innerText.trim();
      const carLocation = carElement.querySelector('a > div:nth-of-type(2) > div:nth-of-type(3) > ul:nth-of-type(1) > li:nth-of-type(1)').innerText.trim();
      const carFirstRegistration = carElement.querySelector('a > div:nth-of-type(2) > div:nth-of-type(3) > ul:nth-of-type(1) > li:nth-of-type(2)').innerText.trim();
      const carMileage = carElement.querySelector('a > div:nth-of-type(2) > div:nth-of-type(3) > ul:nth-of-type(1) > li:nth-of-type(3)').innerText.trim();
      const carOfferNumber = carElement.querySelector('a > div:nth-of-type(2) > div:nth-of-type(3) > ul:nth-of-type(1) > li:nth-of-type(4)').innerText.trim();
      const carFuel = carElement.querySelector('a > div:nth-of-type(2) > div:nth-of-type(3) > ul:nth-of-type(2) > li:nth-of-type(1)').innerText.trim();
      const carPS = carElement.querySelector('a > div:nth-of-type(2) > div:nth-of-type(3) > ul:nth-of-type(2) > li:nth-of-type(2)').innerText.trim();
      const carBodyType = carElement.querySelector('a > div:nth-of-type(2) > div:nth-of-type(3) > ul:nth-of-type(2) > li:nth-of-type(3)').innerText.trim();
      const carTransmission = carElement.querySelector('a > div:nth-of-type(2) > div:nth-of-type(3) > ul:nth-of-type(2) > li:nth-of-type(4)').innerText.trim();
      const carImageUrl = carElement.querySelector('a > div:nth-of-type(1) > picture > img').getAttribute('src');

      const priceNumber = parseFloat(carPrice.replace(/[^\d,]/g, '').replace(',', '.'));
      const discountedPrice = priceNumber * (1 - discount / 100);

      const formatPrice = (price) => {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(price).replace('€', '').trim();
      };

      cars.push({
        'NAME': carName,
        'PREIS': formatPrice(priceNumber),
        'RABATT': formatPrice(discountedPrice),
        'STANDORT': carLocation,
        'ERSTZULASSUNG': carFirstRegistration,
        'KILOMETERSTAND': carMileage,
        'ANGEBOTSNUMMER': carOfferNumber,
        'KRAFTSTOFF': carFuel,
        'PS': carPS,
        'KAROSSERIEFORM': carBodyType,
        'GETRIEBE': carTransmission,
        'BILD_URL': carImageUrl,
      });
    });
    return cars;
  }, DISCOUNT_PERCENTAGE);
};

const loadAllCars = async () => {
  const browser = await puppeteer.launch({ headless: true }); // Start browser with GUI
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: 'networkidle2' });

  let cars = [];
  let pageCount = 1;

  while (true) {
    console.log(`Extracting cars from page ${pageCount}`);
    const carsFromPage = await extractCarsFromPage(page);
    cars = cars.concat(carsFromPage);

    try {
      // Check for the "next" button
      await page.waitForSelector('a.e-button-rect.-size-2.-white.-icon.-arrow_right[href]', { timeout: 10000 });
      const nextButton = await page.$('a.e-button-rect.-size-2.-white.-icon.-arrow_right[href]');
      const nextHref = await nextButton.evaluate(node => node.getAttribute('href'));
      if (!nextHref) {
        console.log('No more next href found');
        break;
      }

      const nextPageUrl = new URL(nextHref, page.url()).href;

      console.log('Navigating to next page:', nextPageUrl);
      await page.goto(nextPageUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      await page.waitForTimeout(3000); // Explicit wait time to ensure page load
    } catch (error) {
      console.error(`Error navigating to next page or waiting for selector: ${error}`);
      break;
    }
    pageCount++;
  }

  await browser.close();
  return cars;
};

export default async function handler(req, res) {
  try {
    const cars = await loadAllCars();
    const carCount = cars.length;
    const carsJson = { 'FAHRZEUGE': carCount };

    cars.forEach((car, index) => {
      carsJson[index + 1] = car;
    });

    res.status(200).json(carsJson);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
