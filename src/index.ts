import { JSDOM } from 'jsdom';
import fs from 'fs';
import puppeteer from 'puppeteer';
import { KnownDevices } from 'puppeteer';
import * as dotenv from 'dotenv';
import { HouseType } from './types/HouseType';

dotenv.config();


async function webScrape(): Promise<void> {
    const iPhone = KnownDevices['iPhone 6'];
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.emulate(iPhone);

    const remaxUrl = process.env.REMAX_URL;

    if (remaxUrl === undefined) {
        throw new Error('REMAX_URL is not defined');
    }

    await page.goto(remaxUrl, { waitUntil: 'domcontentloaded' });

    await new Promise(r => setTimeout(r, 4000));

    const content = await page.content();

    const dom = new JSDOM(content);

    await browser.close();

    await savePageContent(dom);
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

    console.log('Page saved');

    const houses = await extractHouses(page);

    await saveHouses(houses);
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
        throw new Error('No houses found');
    }

    return houseList;
}

async function saveHouses(houses: HouseType[]): Promise<void> {

    // create the folder if it doesn't exist
    if (!fs.existsSync('output/extract')) {
        fs.mkdirSync('output/extract');
    }

    const date = new Date().toISOString().replace(/:/g, '-');
    fs.writeFileSync(`output/extract/houses-${date}.json`, JSON.stringify(houses, null, 2));
}

async function notifyChange(): Promise<void> {
    const files = fs.readdirSync('output/extract');

    if (files.length < 2) {
        console.log('No previous file to compare with');
        return;
    }

    const lastFile = files[files.length - 1];

    const content = fs.readFileSync(`output/extract/${lastFile}`, 'utf-8');

    const previousFile = files[files.length - 2];

    if (previousFile === undefined) {
        return;
    }

    const previousContent = fs.readFileSync(`output/extract/${previousFile}`, 'utf-8');

    const current = JSON.parse(content);
    const previous = JSON.parse(previousContent);

    const newHouses = current.filter((house: HouseType) => {
        return !previous.some((prevHouse: HouseType) => {
            return prevHouse.id === house.id;
        });
    }) as HouseType[];

    if (newHouses.length > 0) {
        console.log('New houses found');
        console.log(newHouses);
    }
    else {
        console.log('No new houses found');
    }

    const removedHouses = previous.filter((house: HouseType) => {
        return !current.some((currHouse: HouseType) => {
            return currHouse.id === house.id;
        });
    }) as HouseType[];

    if (removedHouses.length > 0) {
        console.log('Removed houses found');
        console.log(removedHouses);
    }
    else {
        console.log('No removed houses found');
    }
}

async function main(): Promise<void> {
    try {
        await webScrape();
        await notifyChange();
    } catch (error) {
        console.error(error);
    }
}

main();