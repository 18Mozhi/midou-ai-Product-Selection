import { runAll, VerificationError } from './lib/verification-engine.mjs';

try {
  console.log(JSON.stringify(await runAll(), null, 2));
} catch (error) {
  if (error instanceof VerificationError) {
    console.error(JSON.stringify({
      scope: 'ALL', id: 'P00-P08', status: error.status, code: error.code,
      message: error.message, details: error.details,
    }, null, 2));
    process.exit(1);
  }
  throw error;
}
