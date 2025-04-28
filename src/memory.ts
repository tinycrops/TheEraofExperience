import {GoogleGenAI} from '@google/genai';
import Database from 'better-sqlite3';
import * as path from 'path';

export interface MemoryEntry {
  embedding: number[];
  obsId: string;
  metadata?: Record<string, any>;
  text: string;
}

export class VectorMemory {
  private ai: GoogleGenAI;
  private db: Database.Database;
  private store: MemoryEntry[] = [];

  constructor(apiKey: string, dbPath: string = 'data/vector_memory.db') {
    this.ai = new GoogleGenAI({vertexai: false, apiKey});
    const absPath = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);
    this.db = new Database(absPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`CREATE TABLE IF NOT EXISTS memories (
      obsId TEXT PRIMARY KEY,
      text TEXT,
      metadata TEXT,
      embedding TEXT
    )`);
    this.loadFromDB();
  }

  private loadFromDB() {
    const rows = this.db.prepare('SELECT * FROM memories').all() as Array<{obsId: string, text: string, metadata: string | null, embedding: string}>;
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
  async addMemory(text: string, obsId: string, metadata?: Record<string, any>): Promise<void> {
    try {
      const response = await this.ai.models.embedContent({
        model: 'text-embedding-004',
        contents: text,
      });
      const embedding = response.embeddings?.[0]?.values;
      if (!embedding || !Array.isArray(embedding)) {
        throw new Error('Failed to get embedding');
      }
      const entry: MemoryEntry = {embedding, obsId, metadata, text};
      this.store.push(entry);
      this.db.prepare(
        'INSERT OR REPLACE INTO memories (obsId, text, metadata, embedding) VALUES (?, ?, ?, ?)'
      ).run(
        obsId,
        text,
        metadata ? JSON.stringify(metadata) : null,
        JSON.stringify(embedding)
      );
    } catch (err) {
      console.error('Error embedding content:', err);
      throw err;
    }
  }

  /**
   * Returns the top-K most similar memories to the given text.
   */
  async querySimilar(text: string, k: number = 5): Promise<MemoryEntry[]> {
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
    } catch (err) {
      console.error('Error querying similar memories:', err);
      throw err;
    }
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
  const normB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
  return normA && normB ? dot / (normA * normB) : 0;
} 