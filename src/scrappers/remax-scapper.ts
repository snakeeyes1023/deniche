import puppeteer from 'puppeteer';
import fs from 'fs';
import chalk from 'chalk';
import { JSDOM } from 'jsdom';
import { HouseType } from '../types/HouseType';
import { KnownDevices } from 'puppeteer';
import { logTrace } from '../utils/logger';

export async function webScrapeRemax(storePageResult : boolean = false): Promise<HouseType[]> {
    const iPhone = KnownDevices['iPhone 6'];

    logTrace('Starting web scraping');
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.emulate(iPhone);

    const remaxUrl = process.env.REMAX_URL;

    if (remaxUrl === undefined) {
        throw new Error('REMAX_URL is not defined');
    }

    logTrace(`Navigating to ${remaxUrl}`);
    await page.goto(remaxUrl, { waitUntil: 'domcontentloaded' });

    logTrace('Waiting 6 seconds for the page to load');
    await new Promise(r => setTimeout(r, 6000));
    logTrace('Page loaded');

    logTrace('Saving page content');
    const content = await page.content();
    const dom = new JSDOM(content);

    if (storePageResult) {
        await savePageContent(dom);
    }
    
    logTrace('Extracting houses');
    const houses = await extractHouses(dom);
    
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

    // save the content to a file with current date - time
    const date = new Date().toISOString().replace(/:/g, '-');
    fs.writeFileSync(`output/output-${date}.html`, content);
    logTrace('Page content saved');
}

async function extractHouses(page: JSDOM): Promise<HouseType[]> {

    const houses = page.window.document.querySelectorAll('.results-lists a.card-property-thumbnail--results-list');

    let houseList: HouseType[] = [];

    houses.forEach(house => {
        if (house === null) {
            throw new Error('House is null');
        }

        const title: string | null | undefined = house.querySelector('.property-details--title')?.textContent?.trim();
        const address: string | null | undefined = house.querySelector('.property-details--address')?.textContent?.trim();
        const price: string | null | undefined = house.querySelector('.property-details--price')?.textContent?.trim();

        const searchULS = () => {
            const uls = house.querySelector('.small.small--light');
            if (uls === null) {
                return;
            }
            const glsContent = uls.textContent;

            if (glsContent === null) {
                return;
            }

            const regex = /ULS: (\d+)/;
            const match = glsContent.match(regex);
            if (match === null) {
                return;
            }
            return match[1];
        }

        const searchTags = () => {
            const tags = house.querySelectorAll('.status-tag');
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

        houseList.push({
            id: searchULS() || "0",
            name: title || '',
            address: address || '',
            price: price || '',
            tags: searchTags() || []
        });
    });

    if (houseList.length === 0) {
        logTrace(chalk.yellow('No houses found'));
    }

    return houseList;
}