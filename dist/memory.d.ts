export interface MemoryEntry {
    embedding: number[];
    obsId: string;
    metadata?: Record<string, any>;
    text: string;
}
export declare class VectorMemory {
    private ai;
    private db;
    private store;
    constructor(apiKey: string, dbPath?: string);
    private loadFromDB;
    /**
     * Embeds text using Gemini's embedContent API and stores it with metadata.
     */
    addMemory(text: string, metadata?: Record<string, any>): Promise<void>;
    /**
     * Returns the top-K most similar memories to the given text.
     */
    querySimilar(text: string, k?: number): Promise<MemoryEntry[]>;
}
