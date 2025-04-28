Below is a “punch-list” for the software agent that will move the repository from prototype to a self-reinforcing flywheel.  For each unfinished task (3-11) I first grade the current gap (A–F relative to the paper’s four pillars) and then spell out concrete, Gemini-SDK-anchored steps the agent should implement.  All file-paths assume the existing tree.

────────────────────────────────────────
TASK 3  –  First-class Tool Use
────────────────────────────────────────
Grade: C → target A-

1. src/experiential_agent.ts  
   a. Inside live.connect add the tool schema block that is already commented:  
      tools:[{functionDeclarations:[{name:'webSearch', description:'SERP', parameters:{type:'object',properties:{query:{type:'string'}},required:['query']}}]}]  
   b. In onmessage, detect `msg.serverContent.functionCall`.  If present:  
      • run `await fetch(\`https://www.googleapis.com/customsearch/v1?q=${args.query}&key=$GOOGLE_API_KEY\`)`.  
      • stream the JSON back with `session.sendClientContent({parts:[{text:JSON.stringify(result).slice(0,8_000)}]})`.  
   c. Re-run `calcReward` once the function result arrives so tool latency is penalised (see Task 4).  
   d. Add image/file modality: if `msg.clientContent.inlineData` is present, pass to `createPartFromUri` as shown in sdk-samples/generate_content_with_file_upload.ts.

2. tests/experiential_agent.test.ts  
   Mock `functionCall` paths and assert that `fetch` is invoked and the returned string is injected into a new NDJSON line.

SDK calls used: live.connect, session.sendClientContent, files.upload, createPartFromUri.

────────────────────────────────────────
TASK 4  –  Grounded Reward Functions
────────────────────────────────────────
Grade: B- → target A

Status: module exists but not yet wired to real signals.

1. Wire user feedback:  
   • In demo.ts after the numeric rating is entered, call  
     `reward_functions.persistUserRating(sessionId, rating)` (add this helper).  
   • Persist as `experience.info.userRating`.

2. Separate critic model to avoid self-agreement:  
   • Change evaluationModel const to `'gemini-2.0'` (policy stays on `'gemini-2.0-flash'`).  
   • Replace generateContent scorer with  
     `await genAI.models.generateContent({model:'gemini-2.0', responseMimeType:'text/plain', contents: …})`.

3. External metrics:  
   • Record `Date.now() - msg.receiveTimestamp` as latency; convert to reward component `-0.01 * seconds`.  
   • If the webSearch call in Task 3 returns HTTP 200, add `+0.05` success bonus.

4. Negative safety channel:  
   • If `msg.serverContent.safetyFilters` exists, push reward = -1 and tag `experience.info.safetyViolation=true`.

────────────────────────────────────────
TASK 5  –  Nightly Summarisation Job
────────────────────────────────────────
Grade: F → target A

Create scripts/nightly_summarise.ts:

1. Read `data/YYYY-MM-DD/stream.ndjson`, chunk ≤30 k token batches.  
2. Call `ai.models.generateContentStream({model:'gemini-2.0-flash-exp', contents:chunk, config:{responseModalities:[Modality.TEXT]}})` to stream a summary.  
3. Append summaries, write `data/YYYY-MM-DD/summary.md`.  
4. `const file = await ai.files.upload({file:new Blob([summary])})`; persist `file.uri` to `summaries_index.json`.  
5. Schedule via cron_retrain.sh (see Task 8).

────────────────────────────────────────
TASK 6  –  Real PPO / Periodic Worker
────────────────────────────────────────
Grade: C- → target B+

1. Add src/ppo_worker.ts:  
   a. Load latest `vector_memory.db`; sample 10 k experiences via ReplayBuffer.sample.  
   b. Compute advantages with current GAE routine.  
   c. Create CSV dataset (obs, action, advantage) → write tmp file.  
   d. Kick tuning job (stub until GA):  
      `await genAI.tunings.create({model:'gemini-2.0-flash',datasetUri:file.uri, displayName:'ppo_'+Date.now()})`.  
      If tunings API unavailable, construct `prompts/policy_prefix.txt` with top-100 advantage examples.

2. When job finished, persist new model name or prefix path to `config/current_policy.json`; experiential_agent.ts reads this on startup.

SDK calls: tunings.create, files.upload, models.embedContent (to get obs embeddings for advantage net later).

────────────────────────────────────────
TASK 7  –  Token Counting & Sliding Window
────────────────────────────────────────
Grade: D+ → target A

1. Replace tokenCost():  
   ```
   const {totalTokens} = await genAI.models.countTokens({model, contents});
   ```
2. In runExperientialAgent before calling `session.sendClientContent`, create window:  
   • Keep last N turns until `historyTokens` ≤ 14 k.  
   • Append `topMemories` from VectorMemory.  
   • Log `contextTokensUsed`.

SDK call: models.countTokens.

────────────────────────────────────────
TASK 8  –  Metrics & Automation
────────────────────────────────────────
Grade: F → target B

1. src/metrics.ts: mini HTTP server on :9091 that exposes:  
   experience_buffer_size, reward_mean_1h, latency_ms_avg, token_usage_total.

2. scripts/cron_retrain.sh:  
   ```
   #!/usr/bin/env bash
   yesterday=$(date -v-1d +%F)
   zip -r logs_$yesterday.zip data/$yesterday
   node scripts/nightly_summarise.js $yesterday
   node dist/ppo_worker.js
   curl -X POST http://localhost:9091/-/reload   # if using Prometheus file-based srvc
   ```

────────────────────────────────────────
TASK 9  –  Safety & Policy Compliance
────────────────────────────────────────
Grade: C- → target A

1. Add constant in experiential_agent.ts:  
   ```
   const SYSTEM_INST = 'You are a policy-compliant assistant. ...';
   ```  
   pass as `systemInstruction` in live.connect config.

2. When `serverContent.safetyFilters?.length`, set reward = -1 and append to `blocked.ndjson`.

3. Extend tests to inject a fake safety filter and assert reward.

────────────────────────────────────────
TASK 10 –  Test Hardening
────────────────────────────────────────
Grade: B- (unit tests good) → target A

1. Add integration test `tests/countTokens.integration.ts`: real `countTokens` call, mocked generateContent.  
2. Property-based tests (fast-check) for ReplayBuffer invariants: size ≤ maxSize, sample ⊆ buffer.  
3. E2E test: spin up local VectorMemory with 50 mock memories, run one live.connect round trip with mocked sockets.

────────────────────────────────────────
TASK 11 –  Persistent, Indexed VectorMemory
────────────────────────────────────────
Grade: C  (SQLite table done, no ANN index) → target A

1. Swap `store: MemoryEntry[]` for HNSW-lib index (npm hnswlib-node).  
   • On addMemory(): `index.addPoint(embedding, obsIdInt)`.  
   • Persist index with `index.saveIndex('data/memories.hnsw')`.  
2. Fallback: Keep current SQLite but add `CREATE VIRTUAL TABLE memories_fts USING fts5(text)` for hybrid search.  
3. Implement config flag in .env: MEMORY_BACKEND=hnsw|sqlite.  
4. Migration util (`scripts/migrate_vector_memory.ts`) converts old rows → HNSW index.

5. Update querySimilar(): if backend === hnsw, use `index.searchKnn(queryEmbedding, k)` then join metadata via db.

SDK interaction unchanged (still uses embedContent).

────────────────────────────────────────
Global Clean-up Notes
────────────────────────────────────────
• Move duplicated dotenv loading into a single util to avoid test pollution.  
• Export a typed `ExperienceSchema` and reuse across buffer, reward, tests.  
• When the flywheel spins (cron → worker → prefix/model update), bump a `POLICY_VERSION` header and log it in each NDJSON line for offline evaluation.

Implementing the above (roughly 600 LOC net) will connect every arrow in the “Capture → Recall → Act → Measure → Learn → Deploy” cycle, with every step grounded in an explicit Gemini GenAI SDK call.  Once Tasks 3-11 are green, nightly cron will update `policy_prefix.txt` (or tuned model) and the flywheel will run continuously.