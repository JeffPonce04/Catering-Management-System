import { existsSync } from 'node:fs';

const required = [
  'src/main.jsx',
  'src/app/App.jsx',
  'src/app/router/AppRouter.jsx',
  'src/app/providers/AppProviders.jsx',
  'src/services/api.js',
  'src/features/auth/pages/LoginPage.jsx',
  'src/features/dashboard/pages/DashboardPage.jsx',
];

const missing = required.filter((path) => !existsSync(path));
if (missing.length) {
  console.error('Missing required files:', missing.join(', '));
  process.exit(1);
}
console.log('Professional project structure check passed.');
