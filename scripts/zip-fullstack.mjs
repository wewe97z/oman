import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT_DIR = process.cwd();
const STAGING_DIR = path.join(ROOT_DIR, 'staging-fullstack');
const OUT_ZIP = path.join(ROOT_DIR, 'omani-encyclopedia-fullstack-package.zip');

console.log('--- بدء تجميع حزمة المشروع الكاملة الجاهزة للإنتاج (Full-Stack Production Package) ---');

if (fs.existsSync(STAGING_DIR)) {
  fs.rmSync(STAGING_DIR, { recursive: true, force: true });
}
fs.mkdirSync(STAGING_DIR, { recursive: true });

// قائمة المجلدات والملفات المطلوبة
const itemsToCopy = [
  'src',
  'public',
  'data',
  'scripts',
  'tests',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'next.config.mjs',
  'tailwind.config.ts',
  'postcss.config.mjs',
  '.env.example',
  'Dockerfile',
  'docker-compose.yml',
  'vercel.json',
  '.dockerignore',
  'DEPLOYMENT.md',
];

for (const item of itemsToCopy) {
  const srcPath = path.join(ROOT_DIR, item);
  const destPath = path.join(STAGING_DIR, item);
  if (!fs.existsSync(srcPath)) continue;

  const stat = fs.statSync(srcPath);
  if (stat.isDirectory()) {
    fs.cpSync(srcPath, destPath, {
      recursive: true,
      filter: (src) => {
        // استبعاد أي ملفات مؤقتة أو كاش
        if (src.includes('node_modules') || src.includes('.next') || src.includes('.git') || src.includes('dist-')) {
          return false;
        }
        return true;
      },
    });
  } else {
    fs.copyFileSync(srcPath, destPath);
  }
}

// إنشاء ملف README.md تعريفي داخل الحزمة
const readmeContent = `# الموسوعة العُمانية الرقمية الذكية — Omani Digital Encyclopedia AI
حزمة المشروع البرمجية الكاملة للإنتاج (Full-Stack Next.js 14 App).

للاطلاع على خطوات النشر الكاملة على Vercel أو Supabase أو Docker، راجع ملف:
DEPLOYMENT.md المرفق داخل هذه الحزمة.
`;
fs.writeFileSync(path.join(STAGING_DIR, 'README.md'), readmeContent, 'utf8');

// إنشاء ملف .gitignore نظيف داخل الحزمة
const gitignoreContent = `node_modules
.next
.env
.env.local
*.log
dist-web
dist-static
staging-fullstack
*.zip
`;
fs.writeFileSync(path.join(STAGING_DIR, '.gitignore'), gitignoreContent, 'utf8');

// ضغط الحزمة
if (fs.existsSync(OUT_ZIP)) {
  fs.unlinkSync(OUT_ZIP);
}

console.log('جاري ضغط الحزمة بواسطة PowerShell System.IO.Compression...');
const psCommand = `powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${STAGING_DIR}', '${OUT_ZIP}')"`;
execSync(psCommand, { stdio: 'inherit' });

// تنظيف مجلد التجهيز المؤقت
fs.rmSync(STAGING_DIR, { recursive: true, force: true });

const stat = fs.statSync(OUT_ZIP);
console.log(`تم بنجاح إنشاء حزمة المشروع الكاملة: ${OUT_ZIP} (${(stat.size / 1024).toFixed(1)} KB)`);
