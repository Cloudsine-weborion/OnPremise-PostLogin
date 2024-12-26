const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
require('dotenv').config();

// Add the stealth plugin to Puppeteer
puppeteer.use(StealthPlugin());

// Helper function to initialize Puppeteer
async function initializeBrowser(proxyServer, userAgent) {
    return puppeteer.launch({
        args: [
            '--no-sandbox',
            '--disable-gpu',
            `--user-agent=${userAgent}`
        ],
        headless: true
    });
}

// Helper function to wait for and interact with an element using XPath
async function waitAndInteract(page, xpath, action, value = null) {
    try {
        await page.waitForXPath(xpath, { visible: true });
        const [element] = await page.$x(xpath);
        if (element) {
            if (action === 'type') {
                await element.type(value);
            } else if (action === 'click') {
                await element.click();
            }
        } else {
            throw new Error(`Element not found: ${xpath}`);
        }
    } catch (error) {
        throw new Error(`Error interacting with element: ${error.message}`);
    }
}

// Helper function to log in using username and password
async function performLogin(page, username, password) {
    const usernameXPath = '//*[@id="username"]';
    const passwordXPath = '//*[@id="password"]';
    const signInButtonXPath = '//*[@id="sso-login"]';

    await waitAndInteract(page, usernameXPath, 'type', username);
    await waitAndInteract(page, passwordXPath, 'type', password);
    await waitAndInteract(page, signInButtonXPath, 'click');

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
}

// Helper function to capture and save cookies
async function captureCookies(page, expectedUrl, cookieFilePath) {
    await page.waitForTimeout(15000); // Wait for potential redirection

    if (page.url() === expectedUrl) {
        const cookies = await page.cookies();
        const sessionCookie = cookies.find((c) => c.name === 'bdi_session');
        const xsrfToken = cookies.find((c) => c.name === 'XSRF-TOKEN');

        if (sessionCookie && xsrfToken) {
            fs.writeFileSync(cookieFilePath, JSON.stringify({ sessionCookie, xsrfToken }, null, 2));
            console.log(`Cookies saved to ${cookieFilePath}`);
        } else {
            console.error("Required cookies not found.");
        }
    } else {
        console.error(`Unexpected final URL: ${page.url()}`);
    }
}

// Main function
(async () => {
    const proxyServer = 'socks5://10.103.253.134:1080';
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36';
    const initialUrl = 'https://single.sysdev.id';
    const expectedUrl = 'https://landing.othdesk.id/home'; // Replace with the actual final URL
    const cookieFilePath = './cookies/single.sysdev.id.json';

    const browser = await initializeBrowser(proxyServer, userAgent);
    const page = await browser.newPage();

    page.on('response', async (response) => {
        if ([301, 302].includes(response.status())) {
            console.log(`Redirected to: ${response.headers()['location']}`);
        }
    });

    try {
        console.log("Navigating to initial page...");
        await page.goto(initialUrl, { waitUntil: 'networkidle2' });

        // Click the redirect link
        const redirectLinkXPath = '/html/body/div/a';
        console.log("Clicking the redirect link...");
        await waitAndInteract(page, redirectLinkXPath, 'click');

        // Wait for redirection to complete
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });

        // Fill in username and password on the login page
        console.log("Performing login...");
        const username = process.env.EDMINFO_USERNAME;
        const password = process.env.EDMINFO_PASSWORD;
        await performLogin(page, username, password);

        // Capture and save cookies on the final page
        console.log("Capturing cookies...");
        await captureCookies(page, expectedUrl, cookieFilePath);

        console.log(`Final page: ${page.url()}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
    } finally {
        await browser.close();
    }
})();
