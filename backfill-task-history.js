import { execSync } from 'child_process';

console.log('Starting task history backfill...');

try {
  const result = execSync('npx convex run tasks:backfillTaskHistory', { 
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024 
  });
  
  const parsedResult = JSON.parse(result);
  console.log('✅ Backfill completed!');
  console.log(`   Tasks backfilled: ${parsedResult.tasksBackfilled}`);
  console.log(`   Total history items added: ${parsedResult.totalHistoryItems}`);
  console.log(`   Total tasks: ${parsedResult.totalTasks}`);
} catch (error) {
  console.error('❌ Error running backfill:', error.message);
  process.exit(1);
}
