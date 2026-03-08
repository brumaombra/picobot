import { Client, DefaultMediaReceiver } from 'castv2-client';

const CAST_CONNECT_TIMEOUT_MS = 10000;

// Cast a media URL to a Chromecast device at the provided host/IP
export const castUrlToChromecast = async ({ host, mediaUrl, contentType = 'application/vnd.apple.mpegurl' }) => {
    if (!host) {
        throw new Error('Chromecast host is required.');
    }

    if (!mediaUrl) {
        throw new Error('Media URL is required.');
    }

    const client = new Client();

    return await new Promise((resolve, reject) => {
        let settled = false;
        const timeout = setTimeout(() => {
            if (settled) return;
            settled = true;
            client.close();
            reject(new Error('Timed out while connecting to Chromecast.'));
        }, CAST_CONNECT_TIMEOUT_MS);

        const finishError = error => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            client.close();
            reject(error instanceof Error ? error : new Error(String(error)));
        };

        const finishSuccess = payload => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            client.close();
            resolve(payload);
        };

        client.on('error', finishError);

        client.connect(host, () => {
            client.launch(DefaultMediaReceiver, (launchError, player) => {
                if (launchError) {
                    finishError(launchError);
                    return;
                }

                const media = {
                    contentId: mediaUrl,
                    contentType,
                    streamType: 'LIVE'
                };

                player.load(media, { autoplay: true }, (loadError, status) => {
                    if (loadError) {
                        finishError(loadError);
                        return;
                    }

                    finishSuccess({
                        status,
                        mediaUrl,
                        host
                    });
                });
            });
        });
    });
};