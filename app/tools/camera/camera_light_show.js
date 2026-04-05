import { logger } from 'squadforge';
import { handleToolError, handleToolResponse } from '../../../src/utils/common/utils.js';
import { getActiveNvrChannelNumbers, setCameraLightState } from '../../../src/utils/camera/camera-client.js';

const DEFAULT_INTERVAL_MS = 1000;
let activeLightShow = null;

// Camera light show tool
export default {
    // Tool definition
    name: 'camera_light_show',
    description: 'Start or stop a multi-camera spotlight light show.',
    parameters: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                description: 'Whether to start or stop the camera light show.',
                enum: ['start', 'stop']
            },
            channels: {
                type: 'array',
                description: 'Optional list of 0-based camera channel numbers to include in the light show. Defaults to all active channels.',
                items: {
                    type: 'number'
                }
            }
        },
        required: ['action']
    },

    // Main execution function
    execute: async args => {
        const action = String(args.action).toLowerCase();

        try {
            // If stop, stop the active light show and return
            if (action === 'stop') {
                logger.debug('Camera: stopping light show');
                const stopResult = await stopActiveLightShow({ turnLightsOff: true });
                return handleToolResponse(stopResult);
            }

            // Otherwise start a new light show with the target channels
            const channels = await resolveTargetChannels(args.channels);
            logger.debug(`Camera: starting light show on channels [${channels.join(', ')}] at ${DEFAULT_INTERVAL_MS}ms`);

            // If a show is already running, stop it first before starting a new one
            if (activeLightShow) {
                await stopActiveLightShow({ turnLightsOff: true });
            }

            // Set the new light show state
            activeLightShow = {
                channels,
                intervalMs: DEFAULT_INTERVAL_MS,
                runningFrame: false,
                step: 0,
                timer: null
            };

            // Start the first frame immediately
            await runLightShowFrame();

            // Return the active show state
            return handleToolResponse({
                running: true,
                action: 'start',
                channels,
                intervalMs: DEFAULT_INTERVAL_MS,
                message: 'Camera light show started.'
            });
        } catch (error) {
            return handleToolError({ error, message: 'Failed to control camera light show' });
        }
    }
};

// Resolve the target channels from the NVR channel list
const resolveTargetChannels = async inputChannels => {
    // Get the valid active channel numbers from the NVR
    const availableChannels = await getActiveNvrChannelNumbers();

    // If the provided list is empty or not an array, default to all available channels
    if (!Array.isArray(inputChannels) || inputChannels.length === 0) {
        return availableChannels;
    }

    // Check that every requested channel exists in the available channel list
    const invalidChannels = inputChannels.filter(channel => !availableChannels.includes(channel));
    if (invalidChannels.length > 0) {
        throw new Error(`Some of the provided channels are not available: ${invalidChannels.join(', ')}`);
    }

    // Return the validated list of requested channels
    return inputChannels;
};

// Turn a set of channels on or off sequentially
const setChannelsMode = async ({ channels, state }) => {
    for (const channel of channels) {
        await setCameraLightState({ channel, state });
    }
};

// Build the next animation frame for a simple multi-camera light show
const buildFrameStates = ({ channelCount, step }) => {
    const cycleLength = Math.max(channelCount, 1);
    const phase = Math.floor(step / cycleLength) % 6;
    const position = step % cycleLength;
    const reversePosition = cycleLength - 1 - position;

    // Define the light state for each channel based on the current phase of the animation
    return Array.from({ length: channelCount }, (_, index) => {
        switch (phase) {
            case 0:
                return index === position;
            case 1:
                return index === reversePosition;
            case 2:
                return index % 2 === 0;
            case 3:
                return index % 2 === 1;
            case 4:
                return true;
            default:
                return false;
        }
    });
};

// Clear the timer for the currently running light show
const clearActiveLightShowTimer = () => {
    if (activeLightShow?.timer) {
        clearTimeout(activeLightShow.timer);
    }
};

// Stop the active light show and optionally turn all involved lights off
const stopActiveLightShow = async ({ turnLightsOff = true } = {}) => {
    // Return early if no show is currently active
    if (!activeLightShow) {
        return {
            running: false,
            message: 'No camera light show is currently running.'
        };
    }

    // Capture the active channels before clearing the show state
    const channels = [...activeLightShow.channels];
    clearActiveLightShowTimer();
    activeLightShow = null;

    // If requested, turn all the channels that were part of the show off
    if (turnLightsOff && channels.length > 0) {
        await setChannelsMode({ channels, state: 'off' });
    }

    // Return the stopped show state
    return {
        running: false,
        channels,
        message: 'Camera light show stopped.'
    };
};

// Schedule the next animation frame while the show remains active
const scheduleNextFrame = () => {
    // Return early if no show is currently active
    if (!activeLightShow) {
        return;
    }

    // Clear any existing timer before scheduling the next frame
    activeLightShow.timer = setTimeout(() => {
        void runLightShowFrame();
    }, activeLightShow.intervalMs);
};

// Apply the next animation frame to the active channel set
const runLightShowFrame = async () => {
    // Return early if no show is currently active or a frame is already running
    if (!activeLightShow || activeLightShow.runningFrame) {
        return;
    }

    // Set the runningFrame flag
    activeLightShow.runningFrame = true;

    try {
        // Build the light state for each channel for the current frame of the animation
        const frameStates = buildFrameStates({
            channelCount: activeLightShow.channels.length,
            step: activeLightShow.step
        });

        // Apply the light state to each channel sequentially
        for (let index = 0; index < activeLightShow.channels.length; index += 1) {
            const channel = activeLightShow.channels[index];
            const state = frameStates[index] ? 'on' : 'off';
            await setCameraLightState({ channel, state });
        }

        // Increment the step for the next frame
        activeLightShow.step += 1;
    } catch (error) {
        logger.error(`Camera light show failed: ${error?.message || 'unknown error'}`);
        await stopActiveLightShow({ turnLightsOff: true });
        return;
    } finally {
        if (activeLightShow) {
            activeLightShow.runningFrame = false;
        }
    }

    // Schedule the next frame
    scheduleNextFrame();
};