import {VectorMemory, MemoryEntry} from '../src/memory';

// In-memory store for mocking DB
const inMemoryDB: any[] = [];

// Mock better-sqlite3 to avoid native dependency issues in tests
jest.mock('better-sqlite3', () => {
  return jest.fn().mockImplementation(() => ({
    prepare: jest.fn().mockImplementation((sql) => {
      if (sql.startsWith('SELECT')) {
        return {
          all: jest.fn(() => [...inMemoryDB]),
        };
      } else if (sql.startsWith('INSERT') || sql.startsWith('REPLACE')) {
        return {
          run: jest.fn((obsId, text, metadata, embedding) => {
            // Remove any existing entry with the same obsId
            const idx = inMemoryDB.findIndex(e => e.obsId === obsId);
            if (idx !== -1) inMemoryDB.splice(idx, 1);
            inMemoryDB.push({
              obsId,
              text,
              metadata,   // store as string
              embedding   // store as string
            });
          })
        };
      }
      return { all: jest.fn(() => []), run: jest.fn() };
    }),
    pragma: jest.fn(),
    exec: jest.fn()
  }));
});

jest.mock('@google/genai', () => {
  return {
    GoogleGenAI: jest.fn().mockImplementation(() => ({
      models: {
        embedContent: jest.fn().mockImplementation(({contents}) => {
          // Return a fake embedding: [{ values: [length of string, ...] }]
          return Promise.resolve({embeddings: [{values: Array(3).fill(contents.length)}]});
        }),
      },
    })),
  };
});

describe('VectorMemory', () => {
  const apiKey = 'fake-api-key';
  let memory: VectorMemory;

  beforeEach(() => {
    inMemoryDB.length = 0; // Reset the in-memory DB before each test
    memory = new VectorMemory(apiKey);
  });

  it('should add a memory and retrieve it by similarity', async () => {
    await memory.addMemory('hello world', 'obs1', {foo: 'bar'});
    const results = await memory.querySimilar('hello world', 1);
    expect(results.length).toBe(1);
    expect(results[0].obsId).toBe('obs1');
    expect(results[0].metadata).toEqual({foo: 'bar'});
  });

  it('should return empty array if store is empty', async () => {
    const results = await memory.querySimilar('test', 3);
    expect(results).toEqual([]);
  });

  it('should handle large k gracefully', async () => {
    await memory.addMemory('a', 'obs1');
    await memory.addMemory('b', 'obs2');
    const results = await memory.querySimilar('a', 10);
    expect(results.length).toBe(2);
  });

  it('should throw if embedding fails in addMemory', async () => {
    // Patch embedContent to throw
    (memory as any).ai.models.embedContent.mockImplementationOnce(() => Promise.reject(new Error('fail')));
    await expect(memory.addMemory('fail', 'obsX')).rejects.toThrow('fail');
  });

  it('should throw if embedding fails in querySimilar', async () => {
    // Patch embedContent to throw
    (memory as any).ai.models.embedContent.mockImplementationOnce(() => Promise.reject(new Error('fail2')));
    await expect(memory.querySimilar('fail', 1)).rejects.toThrow('fail2');
  });
}); 