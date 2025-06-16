import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
// Removed: import { cwd } from 'node:process';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on mode (development, production)
  // The third argument '' ensures all variables are loaded, not just VITE_ prefixed ones.
  const env = loadEnv(mode, process.cwd(), ''); // Changed cwd() to process.cwd()

  const repoName = process.env.GITHUB_REPOSITORY_NAME || 'your-repo-name'; // Replace 'your-repo-name' or set GITHUB_REPOSITORY_NAME

  return {
    plugins: [react()],
    base: mode === 'production' ? `/${repoName}/` : '/',
    define: {
      // Make process.env.API_KEY available in your client-side code
      // It will be replaced with its value during build time.
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
    build: {
      outDir: 'dist',
    }
  }
})