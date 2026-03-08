import { runTerminalCmdTool } from './general/shell.js';
import { getDateTimeTool } from './general/datetime.js';
import { sendFileTool } from './general/send_file.js';
import { subagentStartTool } from './general/subagent_start.js';
import { subagentChatTool } from './general/subagent_chat.js';
import { subagentListTool } from './general/subagent_list.js';
import { askMainAgentTool } from './general/ask_main_agent.js';
import { systemInfoBasicTool } from './system/system_info_basic.js';
import { systemInfoCpuTool } from './system/system_info_cpu.js';
import { systemInfoMemoryTool } from './system/system_info_memory.js';
import { systemInfoNetworkTool } from './system/system_info_network.js';
import { systemInfoAllTool } from './system/system_info_all.js';
import { webFetchTool } from './web/fetch.js';
import { webSearchTool } from './web/search.js';
import { readFileTool } from './filesystem/read_file.js';
import { writeFileTool } from './filesystem/write_file.js';
import { listDirectoryTool } from './filesystem/list_directory.js';
import { pathExistsTool } from './filesystem/path_exists.js';
import { strReplaceEditTool } from './filesystem/str_replace_edit.js';
import { grepSearchTool } from './filesystem/grep_search.js';
import { cronCreateTool } from './cron/cron_create.js';
import { cronListTool } from './cron/cron_list.js';
import { cronGetTool } from './cron/cron_get.js';
import { cronUpdateTool } from './cron/cron_update.js';
import { cronDeleteTool } from './cron/cron_delete.js';
import { gmailSearchTool } from './gmail/gmail_search.js';
import { gmailReadTool } from './gmail/gmail_read.js';
import { gmailSendTool } from './gmail/gmail_send.js';
import { gmailLabelsTool } from './gmail/gmail_list_labels.js';
import { calendarListEventsTool } from './calendar/calendar_list_events.js';
import { calendarGetEventTool } from './calendar/calendar_get_event.js';
import { calendarCreateEventTool } from './calendar/calendar_create_event.js';
import { calendarUpdateEventTool } from './calendar/calendar_update_event.js';
import { calendarDeleteEventTool } from './calendar/calendar_delete_event.js';
import { driveListFilesTool } from './drive/drive_list_files.js';
import { driveGetFileTool } from './drive/drive_get_file.js';
import { driveReadFileTool } from './drive/drive_read_file.js';
import { driveCreateFileTool } from './drive/drive_create_file.js';
import { driveUpdateFileTool } from './drive/drive_update_file.js';
import { driveDeleteFileTool } from './drive/drive_delete_file.js';
import { driveShareFileTool } from './drive/drive_share_file.js';
import { slidesCreateTool } from './slides/slides_create.js';
import { slidesGetTool } from './slides/slides_get.js';
import { slidesAddSlideTool } from './slides/slides_add_slide.js';
import { slidesReplaceTextTool } from './slides/slides_replace_text.js';
import { slidesDeleteSlideTool } from './slides/slides_delete_slide.js';
import { browserTool } from './browser/browser.js';
import { imageGenerateTool } from './image/image_generate.js';
import { cameraGetInfoTool } from './camera/camera_get_info.js';
import { cameraSnapshotTool } from './camera/camera_snapshot.js';
import { cameraSearchRecordingsTool } from './camera/camera_search_recordings.js';
import { cameraDownloadRecordingTool } from './camera/camera_download_recording.js';
import { cameraAnalyzeVideoTool } from './camera/camera_analyze_video.js';
import { cameraAnalyzeImageTool } from './camera/camera_analyze_image.js';
import { cameraCastStreamTool } from './camera/camera_cast_stream.js';
import { networkPingTool } from './network/network_ping.js';
import { networkListDevicesTool } from './network/network_list_devices.js';

// Registry of all available tools (flat map: name → tool)
const TOOLS = new Map([
    // General tools
    [runTerminalCmdTool.name, runTerminalCmdTool],
    [getDateTimeTool.name, getDateTimeTool],
    [sendFileTool.name, sendFileTool],

    // Subagents tools
    [subagentStartTool.name, subagentStartTool],
    [subagentChatTool.name, subagentChatTool],
    [subagentListTool.name, subagentListTool],
    [askMainAgentTool.name, askMainAgentTool],

    // System tools
    [systemInfoBasicTool.name, systemInfoBasicTool],
    [systemInfoCpuTool.name, systemInfoCpuTool],
    [systemInfoMemoryTool.name, systemInfoMemoryTool],
    [systemInfoNetworkTool.name, systemInfoNetworkTool],
    [systemInfoAllTool.name, systemInfoAllTool],

    // Web tools
    [webFetchTool.name, webFetchTool],
    [webSearchTool.name, webSearchTool],

    // Filesystem tools
    [readFileTool.name, readFileTool],
    [writeFileTool.name, writeFileTool],
    [listDirectoryTool.name, listDirectoryTool],
    [strReplaceEditTool.name, strReplaceEditTool],
    [grepSearchTool.name, grepSearchTool],
    [pathExistsTool.name, pathExistsTool],

    // Cron tools
    [cronCreateTool.name, cronCreateTool],
    [cronListTool.name, cronListTool],
    [cronGetTool.name, cronGetTool],
    [cronUpdateTool.name, cronUpdateTool],
    [cronDeleteTool.name, cronDeleteTool],

    // Gmail tools
    [gmailSearchTool.name, gmailSearchTool],
    [gmailReadTool.name, gmailReadTool],
    [gmailSendTool.name, gmailSendTool],
    [gmailLabelsTool.name, gmailLabelsTool],

    // Calendar tools
    [calendarListEventsTool.name, calendarListEventsTool],
    [calendarGetEventTool.name, calendarGetEventTool],
    [calendarCreateEventTool.name, calendarCreateEventTool],
    [calendarUpdateEventTool.name, calendarUpdateEventTool],
    [calendarDeleteEventTool.name, calendarDeleteEventTool],

    // Drive tools
    [driveListFilesTool.name, driveListFilesTool],
    [driveGetFileTool.name, driveGetFileTool],
    [driveReadFileTool.name, driveReadFileTool],
    [driveCreateFileTool.name, driveCreateFileTool],
    [driveUpdateFileTool.name, driveUpdateFileTool],
    [driveDeleteFileTool.name, driveDeleteFileTool],
    [driveShareFileTool.name, driveShareFileTool],

    // Slides tools
    [slidesCreateTool.name, slidesCreateTool],
    [slidesGetTool.name, slidesGetTool],
    [slidesAddSlideTool.name, slidesAddSlideTool],
    [slidesReplaceTextTool.name, slidesReplaceTextTool],
    [slidesDeleteSlideTool.name, slidesDeleteSlideTool],

    // Browser tools
    [browserTool.name, browserTool],

    // Image tools
    [imageGenerateTool.name, imageGenerateTool],

    // Camera / NVR tools
    [cameraGetInfoTool.name, cameraGetInfoTool],
    [cameraSnapshotTool.name, cameraSnapshotTool],
    [cameraSearchRecordingsTool.name, cameraSearchRecordingsTool],
    [cameraDownloadRecordingTool.name, cameraDownloadRecordingTool],
    [cameraAnalyzeVideoTool.name, cameraAnalyzeVideoTool],
    [cameraAnalyzeImageTool.name, cameraAnalyzeImageTool],
    [cameraCastStreamTool.name, cameraCastStreamTool],

    // Network tools
    [networkPingTool.name, networkPingTool],
    [networkListDevicesTool.name, networkListDevicesTool]
]);

// Get a tool by name
export const getTool = name => {
    return TOOLS.get(name);
};

// Resolve a list of tool names to tool objects, filtering out unknown names
const resolveTools = toolNames => {
    // If specific tool names are provided, return those tools (filtering out any unknown names)
    if (toolNames?.length) {
        return toolNames.map(name => TOOLS.get(name)).filter(Boolean);
    }

    // If no specific tool names provided, return all available tools
    return [...TOOLS.values()];
};

// Get tool definitions for the LLM, filtered by allowed tool names
export const getToolsDefinitions = toolNames => {
    const tools = resolveTools(toolNames);

    // Return tool definitions in the format expected by the LLM
    return tools.map(tool => ({
        type: 'function',
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
        }
    }));
};

// Generate a formatted text list of tools for documentation/prompts
export const generateToolsList = toolNames => {
    const tools = resolveTools(toolNames);
    return tools.map(tool => `- \`${tool.name}\`: ${tool.description}`).join('\n');
};