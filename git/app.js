(function () {
'use strict';

// ===== Helpers =====
const $ = id => document.getElementById(id);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const shuffle = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function escHTML(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== State =====
let currentLesson = null;
let currentTab = 'tutorial';
let testState = null;
let repo = null; // simulated repo state

const TOTAL_LESSONS = 20;

const defaultProgress = () => ({
    currentLesson: 0,
    completed: new Array(TOTAL_LESSONS).fill(false),
    bestScores: new Array(TOTAL_LESSONS).fill(0),
    exercisesDone: Array.from({ length: TOTAL_LESSONS }, () => [])
});

let progress = defaultProgress();

function loadProgress() {
    try {
        const raw = localStorage.getItem('edu-git-progress');
        if (raw) {
            const p = JSON.parse(raw);
            progress = { ...defaultProgress(), ...p };
            while (progress.completed.length < TOTAL_LESSONS) progress.completed.push(false);
            while (progress.bestScores.length < TOTAL_LESSONS) progress.bestScores.push(0);
            while (progress.exercisesDone.length < TOTAL_LESSONS) progress.exercisesDone.push([]);
        }
    } catch (e) { progress = defaultProgress(); }
}

function saveProgress() {
    localStorage.setItem('edu-git-progress', JSON.stringify(progress));
}

function resetProgress() {
    showConfirm('Reset Progress', 'This will erase all your progress. Are you sure?', () => {
        progress = defaultProgress();
        localStorage.removeItem('edu-git-progress');
        currentLesson = null;
        renderSidebar();
        updateProgressBar();
        showWelcome();
        showToast('Progress reset');
    });
}

// ===== Simulated Git Engine =====
function createRepo(config) {
    const r = {
        files: {},          // filename -> content
        staged: {},         // filename -> content (staging area)
        commits: [],        // [{hash, message, files, branch, timestamp}]
        branches: { main: null },
        HEAD: 'main',
        remotes: {},        // remote branches
        stash: [],
        tags: {},
        config: { 'user.name': 'Student', 'user.email': 'student@example.com' },
        deleted: new Set(),       // tracked files deleted from working dir
        stagedDeleted: new Set(), // files staged for deletion
        log: []             // command history output
    };
    if (config && config.files) {
        Object.assign(r.files, config.files);
    }
    if (config && config.commits) {
        config.commits.forEach(c => {
            const hash = makeHash();
            const snap = { ...r.files };
            r.commits.push({ hash, message: c.message, files: snap, branch: r.HEAD, timestamp: Date.now() - Math.random() * 100000 });
            r.branches[r.HEAD] = hash;
        });
    }
    if (config && config.branches) {
        config.branches.forEach(b => {
            if (!r.branches[b]) r.branches[b] = r.branches.main;
        });
    }
    if (config && config.remoteCommits) {
        r.remotes = { ...config.remoteCommits };
    }
    return r;
}

let hashCounter = 0;
function makeHash() {
    hashCounter++;
    const base = Date.now().toString(16) + hashCounter.toString(16);
    let h = '';
    for (let i = 0; i < 7; i++) h += base.charAt(i % base.length);
    return h.padEnd(7, 'a');
}

function getTrackedFiles(r) {
    if (r.commits.length === 0) return {};
    const lastCommit = findBranchTip(r, r.HEAD);
    if (!lastCommit) return {};
    return { ...lastCommit.files };
}

function findBranchTip(r, branch) {
    const hash = r.branches[branch];
    if (!hash) return null;
    return r.commits.find(c => c.hash === hash) || null;
}

function execGit(input) {
    if (!repo) return { output: 'fatal: not a git repository', error: true };
    const raw = input.trim();
    if (!raw.startsWith('git ')) return { output: `bash: ${raw.split(' ')[0]}: command not found\nHint: commands should start with "git"`, error: true };

    const parts = parseCommand(raw.slice(4));
    const cmd = parts[0];
    const args = parts.slice(1);

    switch (cmd) {
        case 'init': return gitInit(args);
        case 'status': return gitStatus(args);
        case 'add': return gitAdd(args);
        case 'commit': return gitCommit(args);
        case 'log': return gitLog(args);
        case 'diff': return gitDiff(args);
        case 'branch': return gitBranch(args);
        case 'checkout': return gitCheckout(args);
        case 'switch': return gitSwitch(args);
        case 'merge': return gitMerge(args);
        case 'remote': return gitRemote(args);
        case 'push': return gitPush(args);
        case 'pull': return gitPull(args);
        case 'fetch': return gitFetch(args);
        case 'clone': return gitClone(args);
        case 'stash': return gitStash(args);
        case 'tag': return gitTag(args);
        case 'reset': return gitReset(args);
        case 'rm': return gitRm(args);
        case 'mv': return gitMv(args);
        case 'revert': return gitRevert(args);
        case 'cherry-pick': return gitCherryPick(args);
        case 'rebase': return gitRebase(args);
        case 'config': return gitConfig(args);
        case 'show': return gitShow(args);
        case 'restore': return gitRestore(args);
        case 'help': return { output: 'Available commands: init, status, add, commit, log, diff, branch, checkout, switch, merge, remote, push, pull, fetch, clone, stash, tag, reset, rm, mv, revert, cherry-pick, rebase, config, show, restore' };
        default: return { output: `git: '${cmd}' is not a git command. See 'git help'.`, error: true };
    }
}

function parseCommand(str) {
    const parts = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';
    for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (inQuote) {
            if (ch === quoteChar) { inQuote = false; }
            else { current += ch; }
        } else if (ch === '"' || ch === "'") {
            inQuote = true; quoteChar = ch;
        } else if (ch === ' ') {
            if (current) { parts.push(current); current = ''; }
        } else {
            current += ch;
        }
    }
    if (current) parts.push(current);
    return parts;
}

function getFlag(args, flag) {
    const i = args.indexOf(flag);
    if (i === -1) return null;
    return args[i + 1] || true;
}

function hasFlag(args, ...flags) {
    return flags.some(f => args.includes(f));
}

function getNonFlags(args) {
    const result = [];
    for (let i = 0; i < args.length; i++) {
        if (args[i].startsWith('-')) {
            if (args[i] === '-m' || args[i] === '-b') i++; // skip next arg
        } else {
            result.push(args[i]);
        }
    }
    return result;
}

// --- Git Commands ---
function gitInit() {
    return { output: 'Initialized empty Git repository in /project/.git/' };
}

function gitStatus() {
    const r = repo;
    const tracked = getTrackedFiles(r);
    const lines = [`On branch ${r.HEAD}`];

    // Staged changes
    const stagedLines = [];
    for (const f of Object.keys(r.staged)) {
        if (tracked[f] === undefined) stagedLines.push(`\tnew file:   ${f}`);
        else if (r.staged[f] !== tracked[f]) stagedLines.push(`\tmodified:   ${f}`);
    }
    for (const f of r.stagedDeleted) {
        stagedLines.push(`\tdeleted:    ${f}`);
    }
    if (stagedLines.length) {
        lines.push('Changes to be committed:', '  (use "git restore --staged <file>..." to unstage)', '');
        lines.push(...stagedLines.map(l => `\t${l}`));
        lines.push('');
    }

    // Unstaged changes
    const unstagedLines = [];
    for (const f of Object.keys(tracked)) {
        if (r.stagedDeleted.has(f)) continue;
        if (r.deleted.has(f)) { unstagedLines.push(`\tdeleted:    ${f}`); continue; }
        const current = r.files[f];
        const compare = r.staged[f] !== undefined ? r.staged[f] : tracked[f];
        if (current !== undefined && current !== compare) unstagedLines.push(`\tmodified:   ${f}`);
    }
    // Also check staged files for further modifications
    for (const f of Object.keys(r.staged)) {
        if (!tracked[f] && r.files[f] !== r.staged[f]) {
            // new file that was staged then modified further
        }
    }
    if (unstagedLines.length) {
        lines.push('Changes not staged for commit:', '  (use "git add <file>..." to update what will be committed)', '');
        lines.push(...unstagedLines.map(l => `\t${l}`));
        lines.push('');
    }

    // Untracked files
    const untrackedLines = [];
    for (const f of Object.keys(r.files)) {
        if (!tracked[f] && r.staged[f] === undefined) untrackedLines.push(`\t${f}`);
    }
    if (untrackedLines.length) {
        lines.push('Untracked files:', '  (use "git add <file>..." to include in what will be committed)', '');
        lines.push(...untrackedLines.map(l => `\t${l}`));
        lines.push('');
    }

    if (!stagedLines.length && !unstagedLines.length && !untrackedLines.length) {
        lines.push('nothing to commit, working tree clean');
    }
    return { output: lines.join('\n') };
}

function gitAdd(args) {
    const r = repo;
    if (!args.length) return { output: 'Nothing specified, nothing added.', error: true };

    if (args.includes('.') || args.includes('-A') || args.includes('--all')) {
        // Add all files
        for (const f of Object.keys(r.files)) {
            r.staged[f] = r.files[f];
        }
        for (const f of r.deleted) {
            r.stagedDeleted.add(f);
        }
        return { output: '' };
    }

    for (const f of args) {
        if (f.startsWith('-')) continue;
        if (r.deleted.has(f)) {
            r.stagedDeleted.add(f);
        } else if (r.files[f] !== undefined) {
            r.staged[f] = r.files[f];
        } else {
            return { output: `fatal: pathspec '${f}' did not match any files`, error: true };
        }
    }
    return { output: '' };
}

function gitCommit(args) {
    const r = repo;
    const msgIdx = args.indexOf('-m');
    if (msgIdx === -1 || !args[msgIdx + 1]) {
        return { output: 'error: switch `m\' requires a value', error: true };
    }
    const message = args[msgIdx + 1];

    if (Object.keys(r.staged).length === 0 && r.stagedDeleted.size === 0) {
        return { output: 'nothing to commit, working tree clean', error: true };
    }

    // Apply staged changes to tracked files
    const tracked = getTrackedFiles(r);
    const newFiles = { ...tracked };
    for (const f of Object.keys(r.staged)) {
        newFiles[f] = r.staged[f];
    }
    for (const f of r.stagedDeleted) {
        delete newFiles[f];
    }

    const hash = makeHash();
    const changedCount = Object.keys(r.staged).length + r.stagedDeleted.size;
    r.commits.push({ hash, message, files: newFiles, branch: r.HEAD, timestamp: Date.now() });
    r.branches[r.HEAD] = hash;
    r.staged = {};
    r.stagedDeleted = new Set();

    return { output: `[${r.HEAD} ${hash}] ${message}\n ${changedCount} file${changedCount !== 1 ? 's' : ''} changed` };
}

function gitLog(args) {
    const r = repo;
    const oneline = hasFlag(args, '--oneline');
    const branchCommits = r.commits.filter(c => {
        // Simple: show commits reachable from HEAD
        return true; // simplified for tutorial
    }).reverse();

    if (!branchCommits.length) return { output: 'fatal: your current branch does not have any commits yet', error: true };

    const n = parseInt(getFlag(args, '-n')) || branchCommits.length;
    const shown = branchCommits.slice(0, n);

    if (oneline) {
        return { output: shown.map(c => {
            const head = c.hash === r.branches[r.HEAD] ? ` (HEAD -> ${r.HEAD})` : '';
            return `${c.hash}${head} ${c.message}`;
        }).join('\n') };
    }

    return { output: shown.map(c => {
        const head = c.hash === r.branches[r.HEAD] ? ` (HEAD -> ${r.HEAD})` : '';
        return `commit ${c.hash}${head}\nAuthor: ${r.config['user.name']} <${r.config['user.email']}>\n\n    ${c.message}\n`;
    }).join('\n') };
}

function gitDiff(args) {
    const r = repo;
    const staged = hasFlag(args, '--staged', '--cached');
    const tracked = getTrackedFiles(r);
    const lines = [];

    if (staged) {
        for (const f of Object.keys(r.staged)) {
            const old = tracked[f] || '';
            const cur = r.staged[f];
            if (old !== cur) {
                lines.push(`diff --git a/${f} b/${f}`);
                if (!tracked[f]) lines.push('new file mode 100644');
                lines.push(`--- ${tracked[f] ? 'a/' + f : '/dev/null'}`);
                lines.push(`+++ b/${f}`);
                const oldLines = old.split('\n');
                const newLines = cur.split('\n');
                oldLines.forEach(l => { if (!newLines.includes(l)) lines.push(`-${l}`); });
                newLines.forEach(l => { if (!oldLines.includes(l)) lines.push(`+${l}`); });
            }
        }
    } else {
        for (const f of Object.keys(r.files)) {
            const compare = r.staged[f] !== undefined ? r.staged[f] : tracked[f];
            if (compare !== undefined && r.files[f] !== compare) {
                lines.push(`diff --git a/${f} b/${f}`);
                lines.push(`--- a/${f}`);
                lines.push(`+++ b/${f}`);
                const oldLines = compare.split('\n');
                const newLines = r.files[f].split('\n');
                oldLines.forEach(l => { if (!newLines.includes(l)) lines.push(`-${l}`); });
                newLines.forEach(l => { if (!oldLines.includes(l)) lines.push(`+${l}`); });
            }
        }
    }
    return { output: lines.length ? lines.join('\n') : '' };
}

function gitBranch(args) {
    const r = repo;
    if (!args.length || (args.length === 1 && hasFlag(args, '-a', '--all'))) {
        const lines = Object.keys(r.branches).map(b =>
            (b === r.HEAD ? '* ' : '  ') + b
        );
        if (hasFlag(args, '-a', '--all')) {
            for (const remote of Object.keys(r.remotes)) {
                lines.push(`  remotes/origin/${remote}`);
            }
        }
        return { output: lines.join('\n') };
    }
    if (hasFlag(args, '-d', '-D', '--delete')) {
        const name = getNonFlags(args)[0];
        if (!name) return { output: 'fatal: branch name required', error: true };
        if (name === r.HEAD) return { output: `error: Cannot delete branch '${name}' checked out`, error: true };
        if (!r.branches[name]) return { output: `error: branch '${name}' not found`, error: true };
        delete r.branches[name];
        return { output: `Deleted branch ${name}.` };
    }
    if (hasFlag(args, '-m', '-M')) {
        const names = getNonFlags(args);
        const newName = names.length === 2 ? names[1] : names[0];
        const oldName = names.length === 2 ? names[0] : r.HEAD;
        if (!newName) return { output: 'fatal: branch name required', error: true };
        r.branches[newName] = r.branches[oldName];
        delete r.branches[oldName];
        if (r.HEAD === oldName) r.HEAD = newName;
        return { output: '' };
    }
    // Create branch
    const name = args[0];
    if (r.branches[name]) return { output: `fatal: A branch named '${name}' already exists.`, error: true };
    r.branches[name] = r.branches[r.HEAD];
    return { output: '' };
}

function gitCheckout(args) {
    const r = repo;
    if (hasFlag(args, '-b')) {
        const name = getFlag(args, '-b');
        if (r.branches[name]) return { output: `fatal: A branch named '${name}' already exists.`, error: true };
        r.branches[name] = r.branches[r.HEAD];
        r.HEAD = name;
        r.files = { ...getTrackedFiles(r), ...r.files };
        return { output: `Switched to a new branch '${name}'` };
    }
    const target = getNonFlags(args)[0];
    if (!target) return { output: 'error: nothing to checkout', error: true };
    if (r.branches[target]) {
        r.HEAD = target;
        const tip = findBranchTip(r, target);
        if (tip) r.files = { ...tip.files };
        r.staged = {};
        r.stagedDeleted = new Set();
        r.deleted = new Set();
        return { output: `Switched to branch '${target}'` };
    }
    return { output: `error: pathspec '${target}' did not match any file(s) known to git`, error: true };
}

function gitSwitch(args) {
    const r = repo;
    if (hasFlag(args, '-c', '-C', '--create')) {
        const name = getFlag(args, '-c') || getFlag(args, '-C') || getFlag(args, '--create');
        if (r.branches[name]) return { output: `fatal: A branch named '${name}' already exists.`, error: true };
        r.branches[name] = r.branches[r.HEAD];
        r.HEAD = name;
        return { output: `Switched to a new branch '${name}'` };
    }
    const target = getNonFlags(args)[0];
    if (!target) return { output: 'error: missing branch name', error: true };
    return gitCheckout([target]);
}

function gitMerge(args) {
    const r = repo;
    const source = getNonFlags(args)[0];
    if (!source) return { output: 'error: specify branch to merge', error: true };
    if (!r.branches[source]) return { output: `merge: ${source} - not something we can merge`, error: true };

    const sourceTip = findBranchTip(r, source);
    if (!sourceTip) return { output: 'Already up to date.' };

    const currentFiles = getTrackedFiles(r);
    const merged = { ...currentFiles, ...sourceTip.files };
    r.files = { ...merged };

    const hash = makeHash();
    r.commits.push({ hash, message: `Merge branch '${source}' into ${r.HEAD}`, files: merged, branch: r.HEAD, timestamp: Date.now() });
    r.branches[r.HEAD] = hash;

    return { output: `Merge made by the 'ort' strategy.\n ${Object.keys(sourceTip.files).length} file(s) updated.` };
}

function gitRemote(args) {
    const r = repo;
    if (!args.length || args[0] === '-v') {
        if (Object.keys(r.remotes).length === 0 && !r._remoteUrl) return { output: '' };
        const url = r._remoteUrl || 'https://github.com/user/project.git';
        return { output: `origin\t${url} (fetch)\norigin\t${url} (push)` };
    }
    if (args[0] === 'add') {
        r._remoteUrl = args[2] || 'https://github.com/user/project.git';
        return { output: '' };
    }
    if (args[0] === 'remove' || args[0] === 'rm') {
        r._remoteUrl = null;
        return { output: '' };
    }
    return { output: `error: Unknown subcommand: ${args[0]}`, error: true };
}

function gitPush(args) {
    const r = repo;
    const tip = findBranchTip(r, r.HEAD);
    if (!tip) return { output: 'error: src refspec does not match any', error: true };
    r.remotes[r.HEAD] = tip.hash;
    const remote = getNonFlags(args)[0] || 'origin';
    return { output: `Enumerating objects: done.\nCounting objects: done.\nWriting objects: 100%\nTo ${r._remoteUrl || 'origin'}\n   ${tip.hash.slice(0,7)}..${tip.hash.slice(0,7)} ${r.HEAD} -> ${r.HEAD}` };
}

function gitPull(args) {
    const r = repo;
    return { output: `Already up to date.` };
}

function gitFetch(args) {
    return { output: `From origin\n * [new branch]      main -> origin/main` };
}

function gitClone(args) {
    const url = args[0];
    if (!url) return { output: 'fatal: You must specify a repository to clone.', error: true };
    const name = url.split('/').pop().replace('.git', '');
    return { output: `Cloning into '${name}'...\nremote: Enumerating objects: done.\nReceiving objects: 100%\nResolving deltas: 100%` };
}

function gitStash(args) {
    const r = repo;
    if (!args.length || args[0] === 'push') {
        const modified = {};
        const tracked = getTrackedFiles(r);
        for (const f of Object.keys(r.files)) {
            if (tracked[f] !== undefined && r.files[f] !== tracked[f]) modified[f] = r.files[f];
        }
        if (Object.keys(modified).length === 0 && Object.keys(r.staged).length === 0) {
            return { output: 'No local changes to save' };
        }
        r.stash.push({ files: { ...modified }, staged: { ...r.staged } });
        // Restore working dir to clean
        r.files = { ...tracked, ...r.files };
        for (const f of Object.keys(modified)) r.files[f] = tracked[f];
        r.staged = {};
        return { output: `Saved working directory and index state WIP on ${r.HEAD}` };
    }
    if (args[0] === 'pop') {
        if (!r.stash.length) return { output: 'error: No stash entries found.', error: true };
        const s = r.stash.pop();
        Object.assign(r.files, s.files);
        Object.assign(r.staged, s.staged);
        return { output: `On branch ${r.HEAD}\nChanges restored from stash.` };
    }
    if (args[0] === 'list') {
        if (!r.stash.length) return { output: '' };
        return { output: r.stash.map((_, i) => `stash@{${i}}: WIP on ${r.HEAD}`).join('\n') };
    }
    if (args[0] === 'drop') {
        if (!r.stash.length) return { output: 'error: No stash entries found.', error: true };
        r.stash.pop();
        return { output: 'Dropped stash entry.' };
    }
    return { output: `error: unknown subcommand: ${args[0]}`, error: true };
}

function gitTag(args) {
    const r = repo;
    if (!args.length) {
        const tags = Object.keys(r.tags);
        return { output: tags.length ? tags.join('\n') : '' };
    }
    if (hasFlag(args, '-d', '--delete')) {
        const name = getNonFlags(args)[0];
        if (!r.tags[name]) return { output: `error: tag '${name}' not found.`, error: true };
        delete r.tags[name];
        return { output: `Deleted tag '${name}'` };
    }
    const name = args[0];
    const tip = findBranchTip(r, r.HEAD);
    const msg = getFlag(args, '-m');
    r.tags[name] = { hash: tip ? tip.hash : 'none', message: msg || '' };
    return { output: '' };
}

function gitReset(args) {
    const r = repo;
    if (hasFlag(args, '--soft')) {
        // keep staged and working dir
        return { output: `HEAD is now at ${(r.branches[r.HEAD] || 'none').slice(0,7)}` };
    }
    if (hasFlag(args, '--hard')) {
        const tracked = getTrackedFiles(r);
        r.files = { ...tracked };
        r.staged = {};
        r.stagedDeleted = new Set();
        r.deleted = new Set();
        return { output: `HEAD is now at ${(r.branches[r.HEAD] || 'none').slice(0,7)}` };
    }
    // Default (mixed): unstage
    if (args.length && !args[0].startsWith('-')) {
        // unstage specific file
        const f = args[0];
        delete r.staged[f];
        r.stagedDeleted.delete(f);
        return { output: `Unstaged changes after reset:\nM\t${f}` };
    }
    r.staged = {};
    r.stagedDeleted = new Set();
    return { output: `Unstaged changes after reset.` };
}

function gitRm(args) {
    const r = repo;
    const files = getNonFlags(args);
    const cached = hasFlag(args, '--cached');
    for (const f of files) {
        if (cached) {
            delete r.staged[f];
        } else {
            delete r.files[f];
            r.deleted.add(f);
            r.stagedDeleted.add(f);
        }
    }
    return { output: files.map(f => `rm '${f}'`).join('\n') };
}

function gitMv(args) {
    const r = repo;
    if (args.length < 2) return { output: 'usage: git mv <source> <destination>', error: true };
    const src = args[0], dst = args[1];
    if (r.files[src] === undefined) return { output: `fatal: bad source, source=${src}`, error: true };
    r.files[dst] = r.files[src];
    delete r.files[src];
    r.staged[dst] = r.files[dst];
    r.stagedDeleted.add(src);
    return { output: '' };
}

function gitRevert(args) {
    const r = repo;
    const target = getNonFlags(args)[0];
    if (!target) return { output: 'usage: git revert <commit>', error: true };
    const hash = makeHash();
    const files = getTrackedFiles(r);
    r.commits.push({ hash, message: `Revert "${target}"`, files, branch: r.HEAD, timestamp: Date.now() });
    r.branches[r.HEAD] = hash;
    return { output: `[${r.HEAD} ${hash}] Revert "${target}"` };
}

function gitCherryPick(args) {
    const r = repo;
    const target = args[0];
    if (!target) return { output: 'usage: git cherry-pick <commit>', error: true };
    const commit = r.commits.find(c => c.hash.startsWith(target));
    if (!commit) return { output: `fatal: bad object ${target}`, error: true };
    const hash = makeHash();
    const merged = { ...getTrackedFiles(r), ...commit.files };
    r.files = merged;
    r.commits.push({ hash, message: commit.message, files: merged, branch: r.HEAD, timestamp: Date.now() });
    r.branches[r.HEAD] = hash;
    return { output: `[${r.HEAD} ${hash}] ${commit.message}` };
}

function gitRebase(args) {
    const r = repo;
    const target = getNonFlags(args)[0];
    if (!target) return { output: 'usage: git rebase <branch>', error: true };
    if (!r.branches[target]) return { output: `fatal: invalid upstream '${target}'`, error: true };
    return { output: `Successfully rebased and updated refs/heads/${r.HEAD}.` };
}

function gitConfig(args) {
    const r = repo;
    if (args.length >= 2 && !args[0].startsWith('-')) {
        r.config[args[0]] = args[1];
        return { output: '' };
    }
    if (args.includes('--list') || args.includes('-l')) {
        return { output: Object.entries(r.config).map(([k, v]) => `${k}=${v}`).join('\n') };
    }
    if (args.length >= 3 && (args[0] === '--global' || args[0] === '--local')) {
        r.config[args[1]] = args[2];
        return { output: '' };
    }
    if (args.length >= 1 && !args[0].startsWith('-')) {
        const val = r.config[args[0]];
        return val !== undefined ? { output: val } : { output: '' };
    }
    return { output: 'usage: git config <key> <value>', error: true };
}

function gitShow(args) {
    const r = repo;
    const target = args[0] || 'HEAD';
    let commit;
    if (target === 'HEAD') {
        commit = findBranchTip(r, r.HEAD);
    } else {
        commit = r.commits.find(c => c.hash.startsWith(target));
    }
    if (!commit) return { output: `fatal: bad object ${target}`, error: true };
    return { output: `commit ${commit.hash}\nAuthor: ${r.config['user.name']} <${r.config['user.email']}>\n\n    ${commit.message}` };
}

function gitRestore(args) {
    const r = repo;
    if (hasFlag(args, '--staged')) {
        const files = getNonFlags(args);
        for (const f of files) {
            delete r.staged[f];
            r.stagedDeleted.delete(f);
        }
        return { output: '' };
    }
    const files = getNonFlags(args);
    const tracked = getTrackedFiles(r);
    for (const f of files) {
        if (tracked[f] !== undefined) {
            r.files[f] = tracked[f];
            r.deleted.delete(f);
        }
    }
    return { output: '' };
}

// ===== Sandbox Result Rendering =====
function renderTerminalOutput(input, result, container) {
    let html = `<div class="terminal-output"><span class="prompt">$ ${escHTML(input)}</span>\n${escHTML(result.output)}</div>`;
    container.innerHTML = html;
}

// ===== Repo State Display =====
function getRepoStateText() {
    if (!repo) return 'No repository initialized';
    const r = repo;
    const lines = [];
    lines.push(`Branch: ${r.HEAD}`);
    lines.push(`Branches: ${Object.keys(r.branches).join(', ')}`);
    lines.push(`Commits: ${r.commits.length}`);
    lines.push('');
    lines.push('Working directory files:');
    for (const [f, c] of Object.entries(r.files)) {
        lines.push(`  ${f}`);
    }
    if (Object.keys(r.staged).length) {
        lines.push('');
        lines.push('Staged files:');
        for (const f of Object.keys(r.staged)) lines.push(`  ${f}`);
    }
    return lines.join('\n');
}

// ===== Exercise Checking =====
function checkGitExercise(exercise, userInput) {
    // Set up a fresh repo for the exercise
    const savedRepo = repo;
    repo = createRepo(currentLesson.repoConfig);

    // For exercises that check command output
    if (exercise.check === 'output') {
        const result = execGit(userInput);
        const expected = execGit(exercise.solution);
        repo = savedRepo;
        // Normalize and compare
        const norm = s => s.replace(/\s+/g, ' ').trim().toLowerCase();
        return norm(result.output) === norm(expected.output);
    }

    // For exercises that check the command itself
    if (exercise.check === 'command') {
        repo = savedRepo;
        const normCmd = s => s.trim().replace(/\s+/g, ' ').toLowerCase().replace(/;$/, '');
        const userNorm = normCmd(userInput);
        const solutions = Array.isArray(exercise.solution) ? exercise.solution : [exercise.solution];
        return solutions.some(sol => normCmd(sol) === userNorm);
    }

    // For exercises that check repo state after running
    if (exercise.check === 'state') {
        // Run any setup commands
        if (exercise.setup) exercise.setup.forEach(cmd => execGit(cmd));
        // Run user's command
        const result = execGit(userInput);
        if (result.error && !exercise.allowError) { repo = savedRepo; return false; }
        const pass = exercise.validate(repo);
        repo = savedRepo;
        return pass;
    }

    // Default: compare command strings
    repo = savedRepo;
    const normCmd = s => s.trim().replace(/\s+/g, ' ').toLowerCase().replace(/;$/, '');
    const solutions = Array.isArray(exercise.solution) ? exercise.solution : [exercise.solution];
    return solutions.some(sol => normCmd(sol) === normCmd(userInput));
}

// ===== Sidebar & Navigation =====
function renderSidebar() {
    const ul = $('lesson-list');
    ul.innerHTML = '';
    LESSONS.forEach((lesson, i) => {
        const li = document.createElement('li');
        const done = progress.completed[i];
        const isCurrent = currentLesson && currentLesson.id === lesson.id;
        if (done) li.classList.add('completed');
        if (isCurrent) { li.classList.add('active'); li.classList.add('current'); }
        const statusIcon = done ? '\u2713' : (isCurrent ? '\u25CF' : '\u25CB');
        const score = progress.bestScores[i] > 0 ? `${progress.bestScores[i]}/5` : '';
        li.innerHTML = `<span class="lesson-status">${statusIcon}</span><span class="lesson-name">${lesson.id}. ${lesson.title}</span>${score ? `<span class="lesson-score">${score}</span>` : ''}`;
        li.addEventListener('click', () => loadLesson(lesson.id));
        ul.appendChild(li);
    });
}

function updateProgressBar() {
    const done = progress.completed.filter(Boolean).length;
    $('progress-bar').style.width = `${(done / TOTAL_LESSONS) * 100}%`;
    $('progress-text').textContent = `${done} / ${TOTAL_LESSONS}`;
}

function showWelcome() {
    $('welcome-screen').classList.remove('hidden');
    $('lesson-view').classList.add('hidden');
}

function loadLesson(id) {
    const lesson = LESSONS.find(l => l.id === id);
    if (!lesson) return;
    currentLesson = lesson;
    progress.currentLesson = id;
    saveProgress();

    // Init repo
    repo = createRepo(lesson.repoConfig);

    // Hide welcome, show lesson
    $('welcome-screen').classList.add('hidden');
    $('lesson-view').classList.remove('hidden');

    // Header
    $('lesson-number').textContent = `Lesson ${lesson.id} of ${TOTAL_LESSONS}`;
    $('lesson-title').textContent = lesson.title;
    $('lesson-theme').textContent = lesson.theme;

    // Tutorial
    $('tutorial-content').innerHTML = lesson.tutorial;

    // Sandbox
    $('sandbox-dataset-name').textContent = lesson.theme;
    $('sandbox-editor').value = lesson.defaultCmd || '';
    $('sandbox-results').innerHTML = '<p class="results-placeholder">Run a command to see output here.</p>';
    $('repo-state-text').textContent = getRepoStateText();
    $('repo-state-display').classList.add('hidden');

    // Exercises
    renderExercises(lesson);

    // Test
    resetTestUI(lesson);

    // Nav buttons
    $('prev-lesson').style.visibility = lesson.id > 1 ? 'visible' : 'hidden';
    $('next-lesson').style.visibility = lesson.id < TOTAL_LESSONS ? 'visible' : 'hidden';

    // Default tab
    switchTab('tutorial');
    renderSidebar();
    $('main-content').scrollTop = 0;
    $('sidebar').classList.remove('open');
}

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.toggle('active', tc.id === `tab-${tab}`));
    if ((tab === 'sandbox' || tab === 'exercises') && currentLesson) {
        repo = createRepo(currentLesson.repoConfig);
        $('repo-state-text').textContent = getRepoStateText();
    }
}

// ===== Exercises =====
function renderExercises(lesson) {
    const container = $('exercises-list');
    container.innerHTML = '';
    const idx = lesson.id - 1;
    if (!progress.exercisesDone[idx] || progress.exercisesDone[idx].length !== lesson.exercises.length) {
        progress.exercisesDone[idx] = new Array(lesson.exercises.length).fill(false);
    }
    $('exercises-total').textContent = lesson.exercises.length;
    $('exercises-done').textContent = progress.exercisesDone[idx].filter(Boolean).length;

    lesson.exercises.forEach((ex, i) => {
        const done = progress.exercisesDone[idx][i];
        const card = document.createElement('div');
        card.className = `exercise-card${done ? ' completed' : ''}`;
        card.innerHTML = `
            <div class="exercise-header">
                <span class="exercise-num">${i + 1}</span>
                <span class="exercise-instruction">${ex.instruction}</span>
            </div>
            <button class="hint-toggle" data-idx="${i}">Show hint</button>
            <p class="exercise-hint" id="hint-${i}">${ex.hint}</p>
            <div class="editor-container">
                <textarea class="git-editor exercise-editor" id="ex-editor-${i}" spellcheck="false" placeholder="Type your git command here...">${done && ex.solution ? (Array.isArray(ex.solution) ? ex.solution[0] : ex.solution) : ''}</textarea>
                <div class="editor-actions">
                    <button class="btn-primary ex-check" data-idx="${i}">Check</button>
                </div>
            </div>
            <div class="exercise-feedback" id="ex-feedback-${i}"></div>
            <div class="exercise-results results-area" id="ex-results-${i}" style="display:none"></div>
        `;
        container.appendChild(card);
    });

    container.querySelectorAll('.hint-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const hint = $(`hint-${btn.dataset.idx}`);
            hint.classList.toggle('visible');
            btn.textContent = hint.classList.contains('visible') ? 'Hide hint' : 'Show hint';
        });
    });

    container.querySelectorAll('.ex-check').forEach(btn => {
        btn.addEventListener('click', () => checkExercise(parseInt(btn.dataset.idx)));
    });

    container.querySelectorAll('.exercise-editor').forEach(editor => {
        editor.addEventListener('keydown', e => {
            if (e.ctrlKey && e.key === 'Enter') {
                const idx = parseInt(editor.id.split('-')[2]);
                checkExercise(idx);
            }
        });
    });
}

function checkExercise(i) {
    if (!currentLesson) return;
    const ex = currentLesson.exercises[i];
    const editor = $(`ex-editor-${i}`);
    const feedback = $(`ex-feedback-${i}`);
    const resultsDiv = $(`ex-results-${i}`);
    const userInput = editor.value.trim();

    if (!userInput) {
        feedback.className = 'exercise-feedback incorrect';
        feedback.textContent = 'Please type a command first.';
        return;
    }

    const correct = checkGitExercise(ex, userInput);
    if (correct) {
        markExerciseDone(i);
        feedback.className = 'exercise-feedback correct';
        feedback.textContent = 'Correct!';
        // Show the output
        repo = createRepo(currentLesson.repoConfig);
        const result = execGit(userInput);
        if (result.output) {
            resultsDiv.style.display = 'block';
            renderTerminalOutput(userInput, result, resultsDiv);
        }
        editor.closest('.exercise-card').classList.add('completed', 'flash-success');
    } else {
        feedback.className = 'exercise-feedback incorrect';
        feedback.textContent = 'Not quite right. Check your command and try again.';
        // Show what happened
        repo = createRepo(currentLesson.repoConfig);
        const result = execGit(userInput);
        if (result.output) {
            resultsDiv.style.display = 'block';
            renderTerminalOutput(userInput, result, resultsDiv);
        }
    }
}

function markExerciseDone(i) {
    const idx = currentLesson.id - 1;
    progress.exercisesDone[idx][i] = true;
    $('exercises-done').textContent = progress.exercisesDone[idx].filter(Boolean).length;
    if (progress.exercisesDone[idx].every(Boolean)) {
        progress.completed[idx] = true;
        updateProgressBar();
        renderSidebar();
    }
    saveProgress();
}

// ===== Test System =====
function resetTestUI(lesson) {
    const idx = lesson.id - 1;
    $('test-intro').classList.remove('hidden');
    $('test-active').classList.add('hidden');
    $('test-results').classList.add('hidden');
    if (progress.bestScores[idx] > 0) {
        $('test-best-score').classList.remove('hidden');
        $('best-score-value').textContent = progress.bestScores[idx];
    } else {
        $('test-best-score').classList.add('hidden');
    }
    testState = null;
}

function startTest() {
    if (!currentLesson) return;
    repo = createRepo(currentLesson.repoConfig);
    const templates = shuffle(currentLesson.tests).slice(0, 5);
    const questions = templates.map(fn => fn());
    testState = { questions, current: 0, answers: [], score: 0 };
    $('test-intro').classList.add('hidden');
    $('test-active').classList.remove('hidden');
    $('test-results').classList.add('hidden');
    showTestQuestion(0);
}

function showTestQuestion(idx) {
    if (!testState) return;
    const q = testState.questions[idx];
    $('test-question-num').textContent = `Question ${idx + 1} of ${testState.questions.length}`;

    let html = `<div class="test-question">`;
    html += `<div class="test-question-text">${q.question}</div>`;

    if (q.type === 'mcq') {
        html += '<div class="test-mcq-options">';
        q.options.forEach((opt, i) => {
            html += `<button class="mcq-option" data-idx="${i}">${escHTML(opt)}</button>`;
        });
        html += '</div>';
        html += '<div class="test-submit-row"><button class="btn-primary test-submit-btn" disabled>Submit Answer</button></div>';
    } else if (q.type === 'write' || q.type === 'fix') {
        if (q.type === 'fix' && q.broken) {
            html += `<pre>${escHTML(q.broken)}</pre>`;
        }
        html += `<div class="editor-container"><textarea class="git-editor test-editor" spellcheck="false" placeholder="Type your git command here...">${q.type === 'fix' ? escHTML(q.broken) : ''}</textarea></div>`;
        html += '<div class="test-submit-row"><button class="btn-primary test-submit-btn">Submit Answer</button></div>';
    }
    html += '</div>';
    $('test-question-area').innerHTML = html;

    const options = $('test-question-area').querySelectorAll('.mcq-option');
    let selectedMCQ = -1;
    options.forEach(opt => {
        opt.addEventListener('click', () => {
            options.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedMCQ = parseInt(opt.dataset.idx);
            $('test-question-area').querySelector('.test-submit-btn').disabled = false;
        });
    });

    const submitBtn = $('test-question-area').querySelector('.test-submit-btn');
    submitBtn.addEventListener('click', () => submitTestAnswer(q, selectedMCQ));

    const editor = $('test-question-area').querySelector('.test-editor');
    if (editor) {
        editor.addEventListener('keydown', e => {
            if (e.ctrlKey && e.key === 'Enter') submitTestAnswer(q, selectedMCQ);
        });
        editor.focus();
    }
}

function submitTestAnswer(q, selectedMCQ) {
    let correct = false;
    let userAnswer = '';

    if (q.type === 'mcq') {
        correct = selectedMCQ === q.answer;
        userAnswer = q.options[selectedMCQ] || 'No answer';
    } else if (q.type === 'write' || q.type === 'fix') {
        const editor = $('test-question-area').querySelector('.test-editor');
        userAnswer = editor ? editor.value.trim() : '';
        if (!userAnswer) { showToast('Please type a command'); return; }

        const normCmd = s => s.trim().replace(/\s+/g, ' ').toLowerCase().replace(/;$/, '');
        const solutions = Array.isArray(q.solution) ? q.solution : [q.solution];
        correct = solutions.some(sol => normCmd(sol) === normCmd(userAnswer));
    }

    testState.answers.push({ question: q, userAnswer, correct });
    if (correct) testState.score++;
    testState.current++;

    if (testState.current < testState.questions.length) {
        showTestQuestion(testState.current);
    } else {
        showTestResults();
    }
}

function showTestResults() {
    $('test-active').classList.add('hidden');
    $('test-results').classList.remove('hidden');
    const score = testState.score;
    const total = testState.questions.length;
    const pct = Math.round((score / total) * 100);

    $('test-score-heading').textContent = score >= 3 ? `Great job! ${score}/${total}` : `${score}/${total} — Keep practicing!`;
    $('test-score-detail').textContent = `You scored ${pct}%. ${score >= 3 ? 'This lesson is now marked complete.' : 'Score 3/5 or higher to complete this lesson.'}`;

    let reviewHTML = '';
    testState.answers.forEach((a, i) => {
        const cls = a.correct ? 'correct' : 'incorrect';
        const qText = a.question.question.replace(/<[^>]+>/g, '').substring(0, 120);
        reviewHTML += `<div class="review-item ${cls}">
            <div class="review-question">${i + 1}. ${a.correct ? '\u2713' : '\u2717'} ${qText}${a.question.question.length > 120 ? '...' : ''}</div>
            ${!a.correct && a.question.solution ? `<div class="review-answer">Expected: ${escHTML(Array.isArray(a.question.solution) ? a.question.solution[0] : a.question.solution)}</div>` : ''}
        </div>`;
    });
    $('test-review').innerHTML = reviewHTML;

    const idx = currentLesson.id - 1;
    if (score > progress.bestScores[idx]) progress.bestScores[idx] = score;
    if (score >= 3) progress.completed[idx] = true;
    saveProgress();
    updateProgressBar();
    renderSidebar();
}

// ===== UI Helpers =====
function showToast(msg) {
    const toast = $('toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.add('hidden'), 2500);
}

function showConfirm(title, msg, onOk) {
    $('confirm-title').textContent = title;
    $('confirm-message').textContent = msg;
    $('confirm-dialog').classList.remove('hidden');
    const close = () => $('confirm-dialog').classList.add('hidden');
    $('confirm-ok').onclick = () => { close(); onOk(); };
    $('confirm-cancel').onclick = close;
    $('confirm-dialog').querySelector('.dialog-overlay').onclick = close;
}

// ===== Event Listeners =====
function bindEvents() {
    $('start-btn').addEventListener('click', () => loadLesson(1));
    $('sidebar-toggle').addEventListener('click', () => $('sidebar').classList.toggle('open'));
    $('reset-btn').addEventListener('click', resetProgress);

    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    $('tutorial-next').addEventListener('click', () => switchTab('sandbox'));

    // Sandbox
    $('sandbox-run').addEventListener('click', () => {
        const cmd = $('sandbox-editor').value.trim();
        if (!cmd) return;
        const result = execGit(cmd);
        renderTerminalOutput(cmd, result, $('sandbox-results'));
        $('repo-state-text').textContent = getRepoStateText();
    });
    $('sandbox-clear').addEventListener('click', () => {
        $('sandbox-editor').value = '';
        $('sandbox-results').innerHTML = '<p class="results-placeholder">Run a command to see output here.</p>';
    });
    $('sandbox-editor').addEventListener('keydown', e => {
        if (e.ctrlKey && e.key === 'Enter') $('sandbox-run').click();
    });
    $('repo-state-toggle').addEventListener('click', () => {
        const d = $('repo-state-display');
        d.classList.toggle('hidden');
        $('repo-state-toggle').textContent = d.classList.contains('hidden') ? 'Show Repo State' : 'Hide Repo State';
        $('repo-state-text').textContent = getRepoStateText();
    });

    // Test
    $('test-start').addEventListener('click', startTest);
    $('test-retake').addEventListener('click', startTest);
    $('test-next-lesson').addEventListener('click', () => {
        if (currentLesson && currentLesson.id < TOTAL_LESSONS) loadLesson(currentLesson.id + 1);
    });

    // Lesson nav
    $('prev-lesson').addEventListener('click', () => {
        if (currentLesson && currentLesson.id > 1) loadLesson(currentLesson.id - 1);
    });
    $('next-lesson').addEventListener('click', () => {
        if (currentLesson && currentLesson.id < TOTAL_LESSONS) loadLesson(currentLesson.id + 1);
    });
}

// ===== LESSONS DATA =====
// Lessons are loaded from lessons.js
// LESSONS array must be defined before init() runs

// ===== Initialization =====
function init() {
    if (typeof LESSONS === 'undefined' || !LESSONS.length) {
        $('main-content').innerHTML = '<div style="padding:40px;text-align:center"><h2>Error: Lessons not loaded</h2><p>Make sure lessons.js is included before app.js.</p></div>';
        return;
    }
    loadProgress();
    renderSidebar();
    updateProgressBar();
    bindEvents();

    if (progress.currentLesson > 0) {
        loadLesson(progress.currentLesson);
    } else {
        showWelcome();
    }
}

document.addEventListener('DOMContentLoaded', init);

})();
