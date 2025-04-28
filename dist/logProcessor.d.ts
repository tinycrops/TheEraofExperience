/**
 * Get yesterday's date in YYYY-MM-DD format
 */
export declare function getYesterdayDate(): string;
/**
 * Get the path to yesterday's log file
 * Returns object with date and filePath if file exists, null otherwise
 */
export declare function getYesterdayLogs(): {
    date: string;
    filePath: string;
} | null;
/**
 * Parse NDJSON string into array of objects
 */
export declare function parseNDJSON(content: string): any[];
/**
 * Chunk logs based on token count to avoid exceeding model context limits
 */
export declare function chunkLogs(logs: any[], maxTokens?: number): Promise<any[][]>;
