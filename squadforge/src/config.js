import { homedir } from 'os';
import { join } from 'path';

/**************** Application *****************/
export const SQUADFORGE_NAME = 'squadforge';
export const SQUADFORGE_ROOT_DIR = join(homedir(), '.squadforge');

/**************** Filesystem *****************/
export const DEFAULT_AGENTS_DIR_NAME = 'agents';
export const DEFAULT_TOOLS_DIR_NAME = 'tools';
export const DEFAULT_SESSIONS_DIR_NAME = 'sessions';
export const MARKDOWN_EXTENSION = '.md';
export const SUPPORTED_TOOL_EXTENSIONS = ['.js', '.mjs'];

/**************** Agent *****************/
export const LEADER_FILE_NAME = 'leader.md';
export const LEADER_SPEC_ID = 'leader';
export const DEFAULT_LEADER_SESSION_ID = 'leader';
export const DEFAULT_MAX_ITERATIONS = 12;
export const RUNNING_STATUS = 'running';
export const IDLE_STATUS = 'idle';
export const DONE_STATUS = 'done';
export const FAILED_STATUS = 'failed';

/**************** LLM *****************/
export const DEFAULT_REQUEST_TIMEOUT_MS = 60000;
export const DEFAULT_MAX_TOKENS = 4096;
export const DEFAULT_TEMPERATURE = 0.7;
export const DEFAULT_TOOL_CHOICE = 'auto';