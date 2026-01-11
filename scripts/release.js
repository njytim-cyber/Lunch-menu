import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.resolve(__dirname, '../package.json');
const versionJsPath = path.resolve(__dirname, '../js/version.js');

// 1. Read package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const currentVersion = packageJson.version;
const versionParts = currentVersion.split('.').map(Number);

// 2. Increment Patch Version (Semantic Versioning)
// Bump patch (z in x.y.z)
versionParts[2]++;
const newVersion = versionParts.join('.');

console.log(`Bumping version from ${currentVersion} to ${newVersion}...`);

// 3. Update package.json
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

// 4. Update js/version.js
const versionJsContent = `export const APP_VERSION = '${newVersion}';`;
fs.writeFileSync(versionJsPath, versionJsContent);

console.log('Version updated successfully!');
console.log(`Don't forget to push changes!`);
