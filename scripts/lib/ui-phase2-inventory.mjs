import { createHash } from "node:crypto";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import ts from "typescript";

export const digest = (value) => createHash("sha256").update(value).digest("hex");
const compact = (value = "") => value.replace(/\s+/gu, " ").trim();
const lineAt = (source, offset) => source.slice(0, offset).split("\n").length;

function attributes(node) {
  return Object.fromEntries(
    node.props.map((prop) => {
      if (prop.type === 6) return [prop.name, prop.value?.content ?? ""];
      const prefix =
        prop.arg && prop.name === "on"
          ? "@"
          : prop.arg && prop.name === "bind"
            ? ":"
            : `v-${prop.name}`;
      const argument = prop.arg?.content ?? "";
      const modifiers = prop.modifiers.map((item) => item.content ?? item).join(".");
      return [prefix + argument + (modifiers ? `.${modifiers}` : ""), prop.exp?.content ?? ""];
    }),
  );
}

function textContent(node) {
  if (node.type === 2) return node.content;
  if (node.type === 5) return `{{ ${node.content.content} }}`;
  return (node.children ?? []).map(textContent).join(" ");
}

function collectScript(source, filename, offset = 0) {
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const imports = new Set();
  const calls = [];
  const reasonAliases = new Set();
  const functions = [];
  function firstPass(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const typeOnly =
        node.isTypeOnly ||
        node.importClause?.isTypeOnly ||
        (node.importClause?.namedBindings &&
          ts.isNamedImports(node.importClause.namedBindings) &&
          !node.importClause.name &&
          node.importClause.namedBindings.elements.length > 0 &&
          node.importClause.namedBindings.elements.every((item) => item.isTypeOnly));
      if (!typeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        imports.add(node.moduleSpecifier.text);
      }
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      if (node.arguments[0] && ts.isStringLiteral(node.arguments[0]))
        imports.add(node.arguments[0].text);
    }
    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      node.initializer.expression.getText(ast) === "useAuditedReason"
    ) {
      if (ts.isObjectBindingPattern(node.name)) {
        for (const binding of node.name.elements) {
          if ((binding.propertyName ?? binding.name).getText(ast) === "ask") {
            reasonAliases.add(binding.name.getText(ast));
          }
        }
      } else reasonAliases.add(`${node.name.getText(ast)}.ask`);
    }
    if (ts.isFunctionDeclaration(node) && node.name) {
      functions.push({
        name: node.name.text,
        start: node.getStart(ast) + offset,
        end: node.end + offset,
      });
    }
    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
      functions.push({
        name: node.name.getText(ast),
        start: node.getStart(ast) + offset,
        end: node.end + offset,
      });
    }
    ts.forEachChild(node, firstPass);
  }
  firstPass(ast);
  function secondPass(node) {
    if (ts.isCallExpression(node)) {
      const target = node.expression.getText(ast);
      const nativeCall =
        /^(?:window\.)?(?:confirm|prompt)$/u.test(target) &&
        !functions.some((fn) => fn.name === target);
      const isDialog = reasonAliases.has(target) || nativeCall || /\.showModal$/u.test(target);
      if (isDialog)
        calls.push({
          target,
          expression: compact(node.getText(ast)),
          offset: offset + node.getStart(ast),
        });
    }
    ts.forEachChild(node, secondPass);
  }
  secondPass(ast);
  return { imports: [...imports].sort(), calls, functions };
}

export function scanSource(source, filename) {
  const candidates = [],
    imports = new Set(),
    functions = [],
    warnings = [];
  let template;
  let templateOffset = 0;
  const scripts = [];
  if (filename.endsWith(".vue")) {
    const parsed = parse(source, { filename });
    if (parsed.errors.length) throw new Error(`${filename}: ${parsed.errors.join("; ")}`);
    const descriptor = parsed.descriptor;
    for (const block of [descriptor.script, descriptor.scriptSetup].filter(Boolean)) {
      scripts.push({ content: block.content, offset: block.loc.start.offset });
    }
    if (descriptor.template) {
      templateOffset = descriptor.template.loc.start.offset;
      template = baseParse(descriptor.template.content);
    }
  } else scripts.push({ content: source, offset: 0 });

  function add(kind, node, attrs, conditions, extra = {}) {
    const offset = templateOffset + node.loc.start.offset;
    candidates.push({
      kind,
      tag: node.tag,
      file: filename,
      line: lineAt(source, offset),
      offset,
      sourceRange: { start: offset, end: templateOffset + node.loc.end.offset },
      label: compact(attrs["aria-label"] || attrs[":aria-label"] || textContent(node)),
      attributes: attrs,
      conditions,
      ...extra,
    });
  }
  function visit(node, ancestors = []) {
    if (node.type === 1) {
      const attrs = attributes(node);
      const ownConditions = Object.entries(attrs).filter(([key]) =>
        /^v-(?:if|else|else-if|for|show)$/u.test(key),
      );
      const conditions = [
        ...ancestors,
        ...ownConditions.map(([directive, expression]) => ({ directive, expression })),
      ];
      const events = Object.fromEntries(
        Object.entries(attrs).filter(([key]) => key.startsWith("@")),
      );
      const tag = node.tag.toLowerCase();
      const nativeDialog = tag === "dialog" || ["dialog", "alertdialog"].includes(attrs.role);
      const nativeControl =
        ["button", "a", "routerlink", "router-link", "summary"].includes(tag) ||
        (tag === "input" && ["submit", "button", "reset"].includes(attrs.type)) ||
        ["button", "menuitem", "tab", "link"].includes(attrs.role);
      if (nativeDialog) add("dialog-definition", node, attrs, conditions);
      if (nativeControl || Object.keys(events).length) {
        add(
          nativeControl ? "control" : tag === "form" ? "form-event" : "event-binding",
          node,
          attrs,
          conditions,
          { events },
        );
      }
      if (/^[A-Z]/u.test(node.tag) && /Dialog|Modal|Drawer|Overlay/u.test(node.tag)) {
        add("dialog-component-call", node, attrs, conditions, { events });
      }
      if (
        tag === "component" ||
        "v-html" in attrs ||
        Object.keys(attrs).some((key) => key === "v-bind" || key === "v-on")
      ) {
        warnings.push({
          file: filename,
          line: lineAt(source, templateOffset + node.loc.start.offset),
          reason: "dynamic-render-or-spread-requires-runtime-review",
        });
      }
      for (const child of node.children ?? []) visit(child, conditions);
      return;
    }
    for (const child of node.children ?? []) visit(child, ancestors);
  }
  if (template) visit(template);
  for (const script of scripts) {
    const result = collectScript(script.content, filename, script.offset);
    result.imports.forEach((item) => imports.add(item));
    functions.push(...result.functions);
    for (const call of result.calls) {
      candidates.push({
        kind: "dialog-script-call",
        tag: call.target,
        file: filename,
        line: lineAt(source, call.offset),
        ...call,
        label: call.expression,
        attributes: {},
        conditions: [],
      });
    }
  }
  const occurrences = new Map();
  for (const item of candidates) {
    const identityAttributes = Object.fromEntries(
      Object.entries(item.attributes).filter(
        ([key]) => !["class", ":class", "style", ":style"].includes(key),
      ),
    );
    const semantic = JSON.stringify([item.kind, item.tag, identityAttributes, item.label]);
    const signature = digest(semantic).slice(0, 16);
    const occurrence = (occurrences.get(signature) ?? 0) + 1;
    occurrences.set(signature, occurrence);
    item.candidateId = `${filename}#${signature}.${occurrence}`;
    item.signature = signature;
    item.sourceSha256 = digest(source);
    item.handlerDefinitions = functions
      .filter((fn) =>
        Object.values(item.events ?? {}).some((expression) =>
          (expression.match(/[A-Za-z_$][\w$]*/gu) ?? []).includes(fn.name),
        ),
      )
      .map((fn) => ({
        name: fn.name,
        file: filename,
        line: lineAt(source, fn.start),
        endLine: lineAt(source, fn.end),
      }));
    item.reviewStatus = "unreviewed";
    item.actionId = null;
    item.dialogId = null;
    item.sideEffect = "unknown-until-handler-reviewed";
    delete item.offset;
  }
  return { candidates, imports: [...imports].sort(), warnings };
}

export function parseLegacyInventory(markdown, type) {
  return [...markdown.matchAll(/^\| (\d+) \| \[([^\]]+):(\d+)\]\([^\n]+?\) \|/gmu)].map(
    (match) => ({ legacyId: `${type}-${match[1]}`, file: match[2], line: Number(match[3]), type }),
  );
}

export function reconcileLegacy(entries, candidates, historicalCandidates, legacySpans = []) {
  return entries.map((entry) => {
    const eligible = candidates.filter(
      (candidate) =>
        candidate.file === entry.file &&
        (entry.type === "button"
          ? candidate.kind === "control" && candidate.tag === "button"
          : candidate.kind === "dialog-definition"),
    );
    const exact = eligible.filter((candidate) => candidate.line === entry.line);
    if (historicalCandidates) {
      const span = legacySpans.find((item) => item.legacyId === entry.legacyId);
      const historical = historicalCandidates.filter(
        (candidate) =>
          candidate.file === entry.file &&
          (span
            ? candidate.sourceRange?.start >= span.start && candidate.sourceRange?.start < span.end
            : candidate.line === entry.line) &&
          (entry.type === "button"
            ? candidate.kind === "control" && candidate.tag === "button"
            : candidate.kind === "dialog-definition"),
      );
      if (historical.length) {
        const matched = [];
        for (const previous of historical) {
          const signatureMatches = eligible.filter(
            (candidate) => candidate.signature === previous.signature,
          );
          const handlerAndLabelMatches = eligible.filter(
            (candidate) =>
              candidate.label === previous.label &&
              JSON.stringify(candidate.events ?? {}) === JSON.stringify(previous.events ?? {}),
          );
          const identityMatch = signatureMatches.find(
            (candidate) => candidate.candidateId === previous.candidateId,
          );
          const match =
            identityMatch ??
            (signatureMatches.length === 1
              ? signatureMatches[0]
              : handlerAndLabelMatches.length === 1
                ? handlerAndLabelMatches[0]
                : null);
          if (match) matched.push(match);
        }
        return {
          ...entry,
          candidateIds: [...new Set(matched.map((item) => item.candidateId))],
          historicalCandidateIds: historical.map((item) => item.candidateId),
          historicalSourceRange: span ? { start: span.start, end: span.end } : null,
          disposition:
            matched.length === historical.length
              ? "historical-source-match-needs-semantic-review"
              : "unresolved-source-changed-or-removed",
          businessDisposition: null,
        };
      }
      return {
        ...entry,
        candidateIds: [],
        disposition: "unresolved-historical-regex-match",
        businessDisposition: null,
      };
    }
    return {
      ...entry,
      candidateIds: exact.map((item) => item.candidateId),
      disposition:
        exact.length === 1
          ? "source-location-match-needs-semantic-review"
          : "unresolved-source-moved-or-removed",
      businessDisposition: null,
    };
  });
}

export function reachableFiles(entry, modules, stopExpansionAt = new Set()) {
  const visited = new Set();
  function visit(file) {
    if (visited.has(file)) return;
    visited.add(file);
    if (stopExpansionAt.has(file)) return;
    for (const dependency of modules.get(file)?.dependencies ?? []) visit(dependency);
  }
  visit(entry);
  return visited;
}
