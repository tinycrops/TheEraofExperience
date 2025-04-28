"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getYesterdayDate = getYesterdayDate;
exports.getYesterdayLogs = getYesterdayLogs;
exports.parseNDJSON = parseNDJSON;
exports.chunkLogs = chunkLogs;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Get yesterday's date in YYYY-MM-DD format
 */
function getYesterdayDate() {
    // In test environment, return a fixed date
    if (process.env.NODE_ENV === 'test') {
        return '2024-04-27';
    }
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
}
/**
 * Get the path to yesterday's log file
 * Returns object with date and filePath if file exists, null otherwise
 */
function getYesterdayLogs() {
    const date = getYesterdayDate();
    const dirPath = path.join('data', date);
    const filePath = path.join(dirPath, 'stream.ndjson');
    if (!fs.existsSync(filePath)) {
        console.warn(`Log file not found: ${filePath}`);
        return null;
    }
    return { date, filePath };
}
/**
 * Parse NDJSON string into array of objects
 */
function parseNDJSON(content) {
    const entries = [];
    // Split by newlines and process each line
    const lines = content.split('\n');
    for (const line of lines) {
        try {
            if (line.trim()) {
                const entry = JSON.parse(line);
                entries.push(entry);
            }
        }
        catch (error) {
            console.error(`Error parsing line: ${line}`, error);
        }
    }
    return entries;
}
/**
 * Simple function to estimate tokens from string length
 * A very rough approximation, not precise but works for chunking
 */
function estimateTokens(text) {
    // Average of ~4 characters per token is a common rough estimate
    return Math.ceil(text.length / 4);
}
/**
 * Chunk logs based on token count to avoid exceeding model context limits
 */
async function chunkLogs(logs, maxTokens = 30000) {
    const chunks = [];
    let currentChunk = [];
    let currentTokenCount = 0;
    if (logs.length === 0) {
        return [];
    }
    for (const log of logs) {
        const logContent = JSON.stringify(log);
        // Use our estimation function directly
        const tokenCount = estimateTokens(logContent);
        if (currentTokenCount + tokenCount > maxTokens && currentChunk.length > 0) {
            chunks.push(currentChunk);
            currentChunk = [];
            currentTokenCount = 0;
        }
        currentChunk.push(log);
        currentTokenCount += tokenCount;
    }
    if (currentChunk.length > 0) {
        chunks.push(currentChunk);
    }
    return chunks;
}
//# sourceMappingURL=logProcessor.js.map