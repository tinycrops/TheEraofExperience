import * as logProcessor from './logProcessor';
import * as summaryGenerator from './summaryGenerator';
import * as summaryStorage from './summaryStorage';

// Main function to orchestrate the entire summarization process
export async function main() {
  console.log('Starting daily summarization job...');
  
  try {
    // Step 1: Get yesterday's logs
    console.log('Finding yesterday\'s logs...');
    const logInfo = logProcessor.getYesterdayLogs();
    
    if (!logInfo) {
      console.log('No logs found for yesterday. Exiting.');
      return;
    }
    
    const { date, filePath } = logInfo;
    console.log(`Found logs for ${date} at ${filePath}`);
    
    // Step 2: Parse the logs
    console.log('Parsing logs...');
    const logs = await logProcessor.parseNDJSON(filePath);
    
    if (logs.length === 0) {
      console.log('No log entries found. Exiting.');
      return;
    }
    
    console.log(`Parsed ${logs.length} log entries`);
    
    // Step 3: Chunk the logs for processing
    console.log('Chunking logs...');
    const chunks = await logProcessor.chunkLogs(logs);
    console.log(`Split logs into ${chunks.length} chunks`);
    
    // Step 4: Generate summary
    console.log('Generating summary...');
    const summary = await summaryGenerator.generateSummary(chunks, date);
    console.log('Summary generated successfully');
    
    // Step 5: Save summary locally
    console.log('Saving summary locally...');
    const localPath = await summaryStorage.saveSummaryLocally(date, summary);
    
    // Step 6: Upload to cold storage (handle failure gracefully)
    console.log('Uploading to cold storage...');
    let coldStorageUri = '';
    let coldStorageName = '';
    
    try {
      const result = await summaryStorage.uploadToColdStorage(date, summary);
      coldStorageUri = result.uri;
      coldStorageName = result.name;
      console.log('Upload to cold storage successful');
    } catch (err) {
      console.error('Failed to upload to cold storage, but continuing:', err);
    }
    
    // Step 7: Update the index
    console.log('Updating summary index...');
    await summaryStorage.updateSummaryIndex(
      date,
      localPath,
      coldStorageUri,
      coldStorageName,
      summary
    );
    
    console.log('Daily summarization completed successfully!');
  } catch (err) {
    console.error('Error in summarization job:', err);
    process.exit(1);
  }
}

// When run directly, execute the main function
if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error in summarization job:', err);
    process.exit(1);
  });
}

// Create a schedule function that can be called by an external scheduler
export function scheduleDailySummarization(cronPattern: string) {
  try {
    // Dynamic import to avoid dependency if not needed
    const cron = require('node-cron');
    
    if (!cron.validate(cronPattern)) {
      throw new Error(`Invalid cron pattern: ${cronPattern}`);
    }
    
    console.log(`Scheduling daily summarization with pattern: ${cronPattern}`);
    
    cron.schedule(cronPattern, () => {
      console.log(`Running scheduled summarization at ${new Date().toISOString()}`);
      main().catch(err => {
        console.error('Error in scheduled summarization:', err);
      });
    });
    
    console.log('Scheduler started successfully');
  } catch (err) {
    console.error('Failed to set up scheduler:', err);
    throw err;
  }
} 