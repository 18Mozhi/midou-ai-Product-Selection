import { runModule, VerificationError } from './lib/verification-engine.mjs';

const moduleId = process.argv[2]?.trim().toUpperCase();
if (!moduleId) {
  console.error('Usage: npm run verify:module -- M00-01');
  process.exit(2);
}

try {
  await runModule(moduleId);
} catch (error) {
  if (error instanceof VerificationError) {
    console.error(JSON.stringify({
      scope: 'MODULE', id: moduleId, status: error.status, code: error.code,
      message: error.message, details: error.details,
    }, null, 2));
    process.exit(1);
  }
  throw error;
}
