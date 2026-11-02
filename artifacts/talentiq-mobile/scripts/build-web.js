const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');

console.log('📦 Step 1: Exporting Expo Web application...');
execSync('pnpm exec expo export --platform web', {
  cwd: projectRoot,
  stdio: 'inherit',
});

if (!fs.existsSync(distDir)) {
  console.error('❌ dist directory was not created!');
  process.exit(1);
}

const indexHtmlPath = path.join(distDir, 'index.html');
if (!fs.existsSync(indexHtmlPath)) {
  console.error('❌ dist/index.html not found!');
  process.exit(1);
}

const indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

// 1. Create 404.html for Vercel SPA routing
fs.writeFileSync(path.join(distDir, '404.html'), indexHtmlContent, 'utf8');
console.log('✅ Created dist/404.html (Vercel SPA fallback)');

// 2. Create static route files for all client-side routes
const routes = [
  'auth/callback',
  'jobs',
  'profile',
  'assessment',
  'hr-dashboard',
  'role-select',
  'onboarding',
  'ai-insights',
  'applications',
  'create-job',
];

for (const route of routes) {
  const targetDir = path.join(distDir, route);
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'index.html'), indexHtmlContent, 'utf8');
  fs.writeFileSync(path.join(distDir, `${route}.html`), indexHtmlContent, 'utf8');
}

console.log('✅ Generated static route HTML for all Expo Router pages!');
