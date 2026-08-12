import { readFile } from 'node:fs/promises';
import ts from 'typescript';

export async function load(url, context, nextLoad) {
  if (!url.startsWith('file:') || !url.endsWith('.ts')) {
    return nextLoad(url, context);
  }

  const source = await readFile(new URL(url), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      isolatedModules: true,
      sourceMap: false,
    },
    fileName: new URL(url).pathname,
  });

  return {
    format: 'module',
    shortCircuit: true,
    source: output.outputText,
  };
}
