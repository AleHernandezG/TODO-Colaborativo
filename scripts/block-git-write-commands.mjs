#!/usr/bin/env node

const BLOCKED_SUBCOMMANDS = new Set(['commit', 'push']);

const GLOBAL_OPTIONS_WITH_VALUE = new Set([
  '-C',
  '-c',
  '--git-dir',
  '--work-tree',
  '--namespace',
  '--exec-path',
  '--config-env',
]);

function readStdin() {
  return new Promise((resolve) => {
    let raw = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      raw += chunk;
    });
    process.stdin.on('end', () => resolve(raw));
  });
}

function splitIntoSegments(command) {
  return command.split(/&&|\|\||[;|\n\r]/);
}

function findGitSubcommand(segment) {
  const tokens = segment.trim().split(/\s+/).filter(Boolean);
  let index = 0;

  while (index < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[index])) {
    index += 1;
  }

  const executable = tokens[index];
  if (!executable) return null;

  const isGit = /(^|[\\/])git(\.exe)?$/i.test(executable.replace(/^["']|["']$/g, ''));
  if (!isGit) return null;

  index += 1;

  while (index < tokens.length) {
    const token = tokens[index];
    if (!token.startsWith('-')) return token.toLowerCase();

    const [flag] = token.split('=');
    if (token.includes('=')) {
      index += 1;
    } else if (GLOBAL_OPTIONS_WITH_VALUE.has(flag)) {
      index += 2;
    } else {
      index += 1;
    }
  }

  return null;
}

function findBlockedSubcommand(command) {
  for (const segment of splitIntoSegments(command)) {
    const subcommand = findGitSubcommand(segment);
    if (subcommand && BLOCKED_SUBCOMMANDS.has(subcommand)) return subcommand;
  }
  return null;
}

function deny(subcommand) {
  const reason =
    `Bloqueado por la regla del repo: \`git ${subcommand}\` lo ejecuta solo Alejandro. ` +
    'Deja los cambios en el árbol de trabajo y dile qué commitear, o pídele que lo lance él con ' +
    `\`! git ${subcommand} ...\` desde el prompt. Regla en .claude/settings.json y en CLAUDE.md.`;

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }),
  );
}

const raw = await readStdin();

let payload;
try {
  payload = JSON.parse(raw);
} catch {
  process.exit(0);
}

const command = payload?.tool_input?.command;
if (typeof command !== 'string') process.exit(0);

const blocked = findBlockedSubcommand(command);
if (blocked) deny(blocked);

process.exit(0);
