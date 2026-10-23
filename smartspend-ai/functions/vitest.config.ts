import { defineConfig } from 'vitest/config';

// Integration tests run against the Firebase Emulator Suite:
//   npx firebase emulators:exec --only firestore,storage,auth --project demo-smartspend "npm test -w @smartspend/functions"
export default defineConfig({
  test: {
    env: {
      GCLOUD_PROJECT: 'demo-smartspend',
      FIREBASE_CONFIG: JSON.stringify({ projectId: 'demo-smartspend', storageBucket: 'demo-smartspend.appspot.com' }),
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
      FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
      STORAGE_EMULATOR_HOST: 'http://127.0.0.1:9199',
      FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
    },
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
