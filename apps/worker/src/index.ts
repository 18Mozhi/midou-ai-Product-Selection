import { loadRuntimeConfig } from '@scoutops/config';
import { createDatabasePool } from '@scoutops/database';
import { createRedisConnection, ScopedRedisStore } from '@scoutops/redis';
import { ProviderAdapterRegistry } from '@scoutops/provider-adapters';
import { createBuiltinSourceAdapters } from '@scoutops/provider-sources';
import { PendingMailProvider, processAuthDeliveryOnce } from './auth-delivery-worker.js';
import { MySqlCollectionTaskWorkerRepository, ScopedRedisCollectionCoordinator, processCollectionTaskOnce } from './collection-task-worker.js';
import { MySqlEvidencePersistence } from './evidence-persistence.js';
import { ProviderSourceExecutor } from './provider-source-executor.js';
import { MySqlTrendProjectionWorker } from './trend-projection-worker.js';
import { MySqlOpportunityRefreshWorker } from './opportunity-refresh-worker.js';
import { MySqlOpportunityScoringWorker } from './opportunity-scoring-worker.js';
import { MySqlOpportunityProfitWorker } from './opportunity-profit-worker.js';

const config = loadRuntimeConfig(process.env, 'worker');
const pool = createDatabasePool(config);
const redisClient = createRedisConnection(config);
const redisStore = new ScopedRedisStore(redisClient);
const registry = new ProviderAdapterRegistry({ healthTimeoutMs: config.providerAdapters.healthTimeoutMs, maxResponseBytes: config.providerAdapters.maxResponseBytes, maxItemsPerBatch: config.providerAdapters.maxItemsPerBatch });
for (const adapter of createBuiltinSourceAdapters()) registry.register(adapter);
const collectionRepository = new MySqlCollectionTaskWorkerRepository(pool);
const coordinator = new ScopedRedisCollectionCoordinator(redisStore);
const executor = new ProviderSourceExecutor(pool, registry, new MySqlEvidencePersistence(pool, config.storage.evidenceRoot, config.evidence.maxRawBytes), config.identity.workerId);
const trendProjection = new MySqlTrendProjectionWorker(pool, config.identity.workerId, config.trends.projectionLeaseSeconds);
const opportunityRefresh = new MySqlOpportunityRefreshWorker(pool, config.identity.workerId, config.opportunities.refreshLeaseSeconds);
const opportunityScoring = new MySqlOpportunityScoringWorker(pool, config.identity.workerId, config.scoring.leaseSeconds);
const opportunityProfit = new MySqlOpportunityProfitWorker(pool, config.identity.workerId, config.profit.leaseSeconds);
let stopping = false, authPolling = false, collectionPolling = false, trendPolling = false, opportunityPolling = false, scoringPolling = false, profitPolling = false;

const heartbeat = () => console.log(JSON.stringify({ service: 'product-scout-worker', status: stopping ? 'stopping' : 'idle', worker_id: config.identity.workerId, registered_sources: registry.describe().map(item => item.key), trend_projection: 'registered', opportunity_refresh: 'registered', opportunity_scoring: 'registered', opportunity_profit: 'registered', config_fingerprint: config.configFingerprint, observed_at: new Date().toISOString() }));
const pollAuth = async () => { if (stopping || authPolling || !config.security.credentialsMasterKey) return; authPolling = true; try { const result = await processAuthDeliveryOnce({ pool, workerId: config.identity.workerId, masterKey: config.security.credentialsMasterKey, provider: new PendingMailProvider() }); if (result.status !== 'idle') console.log(JSON.stringify({ service: 'product-scout-worker', queue: 'auth_delivery', ...result, observed_at: new Date().toISOString() })); } catch { console.error(JSON.stringify({ service: 'product-scout-worker', queue: 'auth_delivery', status: 'dependency_failed', observed_at: new Date().toISOString() })); } finally { authPolling = false; } };
const pollCollection = async () => { if (stopping || collectionPolling) return; collectionPolling = true; try { await redisStore.connect(); const result = await processCollectionTaskOnce({ repository: collectionRepository, coordinator, executor, workerId: config.identity.workerId, leaseSeconds: config.collectionTasks.leaseSeconds }); if (result.status !== 'idle') console.log(JSON.stringify({ service: 'product-scout-worker', queue: 'collection_tasks', ...result, observed_at: new Date().toISOString() })); } catch (error) { console.error(JSON.stringify({ service: 'product-scout-worker', queue: 'collection_tasks', status: 'dependency_failed', error: error instanceof Error ? error.message : 'unknown', observed_at: new Date().toISOString() })); } finally { collectionPolling = false; } };
const pollTrends = async () => { if (stopping || trendPolling) return; trendPolling = true; try { const result = await trendProjection.processOnce(); if (result.status !== 'idle') console.log(JSON.stringify({ service: 'product-scout-worker', queue: 'trend_projection', ...result, observed_at: new Date().toISOString() })); } catch (error) { console.error(JSON.stringify({ service: 'product-scout-worker', queue: 'trend_projection', status: 'dependency_failed', error: error instanceof Error ? error.message : 'unknown', observed_at: new Date().toISOString() })); } finally { trendPolling = false; } };
const pollOpportunities = async () => { if (stopping || opportunityPolling) return; opportunityPolling = true; try { const result = await opportunityRefresh.processOnce(); if (result.status !== 'idle') console.log(JSON.stringify({ service: 'product-scout-worker', queue: 'opportunity_refresh', ...result, observed_at: new Date().toISOString() })); } catch (error) { console.error(JSON.stringify({ service: 'product-scout-worker', queue: 'opportunity_refresh', status: 'dependency_failed', error: error instanceof Error ? error.message : 'unknown', observed_at: new Date().toISOString() })); } finally { opportunityPolling = false; } };
const pollScoring = async () => { if (stopping || scoringPolling) return; scoringPolling = true; try { const result = await opportunityScoring.processOnce(); if (result.status !== 'idle') console.log(JSON.stringify({ service: 'product-scout-worker', queue: 'opportunity_scoring', ...result, observed_at: new Date().toISOString() })); } catch (error) { console.error(JSON.stringify({ service: 'product-scout-worker', queue: 'opportunity_scoring', status: 'dependency_failed', error: error instanceof Error ? error.message : 'unknown', observed_at: new Date().toISOString() })); } finally { scoringPolling = false; } };
const pollProfit = async () => { if (stopping || profitPolling) return; profitPolling = true; try { const result = await opportunityProfit.processOnce(); if (result.status !== 'idle') console.log(JSON.stringify({ service: 'product-scout-worker', queue: 'opportunity_profit', ...result, observed_at: new Date().toISOString() })); } catch (error) { console.error(JSON.stringify({ service: 'product-scout-worker', queue: 'opportunity_profit', status: 'dependency_failed', error: error instanceof Error ? error.message : 'unknown', observed_at: new Date().toISOString() })); } finally { profitPolling = false; } };

heartbeat();
const heartbeatTimer = setInterval(heartbeat, config.runtime.workerHeartbeatMs);
const authTimer = setInterval(() => void pollAuth(), config.auth.outboxPollMs);
const collectionTimer = setInterval(() => void pollCollection(), config.collectionTasks.pollMs);
const trendTimer = setInterval(() => void pollTrends(), config.trends.projectionPollMs);
const opportunityTimer = setInterval(() => void pollOpportunities(), config.opportunities.refreshPollMs);
const scoringTimer = setInterval(() => void pollScoring(), config.scoring.pollMs);
const profitTimer = setInterval(() => void pollProfit(), config.profit.pollMs);
void pollAuth(); void pollCollection(); void pollTrends(); void pollOpportunities(); void pollScoring(); void pollProfit();

const stop = async (signal: string) => {
  if (stopping) return; stopping = true;
  clearInterval(heartbeatTimer); clearInterval(authTimer); clearInterval(collectionTimer); clearInterval(trendTimer); clearInterval(opportunityTimer); clearInterval(scoringTimer); clearInterval(profitTimer);
  while (authPolling || collectionPolling || trendPolling || opportunityPolling || scoringPolling || profitPolling) await new Promise(resolve => setTimeout(resolve, 25));
  await redisStore.close(); await pool.end();
  console.log(JSON.stringify({ service: 'product-scout-worker', status: 'stopped', signal, worker_id: config.identity.workerId, observed_at: new Date().toISOString() }));
};
process.once('SIGTERM', () => void stop('SIGTERM'));
process.once('SIGINT', () => void stop('SIGINT'));
