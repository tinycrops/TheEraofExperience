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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorMemory = void 0;
const genai_1 = require("@google/genai");
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path = __importStar(require("path"));
class VectorMemory {
    constructor(apiKey, dbPath = 'data/vector_memory.db') {
        this.store = [];
        this.ai = new genai_1.GoogleGenAI({ vertexai: false, apiKey });
        const absPath = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);
        this.db = new better_sqlite3_1.default(absPath);
        this.db.pragma('journal_mode = WAL');
        this.db.exec(`CREATE TABLE IF NOT EXISTS memories (
      obsId TEXT PRIMARY KEY,
      text TEXT,
      metadata TEXT,
      embedding TEXT
    )`);
        this.loadFromDB();
    }
    loadFromDB() {
        const rows = this.db.prepare('SELECT * FROM memories').all();
        this.store = rows.map(row => ({
            obsId: row.obsId,
            text: row.text,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
            embedding: JSON.parse(row.embedding)
        }));
    }
    /**
     * Embeds text using Gemini's embedContent API and stores it with metadata.
     */
    async addMemory(text, metadata) {
        try {
            // Generate a unique observation ID if not provided in metadata
            const obsId = metadata?.sessionId ?
                `${metadata.sessionId}-${metadata.timestamp || Date.now()}` :
                `mem-${Date.now()}`;
            const response = await this.ai.models.embedContent({
                model: 'text-embedding-004',
                contents: text,
            });
            const embedding = response.embeddings?.[0]?.values;
            if (!embedding || !Array.isArray(embedding)) {
                throw new Error('Failed to get embedding');
            }
            const entry = { embedding, obsId, metadata, text };
            this.store.push(entry);
            this.db.prepare('INSERT OR REPLACE INTO memories (obsId, text, metadata, embedding) VALUES (?, ?, ?, ?)').run(obsId, text, metadata ? JSON.stringify(metadata) : null, JSON.stringify(embedding));
        }
        catch (err) {
            console.error('Error embedding content:', err);
            throw err;
        }
    }
    /**
     * Returns the top-K most similar memories to the given text.
     */
    async querySimilar(text, k = 5) {
        try {
            const response = await this.ai.models.embedContent({
                model: 'text-embedding-004',
                contents: text,
            });
            const queryEmbedding = response.embeddings?.[0]?.values;
            if (!queryEmbedding || !Array.isArray(queryEmbedding)) {
                throw new Error('Failed to get embedding for query');
            }
            // Always reload from DB to ensure up-to-date
            this.loadFromDB();
            const scored = this.store.map(entry => ({
                entry,
                score: cosineSimilarity(queryEmbedding, entry.embedding),
            }));
            scored.sort((a, b) => b.score - a.score);
            return scored.slice(0, k).map(s => s.entry);
        }
        catch (err) {
            console.error('Error querying similar memories:', err);
            throw err;
        }
    }
}
exports.VectorMemory = VectorMemory;
function cosineSimilarity(a, b) {
    const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
    const normA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
    const normB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
    return normA && normB ? dot / (normA * normB) : 0;
}
//# sourceMappingURL=memory.js.map