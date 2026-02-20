import { google } from 'googleapis';
import { authenticate } from '@google-cloud/local-auth';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { logger } from './logger.js';

// Paths for credentials and token
const CREDENTIALS_PATH = join(process.cwd(), 'credentials.json');
const TOKEN_PATH = join(process.cwd(), 'token.json');

// Combined scopes for all Google services
const SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/presentations'
];

// Clients
let cachedAuth = null;
let gmailClient = null;
let calendarClient = null;
let driveClient = null;
let slidesClient = null;

// Get authenticated Google client
const getGoogleAuth = async () => {
    // Return cached auth if available
    if (cachedAuth) {
        return cachedAuth;
    }

    let client;

    // Check if credentials file exists
    if (!existsSync(CREDENTIALS_PATH)) {
        throw new Error('credentials.json not found. Please set up Google OAuth2 credentials.');
    }

    // Check if we have previously stored a token
    if (existsSync(TOKEN_PATH)) {
        try {
            // Try to load the token
            const token = JSON.parse(readFileSync(TOKEN_PATH, 'utf-8'));
            const { client_id, client_secret, redirect_uris } = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8')).installed;

            // Create OAuth2 client with the loaded token
            const oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
            oauth2Client.setCredentials(token);
            client = oauth2Client;
            logger.info('Google API authenticated with saved token');
        } catch (error) {
            logger.warn('Saved token invalid, re-authenticating...'); // Fall through to authenticate
        }
    }

    // If no valid client yet, authenticate
    if (!client) {
        logger.info('Starting Google OAuth2 authentication...');
        client = await authenticate({
            scopes: SCOPES,
            keyfilePath: CREDENTIALS_PATH
        });

        // Save the token for future use
        writeFileSync(TOKEN_PATH, JSON.stringify(client.credentials));
        logger.info('Google API authenticated and token saved');
    }

    // Cache and return the authenticated client
    cachedAuth = client;
    return client;
};

// Get Gmail API client
export const getGmailClient = async () => {
    // Create and cache Gmail client if not already done
    if (!gmailClient) {
        const auth = await getGoogleAuth();
        gmailClient = google.gmail({ version: 'v1', auth });
        logger.debug('Gmail client initialized');
    }

    // Return the cached Gmail client
    return gmailClient;
};

// Get Calendar API client
export const getCalendarClient = async () => {
    // Create and cache Calendar client if not already done
    if (!calendarClient) {
        const auth = await getGoogleAuth();
        calendarClient = google.calendar({ version: 'v3', auth });
        logger.debug('Calendar client initialized');
    }

    // Return the cached Calendar client
    return calendarClient;
};

// Get Drive API client
export const getDriveClient = async () => {
    // Create and cache Drive client if not already done
    if (!driveClient) {
        const auth = await getGoogleAuth();
        driveClient = google.drive({ version: 'v3', auth });
        logger.debug('Drive client initialized');
    }

    // Return the cached Drive client
    return driveClient;
};

// Get Slides API client
export const getSlidesClient = async () => {
    // Create and cache Slides client if not already done
    if (!slidesClient) {
        const auth = await getGoogleAuth();
        slidesClient = google.slides({ version: 'v1', auth });
        logger.debug('Slides client initialized');
    }

    // Return the cached Slides client
    return slidesClient;
};

// Initialize Google clients (optional pre-warming)
export const initializeGoogleClients = async () => {
    try {
        logger.info('Initializing Google API clients...');
        await getGoogleAuth();
        logger.info('Google API clients ready');
    } catch (error) {
        logger.error(`Failed to initialize Google API clients: ${error.message}`);
        logger.warn('Google Apps tools will not be available until authentication is completed');
    }
};