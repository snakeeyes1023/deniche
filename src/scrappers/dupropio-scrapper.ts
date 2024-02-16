import puppeteer from 'puppeteer';
import fs from 'fs';
import chalk from 'chalk';
import { JSDOM } from 'jsdom';
import { HouseType } from '../types/HouseType';
import { logTrace } from '../utils/logger';

export async function webScrapeDupropio(storePageResult: boolean = false): Promise<HouseType[]> {

    logTrace('Starting web scraping');
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    const dupropioUrl = process.env.DUPROPIO_URL;

    if (dupropioUrl === undefined) {
        throw new Error('DUPROPIO_URL is not defined');
    }

    logTrace(`Navigating to ${dupropioUrl}`);
    await page.goto(dupropioUrl, { waitUntil: 'domcontentloaded' });

    logTrace('Extracting houses');

    let hasOtherHouse = true;
    let previousUrl = '';

    let houses: HouseType[] = [];

    // todo : passer par l'url pour le changement de page.
    try {
        while (true) {
            logTrace('Waiting 6 seconds for the page to load');
            await new Promise(r => setTimeout(r, 6000));
            logTrace('Page loaded');

            logTrace('Saving page content');
            const content = await page.content();
            const dom = new JSDOM(content);

            if (storePageResult) {
                await savePageContent(dom);
            }

            const housesOnPage = await extractHouses(dom);
            houses = houses.concat(housesOnPage);

            const nextButton = dom.window.document.querySelector('nav.pagination .pagination__arrow--right a');

            if (nextButton === null) {
                hasOtherHouse = false;
            } else {
                logTrace('Clicking next button');
                page.click('nav.pagination .pagination__arrow--right a');
                await new Promise(r => setTimeout(r, 3000));
                const currentUrl = page.url();
                
                if (currentUrl === previousUrl) {
                    hasOtherHouse = false;
                    logTrace('No more houses to extract');
                    break;
                }

                previousUrl = currentUrl;
                
                logTrace(`Navigating to ${currentUrl}`);
            }
        }

    } catch (error) {
        logTrace('Error while extracting houses');
        if (houses.length === 0) {
            throw error;
        }
    }

    logTrace('Closing browser');
    await browser.close();

    return houses;
}

async function savePageContent(page: JSDOM): Promise<void> {
    const content = page.serialize();

    // create the folder if it doesn't exist
    if (!fs.existsSync('output')) {
        fs.mkdirSync('output');
    }

    if (!fs.existsSync('output/duproprio')) {
        fs.mkdirSync('output/duproprio');
    }


    // save the content to a file with current date - time
    const date = new Date().toISOString().replace(/:/g, '-');
    fs.writeFileSync(`output/duproprio/output-${date}.html`, content);
    logTrace('Page content saved');
}

async function extractHouses(page: JSDOM): Promise<HouseType[]> {

    const houses = page.window.document.querySelectorAll('ul.search-results-listings-list li.search-results-listings-list__item');

    let houseList: HouseType[] = [];

    houses.forEach(house => {
        if (house === null) {
            throw new Error('House is null');
        }

        const link = house.querySelector('a.search-results-listings-list__item-image-link')?.getAttribute('href');
        const title: string | null | undefined = house.querySelector('.search-results-listings-list__item-description__type-and-intro')?.textContent?.trim()?.split('–')[0]?.trim();
        const city: string | null | undefined = house.querySelector('.search-results-listings-list__item-description__city')?.textContent?.trim();
        const address: string | null | undefined = house.querySelector('.search-results-listings-list__item-description__address')?.textContent?.trim() + ', ' + city;
        const price: string | null | undefined = house.querySelector('.search-results-listings-list__item-description__price')?.textContent?.trim();

        const imageSrc = house.querySelector('.search-results-listings-list__item-photo')?.getAttribute('src');

        const isSold = house.querySelector('.search-results-listings-list__item-sold') !== null;

        const searchULS = () => {
            const uls = house.querySelector('a.search-results-listings-list__item-image-link');
            if (uls === null) {
                return;
            }
            const glsContent = uls.getAttribute('name');

            if (glsContent === null) {
                return;
            }

            //listing-1065226
            const regex = /listing-(\d+)/;
            const match = glsContent.match(regex);
            if (match === null) {
                return;
            }
            return match[1];
        }

        const searchTags = () => {
            const tags = house.querySelectorAll('.search-results-listings-list__tag');
            if (tags === null) {
                return;
            }

            let tagsList: string[] = [];

            tags.forEach(tag => {
                if (tag.textContent === null) {
                    return;
                }
                tagsList.push(tag.textContent.trim());
            });

            return tagsList;
        }

        if (isSold) {
            logTrace(chalk.yellow(`House ${title} is sold`));
            return;
        }

        if (link === null || link == undefined) {
            logTrace(chalk.yellow(`House ${title} has no link`));
            return;
        }


        houseList.push({
            id: searchULS() || "0",
            name: title || '',
            address: address || '',
            price: price || '',
            tags: searchTags() || [],
            owner: "DuProprio",
            link: link || '',
            imageSrc: imageSrc || ''
        });
    });

    if (houseList.length === 0) {
        logTrace(chalk.yellow('No houses found'));
    }

    return houseList;
}