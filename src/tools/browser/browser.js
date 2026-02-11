import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { logger } from '../../utils/logger.js';
import { BROWSER_DEFAULT_TIMEOUT_MS, BROWSER_MAX_CONTENT_LENGTH, BROWSER_VIEWPORT } from '../../config.js';

// Apply stealth plugin — patches all common detection vectors
chromium.use(StealthPlugin());

// Singleton browser session manager
const session = {
    browser: null,
    context: null,
    page: null
};

// Human-like delays
const humanDelay = (min = 50, max = 200) => {
    return new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min) + min)));
};

// Launch or return existing stealth browser
const ensureBrowser = async () => {
    // Reuse existing browser and page if still connected
    if (session.browser?.isConnected()) return session.page;
    logger.info('Launching stealth browser');

    // Launch a new browser instance with stealth settings
    session.browser = await chromium.launch({
        headless: true,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-infobars',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-dev-shm-usage',
            '--window-size=1920,1080'
        ]
    });

    // Create a new browser context with additional stealth options
    session.context = await session.browser.newContext({
        viewport: BROWSER_VIEWPORT,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        locale: 'en-US',
        timezoneId: 'America/New_York',
        deviceScaleFactor: 1,
        hasTouch: false,
        javaScriptEnabled: true,
        bypassCSP: false,
        ignoreHTTPSErrors: false
    });

    // Inject extra stealth patches into every new page
    await session.context.addInitScript(() => {
        // Override webdriver flag
        Object.defineProperty(navigator, 'webdriver', { get: () => false });

        // Chrome runtime stub
        window.chrome = { runtime: {}, loadTimes: () => ({}), csi: () => ({}) };

        // Fake plugins
        Object.defineProperty(navigator, 'plugins', {
            get: () => [
                { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
                { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
                { name: 'Native Client', filename: 'internal-nacl-plugin' }
            ]
        });

        // Fake languages
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });

        // Permissions API patch
        const originalQuery = window.navigator.permissions?.query?.bind(window.navigator.permissions);
        if (originalQuery) {
            window.navigator.permissions.query = params =>
                params.name === 'notifications'
                    ? Promise.resolve({ state: Notification.permission })
                    : originalQuery(params);
        }
    });

    // Create a new page in the context
    session.page = await session.context.newPage();
    session.page.setDefaultTimeout(BROWSER_DEFAULT_TIMEOUT_MS);

    // Return the page
    return session.page;
};

// Human-like mouse movement to an element before interacting
const humanMove = async (page, selector) => {
    const element = await page.waitForSelector(selector, { timeout: BROWSER_DEFAULT_TIMEOUT_MS });

    // Get element's bounding box for movement
    const box = await element.boundingBox();
    if (box) {
        // Move mouse to a random point within the element
        const x = box.x + box.width * (0.3 + Math.random() * 0.4);
        const y = box.y + box.height * (0.3 + Math.random() * 0.4);
        await page.mouse.move(x, y, { steps: 5 + Math.floor(Math.random() * 10) });
        await humanDelay(30, 100);
    }

    // Return the element handle for chaining
    return element;
};

/**************************** Browser Tools ****************************/

// Navigate to URL
export const browserOpenTool = {
    // Tool definition
    name: 'browser_open',
    description: 'Open a URL in the stealth browser (launches browser if not running). Returns the page text content.',
    parameters: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description: 'URL to navigate to.'
            },
            waitUntil: {
                type: 'string',
                enum: ['load', 'domcontentloaded', 'networkidle'],
                description: 'When to consider navigation complete. Default: domcontentloaded.'
            }
        },
        required: ['url']
    },

    // Main execution function
    execute: async args => {
        const { url, waitUntil = 'domcontentloaded' } = args;

        try {
            new URL(url);
        } catch {
            return { success: false, error: 'Invalid URL format' };
        }

        logger.debug(`Browser navigating to: ${url}`);

        try {
            // Ensure browser is launched and get the page instance
            const page = await ensureBrowser();
            await page.goto(url, { waitUntil, timeout: BROWSER_DEFAULT_TIMEOUT_MS });
            await humanDelay(500, 1500);

            // Extract page title and text content
            const title = await page.title();
            let content = await page.innerText('body').catch(() => '');
            if (content.length > BROWSER_MAX_CONTENT_LENGTH) {
                content = content.slice(0, BROWSER_MAX_CONTENT_LENGTH) + '\n... (content truncated)';
            }

            // Return success with page info and content
            return {
                success: true,
                output: `Navigated to: ${url}\nTitle: ${title}\nURL: ${page.url()}\n\n${content}`
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error(`Browser open error: ${message}`);
            return { success: false, error: `Failed to open URL: ${message}` };
        }
    }
};

// Click an element
export const browserClickTool = {
    // Tool definition
    name: 'browser_click',
    description: 'Click an element on the page. Supports CSS selectors and text selectors like text="Login".',
    parameters: {
        type: 'object',
        properties: {
            selector: {
                type: 'string',
                description: 'CSS selector or Playwright text selector (e.g. text="Submit", button:has-text("OK")).'
            }
        },
        required: ['selector']
    },

    // Main execution function
    execute: async args => {
        const { selector } = args;
        logger.debug(`Browser clicking: ${selector}`);

        try {
            // Click the element with human-like movement and delay
            const page = await ensureBrowser();
            await humanMove(page, selector);
            await humanDelay(50, 150);
            await page.click(selector);
            await humanDelay(300, 800);

            // Wait for any navigation triggered by the click
            await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => { });

            // Return success with current page info
            const title = await page.title();
            return {
                success: true,
                output: `Clicked: ${selector}\nCurrent page: ${title} (${page.url()})`
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error(`Browser click error: ${message}`);
            return { success: false, error: `Failed to click "${selector}": ${message}` };
        }
    }
};

// Type text into an input
export const browserTypeTool = {
    // Tool definition
    name: 'browser_type',
    description: 'Type text into an input field with human-like keystroke delays. Clicks the element first.',
    parameters: {
        type: 'object',
        properties: {
            selector: {
                type: 'string',
                description: 'CSS selector of the input element.'
            },
            text: {
                type: 'string',
                description: 'Text to type.'
            },
            clear: {
                type: 'boolean',
                description: 'Clear the field before typing. Default: true.'
            },
            pressEnter: {
                type: 'boolean',
                description: 'Press Enter after typing. Default: false.'
            }
        },
        required: ['selector', 'text']
    },

    // Main execution function
    execute: async args => {
        const { selector, text, clear = true, pressEnter = false } = args;
        logger.debug(`Browser typing into: ${selector}`);

        try {
            // Click the element to focus it
            const page = await ensureBrowser();
            await humanMove(page, selector);
            await page.click(selector);
            await humanDelay(100, 300);

            // Clear existing content if requested
            if (clear) {
                await page.fill(selector, '');
                await humanDelay(50, 150);
            }

            // Type with human-like delay between keystrokes
            await page.type(selector, text, { delay: 30 + Math.random() * 80 });

            // Optionally press Enter after typing
            if (pressEnter) {
                await humanDelay(200, 500);
                await page.keyboard.press('Enter');
            }

            // Return success with info about the action
            return {
                success: true,
                output: `Typed ${text.length} characters into: ${selector}${pressEnter ? ' (pressed Enter)' : ''}`
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error(`Browser type error: ${message}`);
            return { success: false, error: `Failed to type into "${selector}": ${message}` };
        }
    }
};

// Take a screenshot
export const browserScreenshotTool = {
    // Tool definition
    name: 'browser_screenshot',
    description: 'Take a screenshot of the current page or a specific element. Returns base64-encoded PNG.',
    parameters: {
        type: 'object',
        properties: {
            selector: {
                type: 'string',
                description: 'CSS selector of element to screenshot (optional, defaults to full page).'
            },
            fullPage: {
                type: 'boolean',
                description: 'Capture the full scrollable page. Default: false.'
            }
        },
        required: []
    },

    // Main execution function
    execute: async args => {
        const { selector, fullPage = false } = args;
        logger.debug(`Browser screenshot${selector ? ` of: ${selector}` : ''}`);

        try {
            // Ensure browser is launched and get the page instance
            const page = await ensureBrowser();
            let buffer;

            // If a selector is provided, wait for the element and screenshot it; otherwise, screenshot the full page
            if (selector) {
                const element = await page.waitForSelector(selector, { timeout: BROWSER_DEFAULT_TIMEOUT_MS });
                buffer = await element.screenshot({ type: 'png' });
            } else {
                buffer = await page.screenshot({ type: 'png', fullPage });
            }

            // Convert the screenshot buffer to a base64 string for output
            const base64 = buffer.toString('base64');
            const title = await page.title();

            // Return success with the screenshot data and page info
            return {
                success: true,
                output: `Screenshot captured (${Math.round(buffer.length / 1024)} KB)\nPage: ${title} (${page.url()})\n\ndata:image/png;base64,${base64}`
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error(`Browser screenshot error: ${message}`);
            return { success: false, error: `Failed to take screenshot: ${message}` };
        }
    }
};

// Read page content
export const browserReadTool = {
    // Tool definition
    name: 'browser_read',
    description: 'Extract text content from the current page or a specific element.',
    parameters: {
        type: 'object',
        properties: {
            selector: {
                type: 'string',
                description: 'CSS selector to extract text from (optional, defaults to full page body).'
            }
        },
        required: []
    },

    // Main execution function
    execute: async args => {
        const { selector } = args;
        logger.debug(`Browser reading content${selector ? ` from: ${selector}` : ''}`);

        try {
            // Ensure browser is launched and get the page instance
            const page = await ensureBrowser();
            const title = await page.title();
            const url = page.url();
            let content;

            // If a selector is provided, extract text from that element; otherwise, extract text from the entire body
            if (selector) {
                content = await page.innerText(selector);
            } else {
                content = await page.innerText('body');
            }

            // Truncate content if it exceeds the maximum length
            if (content.length > BROWSER_MAX_CONTENT_LENGTH) {
                content = content.slice(0, BROWSER_MAX_CONTENT_LENGTH) + '\n... (content truncated)';
            }

            // Return success with the extracted content and page info
            return {
                success: true,
                output: `Page: ${title} (${url})\n\n${content}`
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error(`Browser read error: ${message}`);
            return { success: false, error: `Failed to read content: ${message}` };
        }
    }
};

// Scroll the page
export const browserScrollTool = {
    // Tool definition
    name: 'browser_scroll',
    description: 'Scroll the page up or down by a given amount, or to a specific element.',
    parameters: {
        type: 'object',
        properties: {
            direction: {
                type: 'string',
                enum: ['up', 'down'],
                description: 'Scroll direction. Default: down.'
            },
            amount: {
                type: 'number',
                description: 'Pixels to scroll. Default: 500.'
            },
            selector: {
                type: 'string',
                description: 'Scroll a specific element into view instead of scrolling the page.'
            }
        },
        required: []
    },

    // Main execution function
    execute: async args => {
        const { direction = 'down', amount = 500, selector } = args;
        logger.debug(`Browser scrolling ${selector ? `to: ${selector}` : `${direction} ${amount}px`}`);

        try {
            // Ensure browser is launched and get the page instance
            const page = await ensureBrowser();

            // If a selector is provided, scroll that element into view; otherwise, scroll the page by the specified amount
            if (selector) {
                await page.locator(selector).scrollIntoViewIfNeeded({ timeout: BROWSER_DEFAULT_TIMEOUT_MS });
                await humanDelay(200, 500);
                return {
                    success: true,
                    output: `Scrolled element into view: ${selector}`
                };
            }

            // Calculate scroll delta based on direction
            const delta = direction === 'up' ? -amount : amount;
            await page.mouse.wheel(0, delta);
            await humanDelay(300, 700);

            // Return success with info about the scroll action
            return {
                success: true,
                output: `Scrolled ${direction} by ${amount}px`
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error(`Browser scroll error: ${message}`);
            return { success: false, error: `Failed to scroll: ${message}` };
        }
    }
};

// Wait for something
export const browserWaitTool = {
    // Tool definition
    name: 'browser_wait',
    description: 'Wait for a selector to appear, for navigation, or for a fixed time.',
    parameters: {
        type: 'object',
        properties: {
            selector: {
                type: 'string',
                description: 'CSS selector to wait for.'
            },
            state: {
                type: 'string',
                enum: ['attached', 'detached', 'visible', 'hidden'],
                description: 'State to wait for. Default: visible.'
            },
            timeout: {
                type: 'number',
                description: 'Maximum wait time in ms. Default: 10000.'
            }
        },
        required: []
    },

    // Main execution function
    execute: async args => {
        const { selector, state = 'visible', timeout = 10000 } = args;

        try {
            // Ensure browser is launched and get the page instance
            const page = await ensureBrowser();

            // If a selector is provided, wait for that element to reach the specified state; otherwise, just wait for the specified timeout
            if (selector) {
                logger.debug(`Browser waiting for: ${selector} (${state})`);
                await page.waitForSelector(selector, { state, timeout });
                return {
                    success: true,
                    output: `Element "${selector}" is now ${state}`
                };
            }

            // Default: wait for a brief moment
            logger.debug(`Browser waiting ${timeout}ms`);
            await new Promise(resolve => setTimeout(resolve, timeout));

            // Return success after waiting
            return {
                success: true,
                output: `Waited ${timeout}ms`
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error(`Browser wait error: ${message}`);
            return { success: false, error: `Wait failed: ${message}` };
        }
    }
};

// Select from a dropdown
export const browserSelectTool = {
    // Tool definition
    name: 'browser_select',
    description: 'Select an option from a <select> dropdown.',
    parameters: {
        type: 'object',
        properties: {
            selector: {
                type: 'string',
                description: 'CSS selector of the <select> element.'
            },
            value: {
                type: 'string',
                description: 'Option value, label, or text to select.'
            }
        },
        required: ['selector', 'value']
    },

    // Main execution function
    execute: async args => {
        const { selector, value } = args;
        logger.debug(`Browser selecting "${value}" in: ${selector}`);

        try {
            // Ensure browser is launched and get the page instance
            const page = await ensureBrowser();
            await humanMove(page, selector);
            await humanDelay(100, 300);

            // Try by value first, then by label
            const selected = await page.selectOption(selector, value).catch(() =>
                page.selectOption(selector, { label: value })
            );

            // Return success with info about the selected option
            return {
                success: true,
                output: `Selected option in ${selector}: ${JSON.stringify(selected)}`
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error(`Browser select error: ${message}`);
            return { success: false, error: `Failed to select "${value}" in "${selector}": ${message}` };
        }
    }
};

// Execute JavaScript on the page
export const browserEvalTool = {
    // Tool definition
    name: 'browser_eval',
    description: 'Execute JavaScript code in the browser page context and return the result.',
    parameters: {
        type: 'object',
        properties: {
            script: {
                type: 'string',
                description: 'JavaScript code to execute in the page context.'
            }
        },
        required: ['script']
    },

    // Main execution function
    execute: async args => {
        const { script } = args;
        logger.debug(`Browser evaluating script`);

        try {
            // Ensure browser is launched and get the page instance
            const page = await ensureBrowser();
            const result = await page.evaluate(script);

            // Convert the result to a string for output, handling different types appropriately
            let output;
            if (result === undefined || result === null) {
                output = String(result);
            } else if (typeof result === 'object') {
                output = JSON.stringify(result, null, 2);
            } else {
                output = String(result);
            }

            // Truncate output if it exceeds the maximum length
            if (output.length > BROWSER_MAX_CONTENT_LENGTH) {
                output = output.slice(0, BROWSER_MAX_CONTENT_LENGTH) + '\n... (output truncated)';
            }

            // Return success with the script result
            return {
                success: true,
                output
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error(`Browser eval error: ${message}`);
            return { success: false, error: `Script execution failed: ${message}` };
        }
    }
};

// Close the browser
export const browserCloseTool = {
    // Tool definition
    name: 'browser_close',
    description: 'Close the browser and end the browsing session.',
    parameters: {
        type: 'object',
        properties: {},
        required: []
    },

    // Main execution function
    execute: async () => {
        logger.debug('Closing browser');

        try {
            // If the browser is connected, close it; otherwise, just reset the session state
            if (session.browser?.isConnected()) {
                await session.browser.close();
            }

            // Reset session state
            session.browser = null;
            session.context = null;
            session.page = null;

            // Return success message
            return {
                success: true,
                output: 'Browser closed'
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error(`Browser close error: ${message}`);

            // Reset session state even on error
            session.browser = null;
            session.context = null;
            session.page = null;
            return { success: false, error: `Failed to close browser: ${message}` };
        }
    }
};