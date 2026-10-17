import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT_DIR = process.cwd();
const STATIC_DIR = path.join(ROOT_DIR, 'dist-static');
const STATIC_ZIP = path.join(ROOT_DIR, 'omani-encyclopedia-static-bundle.zip');

if (fs.existsSync(STATIC_ZIP)) {
  fs.unlinkSync(STATIC_ZIP);
}

console.log('جاري ضغط حزمة الموقع الثابت (dist-static)...');
const psCommand = `powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${STATIC_DIR}', '${STATIC_ZIP}')"`;
execSync(psCommand, { stdio: 'inherit' });

const stat = fs.statSync(STATIC_ZIP);
console.log(`تم بنجاح إنشاء حزمة الموقع الثابت: ${STATIC_ZIP} (${(stat.size / 1024).toFixed(1)} KB)`);
