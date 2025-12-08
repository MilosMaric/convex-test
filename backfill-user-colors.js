import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Map user names to their hex colors
const userColorMap = {
  'Sakura': '#FFB6C1', // pink
  'Kakashi': '#D3D3D3', // light gray
  'Sasuke': '#00008B', // dark blue
  'Rock Lee': '#90EE90', // light green
  'Shikamaru': '#006400', // dark green
  'Jiraya': '#FF0000', // red
  'Hinata': '#800080', // purple
  'Konohamaru': '#ADD8E6', // light blue
  'Naruto': '#FFA500', // orange
};

// Read all users from Convex
console.log('Fetching users from Convex...');
const tempFile = path.join(__dirname, 'temp-users.json');
try {
  execSync(`npx convex run tasks:getAllUsers > "${tempFile}"`, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
  const usersOutput = fs.readFileSync(tempFile, 'utf-8');
  const users = JSON.parse(usersOutput);
  fs.unlinkSync(tempFile); // Clean up temp file

  
  console.log(`Found ${users.length} users`);

  // Process each user
  for (const user of users) {
    const color = userColorMap[user.name];
    if (!color) {
      console.log(`⚠️  No color found for user: ${user.name}`);
      continue;
    }

    // Update user in Convex
    const args = JSON.stringify({
      userId: user._id,
      color: color,
    });

    try {
      execSync(`npx convex run tasks:updateUserColor '${args}'`, { encoding: 'utf-8' });
      console.log(`✅ Updated color for ${user.name}: ${color}`);
    } catch (error) {
      console.error(`❌ Error updating ${user.name}:`, error.message);
    }
  }

  console.log('Done!');
} catch (error) {
  console.error('Error:', error.message);
  if (fs.existsSync(tempFile)) {
    fs.unlinkSync(tempFile); // Clean up temp file on error
  }
  process.exit(1);
}
