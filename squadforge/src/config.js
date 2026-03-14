import { homedir } from 'os';
import { join } from 'path';

/**************** Application *****************/
export const SQUADFORGE_NAME = 'squadforge';
export const SQUADFORGE_ROOT_DIR = join(homedir(), '.squadforge');

/**************** Filesystem *****************/
export const DEFAULT_AGENTS_DIR_NAME = 'agents';
export const DEFAULT_PROMPTS_DIR_NAME = 'prompts';
export const DEFAULT_SKILLS_DIR_NAME = 'skills';
export const DEFAULT_TOOLS_DIR_NAME = 'tools';
export const DEFAULT_SESSIONS_DIR_NAME = 'sessions';
export const DEFAULT_CRONS_DIR_NAME = 'crons';
export const DEFAULT_LOGS_DIR_NAME = 'logs';
export const MARKDOWN_EXTENSION = '.md';
export const SUPPORTED_TOOL_EXTENSIONS = ['.js', '.mjs'];
export const TOOLS_FILE_NAME = 'TOOLS.md';
export const SKILLS_FILE_NAME = 'SKILLS.md';
export const SUBAGENTS_FILE_NAME = 'SUBAGENTS.md';
export const SUBAGENT_FILE_NAME = 'SUBAGENT.md';
export const SKILL_FILE_NAME = 'SKILL.md';

/**************** Agent *****************/
export const LEADER_FILE_NAME = 'leader.md';
export const LEADER_SPEC_ID = 'leader';
export const DEFAULT_LEADER_SESSION_ID = 'leader';
export const DEFAULT_MAX_RUNTIME_MS = 5 * 60 * 1000;
export const DEFAULT_WRAP_UP_THRESHOLD_MS = 60 * 1000;
export const DEFAULT_MAX_MESSAGES_PER_SESSION = 50;
export const DEFAULT_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_LLM_CHAT_MAX_RETRIES = 2;
export const RUNNING_STATUS = 'running';
export const IDLE_STATUS = 'idle';
export const DONE_STATUS = 'done';
export const FAILED_STATUS = 'failed';
export const SUBAGENT_QUESTION_TIMEOUT_MS = 2 * 60 * 1000;

/**************** Runtime *****************/
export const DEFAULT_RUNTIME_POLL_TIMEOUT_MS = 1000;
export const DEFAULT_RUNTIME_TIMEOUT_MESSAGE = "I've run out of time for this task. Let me know if you'd like me to continue!";

/**************** Logging *****************/
export const DEFAULT_LOG_LEVEL = 'debug';
export const DEFAULT_LOG_TIMESTAMP_FORMAT = 'YYYY-MM-DD HH:mm:ss';
export const DEFAULT_LOG_MAX_SIZE = 10 * 1024 * 1024;
export const DEFAULT_ERROR_LOG_MAX_SIZE = 5 * 1024 * 1024;

/**************** LLM *****************/
export const DEFAULT_REQUEST_TIMEOUT_MS = 60000;
export const DEFAULT_MAX_TOKENS = 4096;
export const DEFAULT_TEMPERATURE = 0.7;
export const DEFAULT_TOOL_CHOICE = 'auto';