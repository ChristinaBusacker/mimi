import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const patchDirectory = join(projectRoot, 'backend', 'src', 'migrations', 'patches');
const sourceRoots = [
  join(projectRoot, 'frontend', 'src'),
  join(projectRoot, 'backend', 'src'),
  join(projectRoot, 'shared'),
];
const sourceExtensions = new Set(['.html', '.mjml', '.ts']);
const testFilePattern = /\.(spec|test)\.ts$/u;
const staticStringPattern = /(['"`])([A-Za-z0-9_.:-]+)\1/gu;
const staticPipePattern = /(['"`])([A-Za-z0-9_.:-]+)\1\s*\|\s*i18n\b/gu;
const dynamicTemplatePipePattern = /`([A-Za-z0-9_.:-]*)\$\{[^`]+\}[^`]*`\s*\|\s*i18n\b/gu;
const dynamicConcatenationPipePattern =
  /(['"])([A-Za-z0-9_.:-]+)\1\s*\+\s*[^|]+\|\s*i18n\b/gu;

function toProjectPath(path) {
  return relative(projectRoot, path).replaceAll('\\', '/');
}

async function collectFiles(directory, predicate) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(path, predicate)));
      continue;
    }

    if (entry.isFile() && predicate(path)) {
      files.push(path);
    }
  }

  return files;
}

function lineNumberAt(content, index) {
  let line = 1;

  for (let position = 0; position < index; position += 1) {
    if (content[position] === '\n') {
      line += 1;
    }
  }

  return line;
}

function collectMatches(content, pattern, valueGroup) {
  const matches = [];
  pattern.lastIndex = 0;

  for (const match of content.matchAll(pattern)) {
    matches.push({
      value: match[valueGroup],
      index: match.index,
    });
  }

  return matches;
}

function sameTranslation(left, right) {
  return left.de === right.de && left.en === right.en;
}

function validateLocalization(entry, file, index) {
  if (
    typeof entry !== 'object' ||
    entry === null ||
    typeof entry.key !== 'string' ||
    entry.key.trim() === '' ||
    typeof entry.de !== 'string' ||
    typeof entry.en !== 'string'
  ) {
    throw new Error(
      `${toProjectPath(file)} contains an invalid localization at index ${index}. ` +
        'Expected non-empty key plus string values for de and en.',
    );
  }

  return {
    key: entry.key,
    de: entry.de,
    en: entry.en,
    file: toProjectPath(file),
    index,
  };
}

async function loadDefinitions() {
  const patchFiles = (
    await collectFiles(patchDirectory, (path) => extname(path) === '.json')
  ).sort();
  const definitions = new Map();

  for (const file of patchFiles) {
    const parsed = JSON.parse(await readFile(file, 'utf8'));

    if (parsed.localizations === undefined) {
      continue;
    }

    if (!Array.isArray(parsed.localizations)) {
      throw new Error(`${toProjectPath(file)} has a non-array "localizations" property.`);
    }

    parsed.localizations.forEach((entry, index) => {
      const localization = validateLocalization(entry, file, index);
      const existing = definitions.get(localization.key) ?? [];
      existing.push(localization);
      definitions.set(localization.key, existing);
    });
  }

  return {
    patchFiles: patchFiles.map(toProjectPath),
    definitions,
  };
}

async function loadSources() {
  const files = [];

  for (const sourceRoot of sourceRoots) {
    files.push(
      ...(await collectFiles(
        sourceRoot,
        (path) => sourceExtensions.has(extname(path)) && !testFilePattern.test(path),
      )),
    );
  }

  return Promise.all(
    files.sort().map(async (path) => ({
      path: toProjectPath(path),
      content: await readFile(path, 'utf8'),
    })),
  );
}

function analyzeUsage(definitions, sources) {
  const staticUsage = new Map();
  const missing = new Map();
  const dynamicPrefixes = new Map();
  const unresolvedDynamicSites = [];

  for (const source of sources) {
    const lineHasStaticPipe = new Set();

    for (const match of collectMatches(source.content, staticStringPattern, 2)) {
      if (!definitions.has(match.value)) {
        continue;
      }

      const usages = staticUsage.get(match.value) ?? [];
      usages.push({
        file: source.path,
        line: lineNumberAt(source.content, match.index),
      });
      staticUsage.set(match.value, usages);
    }

    for (const match of collectMatches(source.content, staticPipePattern, 2)) {
      const line = lineNumberAt(source.content, match.index);
      lineHasStaticPipe.add(line);

      if (definitions.has(match.value)) {
        continue;
      }

      const usages = missing.get(match.value) ?? [];
      usages.push({ file: source.path, line });
      missing.set(match.value, usages);
    }

    for (const match of collectMatches(source.content, dynamicTemplatePipePattern, 1)) {
      const prefixes = dynamicPrefixes.get(match.value) ?? [];
      prefixes.push({
        file: source.path,
        line: lineNumberAt(source.content, match.index),
      });
      dynamicPrefixes.set(match.value, prefixes);
    }

    for (const match of collectMatches(source.content, dynamicConcatenationPipePattern, 2)) {
      const prefixes = dynamicPrefixes.get(match.value) ?? [];
      prefixes.push({
        file: source.path,
        line: lineNumberAt(source.content, match.index),
      });
      dynamicPrefixes.set(match.value, prefixes);
    }

    source.content.split(/\r?\n/u).forEach((lineContent, index) => {
      if (!lineContent.includes('| i18n') || lineHasStaticPipe.has(index + 1)) {
        return;
      }

      const trimmed = lineContent.trim();

      if (
        dynamicTemplatePipePattern.test(trimmed) ||
        dynamicConcatenationPipePattern.test(trimmed)
      ) {
        dynamicTemplatePipePattern.lastIndex = 0;
        dynamicConcatenationPipePattern.lastIndex = 0;
        return;
      }

      dynamicTemplatePipePattern.lastIndex = 0;
      dynamicConcatenationPipePattern.lastIndex = 0;
      unresolvedDynamicSites.push({
        file: source.path,
        line: index + 1,
        expression: trimmed,
      });
    });
  }

  const dynamicUsage = new Map();

  for (const [key] of definitions) {
    if (staticUsage.has(key)) {
      continue;
    }

    const matchingPrefixes = [...dynamicPrefixes.entries()].filter(
      ([prefix]) => prefix !== '' && key.startsWith(prefix),
    );

    if (matchingPrefixes.length > 0) {
      dynamicUsage.set(
        key,
        matchingPrefixes.flatMap(([, locations]) => locations),
      );
    }
  }

  return {
    staticUsage,
    dynamicUsage,
    missing,
    dynamicPrefixes,
    unresolvedDynamicSites,
  };
}

function createReport(loadedDefinitions, usage, sources) {
  const definitions = [...loadedDefinitions.definitions.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );
  const redefined = definitions
    .filter(([, entries]) => entries.length > 1)
    .map(([key, entries]) => ({
      key,
      kind: entries.every((entry) => sameTranslation(entries[0], entry))
        ? 'duplicate'
        : 'override',
      definitions: entries,
    }));
  const unused = definitions
    .filter(
      ([key]) => !usage.staticUsage.has(key) && !usage.dynamicUsage.has(key),
    )
    .map(([key, entries]) => ({
      key,
      definitions: entries,
    }));
  const missing = [...usage.missing.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, locations]) => ({ key, locations }));
  const dynamic = [...usage.dynamicUsage.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, locations]) => ({ key, locations }));

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      patchFiles: loadedDefinitions.patchFiles.length,
      sourceFiles: sources.length,
      uniqueKeys: definitions.length,
      staticallyUsedKeys: usage.staticUsage.size,
      dynamicallyMatchedKeys: usage.dynamicUsage.size,
      unusedCandidates: unused.length,
      redefinedKeys: redefined.length,
      missingKeys: missing.length,
      unresolvedDynamicSites: usage.unresolvedDynamicSites.length,
    },
    redefined,
    unused,
    missing,
    dynamic,
    unresolvedDynamicSites: usage.unresolvedDynamicSites,
  };
}

function printLocations(locations) {
  return locations.map((location) => `${location.file}:${location.line}`).join(', ');
}

function printReport(report) {
  const { summary } = report;

  console.log('Localization audit');
  console.log('==================');
  console.log(`Patch files:              ${summary.patchFiles}`);
  console.log(`Source files:             ${summary.sourceFiles}`);
  console.log(`Unique keys:              ${summary.uniqueKeys}`);
  console.log(`Statically used keys:     ${summary.staticallyUsedKeys}`);
  console.log(`Dynamic prefix matches:   ${summary.dynamicallyMatchedKeys}`);
  console.log(`Unused candidates:        ${summary.unusedCandidates}`);
  console.log(`Redefined keys:           ${summary.redefinedKeys}`);
  console.log(`Missing keys:             ${summary.missingKeys}`);
  console.log(`Unresolved dynamic sites: ${summary.unresolvedDynamicSites}`);

  if (report.missing.length > 0) {
    console.log('\nMissing localization keys');
    console.log('-------------------------');

    for (const entry of report.missing) {
      console.log(`- ${entry.key}: ${printLocations(entry.locations)}`);
    }
  }

  if (report.redefined.length > 0) {
    console.log('\nRedefined localization keys');
    console.log('---------------------------');

    for (const entry of report.redefined) {
      const locations = entry.definitions
        .map((definition) => `${definition.file}#${definition.index}`)
        .join(', ');
      console.log(`- [${entry.kind}] ${entry.key}: ${locations}`);
    }
  }

  if (report.unused.length > 0) {
    console.log('\nUnused candidates');
    console.log('-----------------');

    for (const entry of report.unused) {
      console.log(`- ${entry.key}`);
    }
  }

  if (report.dynamic.length > 0) {
    console.log('\nKeys matched through dynamic prefixes');
    console.log('------------------------------------');

    for (const entry of report.dynamic) {
      console.log(`- ${entry.key}: ${printLocations(entry.locations)}`);
    }
  }

  if (report.unresolvedDynamicSites.length > 0) {
    console.log('\nUnresolved dynamic i18n sites');
    console.log('-----------------------------');

    for (const site of report.unresolvedDynamicSites) {
      console.log(`- ${site.file}:${site.line}: ${site.expression}`);
    }

    console.log(
      '\nUnused candidates are not safe to delete until the unresolved dynamic sites ' +
        'have been reviewed.',
    );
  }
}

function getJsonOutputPath() {
  const argumentIndex = process.argv.indexOf('--json');

  if (argumentIndex === -1) {
    return null;
  }

  const path = process.argv[argumentIndex + 1];

  if (!path || path.startsWith('--')) {
    throw new Error('Expected a file path after --json.');
  }

  return resolve(projectRoot, path);
}

async function main() {
  const [loadedDefinitions, sources] = await Promise.all([loadDefinitions(), loadSources()]);
  const usage = analyzeUsage(loadedDefinitions.definitions, sources);
  const report = createReport(loadedDefinitions, usage, sources);
  const jsonOutputPath = getJsonOutputPath();

  printReport(report);

  if (jsonOutputPath) {
    await mkdir(dirname(jsonOutputPath), { recursive: true });
    await writeFile(jsonOutputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`\nJSON report written to ${toProjectPath(jsonOutputPath)}.`);
  }

  if (report.missing.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
