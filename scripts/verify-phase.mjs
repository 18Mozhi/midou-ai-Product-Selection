import { runPhase, VerificationError } from './lib/verification-engine.mjs';

const phaseId = process.argv[2]?.trim().toUpperCase();
if (!phaseId) {
  console.error('Usage: npm run verify:phase -- P00');
  process.exit(2);
}

try {
  console.log(JSON.stringify(await runPhase(phaseId), null, 2));
} catch (error) {
  if (error instanceof VerificationError) {
    console.error(JSON.stringify({
      scope: 'PHASE', id: phaseId, status: error.status, code: error.code,
      message: error.message, details: error.details,
    }, null, 2));
    process.exit(1);
  }
  throw error;
}
