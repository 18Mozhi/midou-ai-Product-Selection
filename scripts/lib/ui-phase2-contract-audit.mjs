import path from "node:path";
import { digest, scanSource } from "./ui-phase2-inventory.mjs";

const component = (name) => `apps/web/src/components/${name.replace(/\.vue$/, "")}.vue`;
const signaturePattern = /\b[0-9a-f]{16}\.\d+\b/g;
const kinds = new Set([
  "control",
  "event-binding",
  "form-event",
  "dialog-definition",
  "dialog-component-call",
  "dialog-script-call",
]);
const clean = (text) => text.replaceAll("`", "").trim();

// Only explicit document aliases supplied by the caller are trusted. Never resolve by a
// globally matching signature: shared buttons frequently have identical signatures.
function sourceFile(token, aliases) {
  token = clean(token).replace(/:\d+$/, "");
  if (aliases[token]) return component(aliases[token]);
  if (/^apps\/web\/src\/(?:[\w-]+\/)*[\w-]+\.(?:vue|ts)$/.test(token)) return token;
  if (/^[A-Z][A-Za-z0-9]+\.vue$/.test(token)) return component(token);
  return null;
}

export function parseContract(
  text,
  { file, aliases = {}, defaultComponent = null, historicalSections = [], historicalColumns = [] },
) {
  const references = [],
    hashes = [];
  let sectionFile = defaultComponent ? component(defaultComponent) : null;
  let previousCells = [],
    headers = [];
  const sectionScopes = new Map();
  for (const [index, raw] of text.replaceAll("\r\n", "\n").split("\n").entries()) {
    const heading = raw.match(/^#{2,6}\s+(.+)$/);
    if (heading) {
      const title = clean(heading[1]);
      const level = raw.match(/^#+/)[0].length;
      for (const key of sectionScopes.keys()) if (key >= level) sectionScopes.delete(key);
      sectionScopes.set(level, historicalSections.includes(title));
      sectionFile =
        sourceFile(title, aliases) ??
        (/^[A-Z][A-Za-z0-9]+$/.test(title) ? component(title) : null) ??
        (defaultComponent ? component(defaultComponent) : null);
    }
    const temporalScope = [...sectionScopes.values()].some(Boolean) ? "historical" : "unclassified";
    if (!raw.startsWith("|")) {
      previousCells = [];
      headers = [];
      continue;
    }
    const cells = raw.split("|").slice(1, -1).map(clean);
    if (cells.length && cells.every((cell) => /^:?-+:?$/.test(cell))) headers = previousCells;
    previousCells = cells;
    const hash = cells.find((cell) => /^[0-9a-f]{64}$/.test(cell));
    if (hash) {
      const declared =
        cells.map((cell) => sourceFile(cell, aliases)).find(Boolean) ??
        cells.find((cell) => /^(?:apps|packages|config)\/[\w./-]+$/.test(cell));
      if (declared && !declared.split("/").includes(".."))
        hashes.push({ file: declared, hash, line: index + 1, temporalScope });
    }
    const matches = [...raw.matchAll(signaturePattern)];
    const first = cells[0] ?? "";
    const lineOnly = first.match(/^([A-Z]+)(\d+)$/);
    if (!matches.length && lineOnly && aliases[lineOnly[1]] && headers[0] === "组件行") {
      references.push({
        document: file,
        documentLine: index + 1,
        sourceFile: component(aliases[lineOnly[1]]),
        signature: null,
        recordedLine: Number(lineOnly[2]),
        recordedKind: null,
        temporalScope,
        claim: raw,
      });
    }
    for (const match of matches) {
      const prefix = raw.slice(0, match.index);
      const column = prefix.split("|").length - 2;
      const referenceScope = historicalColumns.includes(headers[column])
        ? "historical"
        : temporalScope;
      const adjacent = prefix.match(/([A-Za-z][\w./-]*(?::\d+)?)\s*[#: ]\s*$/)?.[1];
      const firstLocation = first.match(/^([\w./-]+):\d+$/)?.[1];
      const explicitLocation = adjacent ?? firstLocation;
      const namedFile = explicitLocation
        ? (sourceFile(explicitLocation, aliases) ??
          (firstLocation && /^[A-Z][a-z][A-Za-z0-9]+$/.test(firstLocation)
            ? component(firstLocation)
            : null))
        : (sourceFile(first, aliases) ?? sectionFile);
      const locatedLine = (adjacent ?? first).match(/:(\d+)$/)?.[1];
      const numericCell = cells.find((cell) => /^\d+$/.test(cell));
      const kindCell = cells.find((cell) => kinds.has(cell.split(" / ")[0]));
      const kindLine = kindCell?.match(/\/\s*(\d+)$/)?.[1];
      references.push({
        document: file,
        documentLine: index + 1,
        sourceFile: namedFile,
        signature: match[0],
        recordedLine:
          referenceScope === "historical" && temporalScope !== "historical"
            ? null
            : Number(locatedLine ?? numericCell ?? kindLine) || null,
        recordedKind: kindCell?.split(" / ")[0] ?? null,
        temporalScope: referenceScope,
        claim: raw,
      });
    }
  }
  return { file, hash: digest(text.replaceAll("\r\n", "\n")), references, hashes };
}

export function auditContracts({ documents, sources }) {
  const modules = new Map(
    [...sources].map(([file, raw]) => {
      const source = raw.replaceAll("\r\n", "\n");
      return [file, { hash: digest(source), ...scanSource(source, file) }];
    }),
  );
  const records = [],
    sourceClaims = [];
  for (const document of documents) {
    for (const claim of document.hashes)
      sourceClaims.push({
        document: document.file,
        ...claim,
        status: !sources.has(claim.file)
          ? "not-in-web-scan"
          : modules.get(claim.file).hash === claim.hash
            ? "hash-current"
            : "hash-drift",
      });
    for (const ref of document.references) {
      const module = modules.get(ref.sourceFile);
      const candidateId =
        ref.signature && ref.sourceFile ? `${ref.sourceFile}#${ref.signature}` : null;
      const candidate = module?.candidates.find((item) => item.candidateId === candidateId);
      const expectedHashes = document.hashes.filter((item) => item.file === ref.sourceFile);
      const binding = !expectedHashes.length
        ? "unrecorded"
        : expectedHashes.every((item) => item.hash === module?.hash)
          ? "hash-current"
          : "hash-drift";
      const status = !ref.signature
        ? "line-only-unbound"
        : !ref.sourceFile
          ? "file-unbound"
          : !module
            ? "source-missing"
            : !candidate
              ? "identity-not-found"
              : ref.recordedKind && candidate.kind !== ref.recordedKind
                ? "kind-drift"
                : ref.recordedLine && ref.recordedLine !== candidate.line
                  ? "line-moved"
                  : "identity-current";
      records.push({
        ...ref,
        candidateId,
        status,
        sourceBinding: binding,
        currentLine: candidate?.line ?? null,
      });
    }
  }
  const byCandidate = new Map();
  for (const record of records.filter(
    (item) =>
      item.temporalScope !== "historical" &&
      ["identity-current", "line-moved"].includes(item.status),
  )) {
    if (!byCandidate.has(record.candidateId)) byCandidate.set(record.candidateId, []);
    byCandidate
      .get(record.candidateId)
      .push({ document: record.document, line: record.documentLine });
  }
  const unreferenced = [...modules.values()]
    .flatMap((module) => module.candidates)
    .filter((item) => !byCandidate.has(item.candidateId))
    .map((item) => ({
      candidateId: item.candidateId,
      file: item.file,
      line: item.line,
      kind: item.kind,
      label: item.label,
    }));
  const repeatedReferences = [...byCandidate]
    .filter(([, refs]) => refs.length > 1)
    .map(([candidateId, references]) => ({ candidateId, references }));
  const statuses = {},
    historicalStatuses = {};
  for (const record of records) {
    const counts = record.temporalScope === "historical" ? historicalStatuses : statuses;
    counts[record.status] = (counts[record.status] ?? 0) + 1;
  }
  return {
    status: "static-reconciliation-runtime-and-approval-pending",
    denominatorFrozen: false,
    summary: {
      documents: documents.length,
      sourceFiles: sources.size,
      references: records.length,
      sourceCandidates: [...modules.values()].reduce(
        (sum, module) => sum + module.candidates.length,
        0,
      ),
      uniquelyReferencedCandidates: byCandidate.size,
      unreferencedCandidates: unreferenced.length,
      repeatedCandidates: repeatedReferences.length,
      historicalReferences: records.filter((record) => record.temporalScope === "historical")
        .length,
      statuses,
      historicalStatuses,
    },
    documents: documents.map(({ file, hash, references }) => ({
      file,
      hash,
      references: references.length,
    })),
    sourceFingerprint: digest(
      JSON.stringify([...modules].map(([file, module]) => [file, module.hash]).sort()),
    ),
    records,
    sourceClaims,
    repeatedReferences,
    unreferenced,
  };
}

export function auditPageSpecs({ catalog, matrix, specs, exists }) {
  const rows = [...matrix.matchAll(/^\| (P\d{2}) \| `([^`]+)` [^|]+\| `([^`]+)` \|/gm)];
  const issues = [];
  const seen = new Set();
  for (const [index, route] of catalog.routes.entries()) {
    const id = `P${String(index + 1).padStart(2, "0")}`;
    const matches = rows.filter((row) => row[1] === id);
    const spec = specs.get(id);
    seen.add(id);
    if (matches.length !== 1 || matches[0][2] !== route.path)
      issues.push({ id, kind: "matrix-route-mismatch" });
    if (spec === undefined) {
      issues.push({ id, kind: "spec-missing" });
      continue;
    }
    if (!(spec.match(/\/[A-Za-z0-9_:().*\/-]*/g) ?? []).includes(route.path))
      issues.push({ id, kind: "spec-route-missing" });
    for (const match of spec.matchAll(/\]\(([^)]+)\)/g)) {
      const target = match[1].split("#")[0].replace(/:\d+$/, "");
      if (!target || /^(?:https?:|mailto:)/.test(target)) continue;
      if (/^[a-z]+:/i.test(target) || path.isAbsolute(target) || !exists(id, target))
        issues.push({ id, kind: "local-link-invalid", target });
    }
  }
  for (const id of specs.keys()) if (!seen.has(id)) issues.push({ id, kind: "extra-spec" });
  for (const row of rows)
    if (!seen.has(row[1])) issues.push({ id: row[1], kind: "extra-matrix-row" });
  return { routes: catalog.routes.length, specs: specs.size, issues };
}
