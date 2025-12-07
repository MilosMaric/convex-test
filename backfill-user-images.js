import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Map user names to their base64 file names
const userFileMap = {
  'Naruto': 'naruto.txt',
  'Sasuke': 'sasuke.txt',
  'Sakura': 'sakura.txt',
  'Kakashi': 'kakashi.txt',
  'Hinata': 'hinata.txt',
  'Jiraya': 'jiraya.txt',
  'Rock Lee': 'rocklee.txt',
  'Shikamaru': 'shikamaru.txt',
  'Konohamaru': 'konohamaru.txt',
};

const base64Dir = path.join(__dirname, 'public', 'base64');

// Read all users from Convex
console.log('Fetching users from Convex...');
const usersOutput = execSync('npx convex run tasks:getAllUsers', { encoding: 'utf-8' });
const users = JSON.parse(usersOutput);

console.log(`Found ${users.length} users`);

// Process each user
for (const user of users) {
  const fileName = userFileMap[user.name];
  if (!fileName) {
    console.log(`⚠️  No image file found for user: ${user.name}`);
    continue;
  }

  const filePath = path.join(base64Dir, fileName);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Image file not found: ${filePath}`);
    continue;
  }

  // Read base64 string from file
  console.log(`Processing ${user.name}...`);
  const imageBase64 = fs.readFileSync(filePath, 'utf-8').trim();

  // Update user in Convex
  const args = JSON.stringify({
    userId: user._id,
    imageBase64: imageBase64,
  });

  try {
    execSync(`npx convex run tasks:updateUserImage '${args}'`, { encoding: 'utf-8' });
    console.log(`✅ Updated image for ${user.name}`);
  } catch (error) {
    console.error(`❌ Error updating ${user.name}:`, error.message);
  }
}

console.log('Done!');

