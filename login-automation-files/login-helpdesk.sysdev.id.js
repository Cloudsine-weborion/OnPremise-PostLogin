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

// Helper function to wait for and interact with an element using a CSS selector
async function waitAndInteract(page, selector, action, value = null) {
    try {
        await page.waitForSelector(selector, { visible: true });
        const element = await page.$(selector);
        if (element) {
            if (action === 'type') {
                await element.type(value);
            } else if (action === 'click') {
                await element.click();
            }
        } else {
            throw new Error(`Element not found: ${selector}`);
        }
    } catch (error) {
        throw new Error(`Error interacting with element (${selector}): ${error.message}`);
    }
}

// Helper function to log in using username and password
async function performLogin(page, username, password) {
    const usernameSelector = '#username';
    const passwordSelector = '#password';
    const signInButtonSelector = '#sso-login';

    console.log("Typing username...");
    await waitAndInteract(page, usernameSelector, 'type', username);

    console.log("Typing password...");
    await waitAndInteract(page, passwordSelector, 'type', password);

    console.log("Clicking the Sign-In button...");
    await waitAndInteract(page, signInButtonSelector, 'click');

    console.log("Waiting for navigation...");
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 });
}

// Helper function to capture and save cookies
async function captureCookies(page, expectedUrl, cookieFilePath) {
    await page.waitForTimeout(5000); // Wait for potential redirection

    if (page.url() === expectedUrl) {
        const cookies = await page.cookies();
        const csrfToken = cookies.find((c) => c.name === '__Host-next-auth.csrf-token');
        const callbackUrl = cookies.find((c) => c.name === '__Secure-next-auth.callback-url');
        const sessionToken = cookies.find((c) => c.name === '__Secure-next-auth.session-token');

        if (csrfToken && callbackUrl && sessionToken) {
            fs.writeFileSync(cookieFilePath, JSON.stringify({ csrfToken, callbackUrl, sessionToken }, null, 2));
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
    const initialUrl = 'https://helpdesk.sysdev.id';
    const expectedUrl = 'https://othdesk.id/';
    const cookieFilePath = './cookies/helpdesk.sysdev.id.json';

    let attempts = 0;
    const maxAttempts = 3;
    let success = false;

    while (attempts < maxAttempts && !success) {
        const browser = await initializeBrowser(proxyServer, userAgent);
        const page = await browser.newPage();

        page.on('response', async (response) => {
            if ([301, 302].includes(response.status())) {
                console.log(`Redirected to: ${response.headers()['location']}`);
            }
        });

        try {
            console.log(`Attempt ${attempts + 1} to log in...`);

            await page.goto(initialUrl, { waitUntil: 'networkidle2' });

            // Click the login button
            const loginButtonSelector = '.MuiButton-text'; // Update with correct selector
            console.log("Clicking the login button...");
            await waitAndInteract(page, loginButtonSelector, 'click');

            // Wait for redirection to complete
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });

            // Fill in username and password on the login page
            const username = process.env.HELPDESK_USERNAME;
            const password = process.env.HELPDESK_PASSWORD;
            console.log("Performing login...");
            await performLogin(page, username, password);

            // Capture and save cookies on the final page
            console.log("Capturing cookies...");
            await captureCookies(page, expectedUrl, cookieFilePath);

            console.log(`Final: ${page.url()}`);
            success = true; // Mark success if no error occurs
        } catch (error) {
            console.error(`Error during attempt ${attempts + 1}: ${error.message}`);
        } finally {
            await browser.close();
            attempts++;
        }
    }

    if (!success) {
        console.error(`Failed to complete the login process after ${maxAttempts} attempts.`);
    }
})();
