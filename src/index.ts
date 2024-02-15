import fs from 'fs';
import * as dotenv from 'dotenv';
import { HouseType } from './types/HouseType';
import path from 'path';
import chalk from 'chalk';
import { webScrapeRemax } from './scrappers/remax-scapper';
import twilio from "twilio";

const dotenvAbsolutePath = path.join(__dirname, '../.env');

dotenv.config({
    path: dotenvAbsolutePath
});

async function saveHouses(houses: HouseType[]): Promise<void> {

    // create the folder if it doesn't exist
    if (!fs.existsSync('output/extract')) {
        fs.mkdirSync('output/extract');
    }

    const date = new Date().toISOString().replace(/:/g, '-');
    fs.writeFileSync(`output/extract/houses-${date}.json`, JSON.stringify(houses, null, 2));
    console.log(chalk.green('Houses saved'));
}

async function getChanges(): Promise<{
    newHouses: HouseType[],
    removedHouses: HouseType[]
}> {
    const files = fs.readdirSync('output/extract');

    if (files.length < 2) {
        console.log(chalk.yellow('No previous file to compare'));
        return {
            newHouses: [],
            removedHouses: []
        };
    }

    const lastFile = files[files.length - 1];

    const content = fs.readFileSync(`output/extract/${lastFile}`, 'utf-8');

    const previousFile = files[files.length - 2];

    if (previousFile === undefined) {
        throw new Error('Previous file is undefined');
    }

    const previousContent = fs.readFileSync(`output/extract/${previousFile}`, 'utf-8');

    const current = JSON.parse(content);
    const previous = JSON.parse(previousContent);

    const newHouses = current.filter((house: HouseType) => {
        return !previous.some((prevHouse: HouseType) => {
            return prevHouse.id === house.id;
        });
    }) as HouseType[];

    const removedHouses = previous.filter((house: HouseType) => {
        return !current.some((currHouse: HouseType) => {
            return currHouse.id === house.id;
        });
    }) as HouseType[];

    return {
        newHouses,
        removedHouses
    };
}


async function notifyChanges(newHouses: HouseType[], removedHouses: HouseType[]): Promise<void> {
    const twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
    );

    const handleUnique = (house: HouseType) => {
        return `${house.price} - ${house.name} - ${house.address}`;
    };

    const handleMultiple = (houses: HouseType[]) => {
        if (houses.length > 3) {
            return houses.slice(0, 3).map(house => handleUnique(house)).join('\n\n') + `\n\n et ${houses.length - 3} autres...`;
        }
        return houses.map(house => handleUnique(house)).join('\n\n');
    }

    const numbers = process.env.NOTIFY_PHONE_NUMBERS?.split(',') || [];

    if (newHouses.length > 0) {
        for (const number of numbers) {
            await twilioClient.messages.create({
                body: `Nouvelles maisons: \n ${handleMultiple(newHouses)}`,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: number
            });
        }
    }
}

async function main(): Promise<void> {
    try {
        const remaxHouses: HouseType[] = await webScrapeRemax();
        await saveHouses(remaxHouses);

        const {newHouses, removedHouses } = await getChanges();

        if (newHouses.length > 0) {
            console.log(chalk.green('New houses found'));
            console.log(newHouses);
        }

        if (removedHouses.length > 0) {
            console.log(chalk.red('Houses removed'));
            console.log(removedHouses);
        }

        if (process.env.TWILIO_PHONE_NUMBER && (newHouses.length > 0 || removedHouses.length > 0)) {
            await notifyChanges(newHouses, removedHouses);
        }

    } catch (error) {
        if (error instanceof Error) {
            console.error(chalk.red(error.message));
            return;
        }
        console.error(chalk.red('An error occurred'), error);
    }
}

main();