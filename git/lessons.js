// Git Course — Lesson Data
// Each lesson: id, title, theme, tutorial (HTML), repoConfig, defaultCmd, exercises[], tests[]

const LESSONS = [

// ===== Lesson 1: What is Git? (git init, git status) =====
{
    id: 1,
    title: 'Getting Started',
    theme: 'Blog Project — setting up version control',
    repoConfig: { files: { 'index.html': '<h1>My Blog</h1>', 'style.css': 'body { color: #333; }' } },
    defaultCmd: 'git status',
    tutorial: `<h3>What is Git?</h3>
<p>Git is a <span class="keyword">version control system</span> — it tracks changes to your files over time so you can recall specific versions later.</p>
<p>Think of it like an unlimited undo system for your entire project.</p>
<h3>Creating a Repository</h3>
<p>A <span class="keyword">repository</span> (or "repo") is a project tracked by Git. To start one:</p>
<div class="git-example">$ git init</div>
<p>This creates a hidden <code>.git</code> folder that stores all the tracking data.</p>
<h3>Checking Status</h3>
<p>The most useful command you'll ever learn:</p>
<div class="git-example">$ git status</div>
<p>It tells you which branch you're on, what files have changed, and what's ready to be saved.</p>
<div class="note">Tip: Run <code>git status</code> constantly. It's your map — it shows exactly where you are and what's going on.</div>`,
    exercises: [
        { instruction: 'Initialize a new Git repository.', hint: 'Use git init', solution: 'git init', check: 'command' },
        { instruction: 'Check the status of your repository.', hint: 'Use git status', solution: 'git status', check: 'command' },
    ],
    tests: [
        () => ({ type: 'mcq', question: 'What does <code>git init</code> do?', options: ['Creates a new Git repository', 'Deletes a repository', 'Pushes code to GitHub', 'Downloads a project'], answer: 0 }),
        () => ({ type: 'mcq', question: 'What does <code>git status</code> show you?', options: ['The current state of your working directory and staging area', 'A list of all Git commands', 'Your commit history', 'Remote repository URLs'], answer: 0 }),
        () => ({ type: 'write', question: 'What command initializes a new Git repository?', solution: 'git init' }),
        () => ({ type: 'write', question: 'What command shows the current state of your repository?', solution: 'git status' }),
        () => ({ type: 'mcq', question: 'Where does Git store its tracking data?', options: ['In a hidden .git folder', 'In a file called git.config', 'On GitHub servers', 'In the system registry'], answer: 0 }),
        () => ({ type: 'mcq', question: 'What is a Git repository?', options: ['A project whose files are tracked by Git', 'A website for sharing code', 'A type of database', 'A programming language'], answer: 0 }),
    ]
},

// ===== Lesson 2: Staging & Committing (git add, git commit) =====
{
    id: 2,
    title: 'Staging & Committing',
    theme: 'Recipe Book — saving your first recipes',
    repoConfig: {
        files: { 'pancakes.txt': 'Flour, eggs, milk\nMix and cook on griddle', 'cookies.txt': 'Butter, sugar, flour\nBake at 350F for 12 min' }
    },
    defaultCmd: 'git status',
    tutorial: `<h3>The Two-Step Save</h3>
<p>Git doesn't save changes automatically. It uses a <span class="keyword">two-step process</span>:</p>
<ol style="margin:12px 0 12px 24px;line-height:2">
<li><strong>Stage</strong> — choose which changes to include</li>
<li><strong>Commit</strong> — save those changes permanently</li>
</ol>
<h3>Step 1: Staging with git add</h3>
<p>Stage a specific file:</p>
<div class="git-example">$ git add pancakes.txt</div>
<p>Stage everything at once:</p>
<div class="git-example">$ git add .</div>
<h3>Step 2: Committing with git commit</h3>
<p>Save your staged changes with a message describing what you did:</p>
<div class="git-example">$ git commit -m "Add pancake and cookie recipes"</div>
<div class="note">Tip: Write commit messages in the imperative mood — "Add feature" not "Added feature". Keep them short but descriptive.</div>`,
    exercises: [
        { instruction: 'Stage the file <code>pancakes.txt</code>.', hint: 'Use git add followed by the filename', solution: 'git add pancakes.txt', check: 'command' },
        { instruction: 'Stage all files at once.', hint: 'Use git add with a dot', solution: ['git add .', 'git add -A', 'git add --all'], check: 'command' },
        { instruction: 'Commit with the message "Add recipes".', hint: 'Use git commit -m "message"', solution: 'git commit -m "Add recipes"', check: 'command' },
    ],
    tests: [
        () => ({ type: 'mcq', question: 'What does <code>git add</code> do?', options: ['Moves changes to the staging area', 'Saves changes permanently', 'Creates a new file', 'Pushes code to a remote'], answer: 0 }),
        () => ({ type: 'mcq', question: 'What does <code>git add .</code> do?', options: ['Stages all changed files in the current directory', 'Commits all files', 'Deletes all files', 'Creates a new branch'], answer: 0 }),
        () => ({ type: 'write', question: 'Write the command to stage a file called <code>readme.md</code>.', solution: 'git add readme.md' }),
        () => ({ type: 'write', question: 'Write the command to commit with the message "Initial commit".', solution: 'git commit -m "Initial commit"' }),
        () => ({ type: 'mcq', question: 'What is the correct order of operations?', options: ['git add, then git commit', 'git commit, then git add', 'git push, then git add', 'git init, then git commit'], answer: 0 }),
        () => ({ type: 'fix', question: 'Fix this commit command:', broken: 'git commit "Add files"', solution: 'git commit -m "Add files"' }),
        () => ({ type: 'mcq', question: 'Which flag passes a commit message inline?', options: ['-m', '-msg', '--message', '-c'], answer: 0 }),
    ]
},

// ===== Lesson 3: Viewing History (git log) =====
{
    id: 3,
    title: 'Viewing History',
    theme: 'Travel Journal — reviewing past entries',
    repoConfig: {
        files: { 'paris.md': '# Paris\nEiffel Tower was amazing', 'tokyo.md': '# Tokyo\nSushi and cherry blossoms', 'london.md': '# London\nBig Ben and fish & chips' },
        commits: [
            { message: 'Add Paris journal entry' },
            { message: 'Add Tokyo journal entry' },
            { message: 'Add London journal entry' },
        ]
    },
    defaultCmd: 'git log --oneline',
    tutorial: `<h3>Viewing Your Commit History</h3>
<p>Every commit you make is saved in a timeline. View it with:</p>
<div class="git-example">$ git log</div>
<p>This shows each commit with its hash, author, date, and message.</p>
<h3>Compact View</h3>
<p>For a shorter view, use the <code>--oneline</code> flag:</p>
<div class="git-example">$ git log --oneline</div>
<p>Each line shows the short hash and commit message — much easier to scan.</p>
<h3>Limiting Output</h3>
<p>Show only the last N commits:</p>
<div class="git-example">$ git log -n 2</div>
<div class="note">The commit hash (like <code>a1b2c3d</code>) is a unique ID for each commit. You'll use these later to refer to specific commits.</div>`,
    exercises: [
        { instruction: 'View the full commit history.', hint: 'Use git log', solution: 'git log', check: 'command' },
        { instruction: 'View the commit history in compact one-line format.', hint: 'Add the --oneline flag', solution: 'git log --oneline', check: 'command' },
        { instruction: 'Show only the last 2 commits.', hint: 'Use git log -n 2', solution: ['git log -n 2', 'git log -2'], check: 'command' },
    ],
    tests: [
        () => ({ type: 'mcq', question: 'What does <code>git log</code> show?', options: ['The commit history', 'Unstaged changes', 'Remote repositories', 'Branch list'], answer: 0 }),
        () => ({ type: 'write', question: 'Write the command to view commit history in one-line format.', solution: 'git log --oneline' }),
        () => ({ type: 'mcq', question: 'What is a commit hash?', options: ['A unique identifier for a commit', 'The commit message', 'The author name', 'The file that was changed'], answer: 0 }),
        () => ({ type: 'write', question: 'Show only the last 3 commits.', solution: ['git log -n 3', 'git log -3'] }),
        () => ({ type: 'mcq', question: 'Which flag makes <code>git log</code> show one commit per line?', options: ['--oneline', '--short', '--compact', '--brief'], answer: 0 }),
        () => ({ type: 'fix', question: 'Fix this command to show compact history:', broken: 'git log -oneline', solution: 'git log --oneline' }),
    ]
},

// ===== Lesson 4: Viewing Changes (git diff) =====
{
    id: 4,
    title: 'Viewing Changes',
    theme: 'Todo App — tracking what changed',
    repoConfig: {
        files: { 'app.js': 'function addTodo(text) {\n  todos.push(text);\n}', 'style.css': '.todo { color: blue; }' },
        commits: [{ message: 'Initial todo app' }]
    },
    defaultCmd: 'git diff',
    tutorial: `<h3>Seeing What Changed</h3>
<p>Before committing, you'll want to see exactly what changed. That's what <code>git diff</code> does:</p>
<div class="git-example">$ git diff</div>
<p>This shows unstaged changes — edits you haven't run <code>git add</code> on yet.</p>
<h3>Reading the Output</h3>
<p>Lines starting with <code>-</code> were removed. Lines starting with <code>+</code> were added.</p>
<h3>Staged Changes</h3>
<p>To see what's already staged (ready to commit):</p>
<div class="git-example">$ git diff --staged</div>
<div class="note">You can also use <code>git diff --cached</code> — it's the same thing. Both show staged changes.</div>`,
    exercises: [
        { instruction: 'View unstaged changes in your working directory.', hint: 'Use git diff', solution: 'git diff', check: 'command' },
        { instruction: 'View changes that are already staged.', hint: 'Use git diff --staged', solution: ['git diff --staged', 'git diff --cached'], check: 'command' },
    ],
    tests: [
        () => ({ type: 'mcq', question: 'What does <code>git diff</code> show?', options: ['Unstaged changes in the working directory', 'Staged changes', 'Commit history', 'Branch differences'], answer: 0 }),
        () => ({ type: 'write', question: 'Write the command to see staged changes.', solution: ['git diff --staged', 'git diff --cached'] }),
        () => ({ type: 'mcq', question: 'In diff output, what does a line starting with <code>+</code> mean?', options: ['A line was added', 'A line was removed', 'A line was unchanged', 'A file was deleted'], answer: 0 }),
        () => ({ type: 'mcq', question: 'Which two flags are equivalent for viewing staged changes?', options: ['--staged and --cached', '--staged and --committed', '--cached and --added', '--diff and --staged'], answer: 0 }),
        () => ({ type: 'write', question: 'View unstaged changes.', solution: 'git diff' }),
        () => ({ type: 'mcq', question: 'In diff output, what does a line starting with <code>-</code> mean?', options: ['A line was removed', 'A line was added', 'A comment', 'A warning'], answer: 0 }),
    ]
},

// ===== Lesson 5: Undoing Changes (git restore, git reset) =====
{
    id: 5,
    title: 'Undoing Changes',
    theme: 'Portfolio Site — fixing mistakes',
    repoConfig: {
        files: { 'index.html': '<h1>My Portfolio</h1>\n<p>Welcome!</p>', 'about.html': '<h1>About Me</h1>', 'contact.html': '<h1>Contact</h1>' },
        commits: [{ message: 'Initial portfolio site' }]
    },
    defaultCmd: 'git status',
    tutorial: `<h3>Everyone Makes Mistakes</h3>
<p>Git makes it easy to undo things. Here are the most common scenarios:</p>
<h3>Discard Unstaged Changes</h3>
<p>Changed a file and want to go back to the last committed version?</p>
<div class="git-example">$ git restore index.html</div>
<h3>Unstage a File</h3>
<p>Accidentally staged something? Remove it from the staging area (but keep your changes):</p>
<div class="git-example">$ git restore --staged index.html</div>
<h3>Unstage Everything</h3>
<p>To unstage all files at once:</p>
<div class="git-example">$ git reset</div>
<div class="note">Important: <code>git restore</code> discards changes permanently — there's no undo for the undo! Only use it when you're sure.</div>`,
    exercises: [
        { instruction: 'Discard changes to <code>index.html</code> (restore to last commit).', hint: 'Use git restore filename', solution: 'git restore index.html', check: 'command' },
        { instruction: 'Unstage the file <code>about.html</code> (keep changes, just remove from staging).', hint: 'Use git restore --staged filename', solution: 'git restore --staged about.html', check: 'command' },
        { instruction: 'Unstage all files at once.', hint: 'Use git reset with no arguments', solution: 'git reset', check: 'command' },
    ],
    tests: [
        () => ({ type: 'mcq', question: 'What does <code>git restore index.html</code> do?', options: ['Discards unstaged changes to index.html', 'Deletes index.html', 'Stages index.html', 'Commits index.html'], answer: 0 }),
        () => ({ type: 'write', question: 'Unstage a file called <code>readme.md</code> without losing changes.', solution: 'git restore --staged readme.md' }),
        () => ({ type: 'mcq', question: 'What does <code>git reset</code> (with no arguments) do?', options: ['Unstages all staged files', 'Deletes all files', 'Reverts the last commit', 'Resets to a remote branch'], answer: 0 }),
        () => ({ type: 'write', question: 'Discard all changes to <code>style.css</code>.', solution: 'git restore style.css' }),
        () => ({ type: 'mcq', question: 'Can you undo a <code>git restore</code> (discarding changes)?', options: ['No — the changes are lost permanently', 'Yes — use git undo', 'Yes — use git reflog', 'Yes — use Ctrl+Z'], answer: 0 }),
        () => ({ type: 'fix', question: 'Fix this command to unstage app.js:', broken: 'git restore staged app.js', solution: 'git restore --staged app.js' }),
    ]
},

// ===== Lesson 6: Branching Basics (git branch, git switch) =====
{
    id: 6,
    title: 'Branching Basics',
    theme: 'Game Dev — adding features safely',
    repoConfig: {
        files: { 'game.js': 'class Game { start() {} }', 'player.js': 'class Player { move() {} }' },
        commits: [{ message: 'Initial game setup' }]
    },
    defaultCmd: 'git branch',
    tutorial: `<h3>What Are Branches?</h3>
<p>A <span class="keyword">branch</span> is an independent line of development. Think of it like a parallel universe for your code.</p>
<p>The default branch is usually called <code>main</code>.</p>
<h3>Creating a Branch</h3>
<div class="git-example">$ git branch feature-enemies</div>
<h3>Switching Branches</h3>
<div class="git-example">$ git switch feature-enemies</div>
<h3>Create and Switch in One Step</h3>
<div class="git-example">$ git switch -c feature-powerups</div>
<h3>Listing Branches</h3>
<div class="git-example">$ git branch</div>
<p>The current branch is marked with <code>*</code>.</p>
<div class="note">Branches let you work on new features without breaking the working code on <code>main</code>. When you're done, you merge the branch back.</div>`,
    exercises: [
        { instruction: 'List all branches.', hint: 'Use git branch with no arguments', solution: 'git branch', check: 'command' },
        { instruction: 'Create a new branch called <code>feature-enemies</code>.', hint: 'Use git branch branch-name', solution: 'git branch feature-enemies', check: 'command' },
        { instruction: 'Switch to the <code>feature-enemies</code> branch.', hint: 'Use git switch branch-name', solution: ['git switch feature-enemies', 'git checkout feature-enemies'], check: 'command' },
        { instruction: 'Create and switch to a branch called <code>feature-sound</code> in one command.', hint: 'Use git switch -c', solution: ['git switch -c feature-sound', 'git checkout -b feature-sound'], check: 'command' },
    ],
    tests: [
        () => ({ type: 'mcq', question: 'What is a branch in Git?', options: ['An independent line of development', 'A copy of the repository', 'A type of commit', 'A remote server'], answer: 0 }),
        () => ({ type: 'write', question: 'Create a branch called <code>bugfix</code>.', solution: 'git branch bugfix' }),
        () => ({ type: 'write', question: 'Switch to a branch called <code>develop</code>.', solution: ['git switch develop', 'git checkout develop'] }),
        () => ({ type: 'write', question: 'Create and switch to a branch called <code>new-feature</code> in one command.', solution: ['git switch -c new-feature', 'git checkout -b new-feature'] }),
        () => ({ type: 'mcq', question: 'What does the <code>*</code> mean in <code>git branch</code> output?', options: ['It marks the current branch', 'It marks the main branch', 'It marks remote branches', 'It marks deleted branches'], answer: 0 }),
        () => ({ type: 'mcq', question: 'What is the default branch usually called?', options: ['main', 'default', 'master', 'trunk'], answer: 0 }),
    ]
},

// ===== Lesson 7: Merging Branches (git merge) =====
{
    id: 7,
    title: 'Merging Branches',
    theme: 'Newsletter — combining feature work',
    repoConfig: {
        files: { 'newsletter.html': '<h1>Weekly Newsletter</h1>', 'subscribe.js': 'function subscribe(email) {}' },
        commits: [{ message: 'Initial newsletter' }],
        branches: ['feature-header']
    },
    defaultCmd: 'git branch',
    tutorial: `<h3>Bringing Branches Together</h3>
<p>Once you finish work on a branch, you'll want to merge it back into <code>main</code>.</p>
<h3>The Merge Workflow</h3>
<ol style="margin:12px 0 12px 24px;line-height:2">
<li>Switch to the branch you want to merge <em>into</em> (usually main)</li>
<li>Run <code>git merge</code> with the branch you want to merge <em>from</em></li>
</ol>
<div class="git-example">$ git switch main
$ git merge feature-header</div>
<h3>After Merging</h3>
<p>You can delete the branch you merged since its changes are now in main:</p>
<div class="git-example">$ git branch -d feature-header</div>
<div class="note">Always switch to the <em>target</em> branch first (the one receiving changes), then merge the <em>source</em> branch into it.</div>`,
    exercises: [
        { instruction: 'Switch to the <code>main</code> branch.', hint: 'Use git switch main', solution: ['git switch main', 'git checkout main'], check: 'command' },
        { instruction: 'Merge the <code>feature-header</code> branch into the current branch.', hint: 'Use git merge branch-name', solution: 'git merge feature-header', check: 'command' },
        { instruction: 'Delete the <code>feature-header</code> branch.', hint: 'Use git branch -d branch-name', solution: ['git branch -d feature-header', 'git branch -D feature-header', 'git branch --delete feature-header'], check: 'command' },
    ],
    tests: [
        () => ({ type: 'mcq', question: 'Before merging, which branch should you be on?', options: ['The branch receiving the changes (e.g., main)', 'The branch with the new feature', 'Any branch', 'A new empty branch'], answer: 0 }),
        () => ({ type: 'write', question: 'Merge a branch called <code>add-footer</code> into the current branch.', solution: 'git merge add-footer' }),
        () => ({ type: 'write', question: 'Delete a branch called <code>old-feature</code>.', solution: ['git branch -d old-feature', 'git branch -D old-feature'] }),
        () => ({ type: 'mcq', question: 'What does <code>git branch -d feature</code> do?', options: ['Deletes the branch named feature', 'Creates a branch named feature', 'Downloads the feature branch', 'Switches to the feature branch'], answer: 0 }),
        () => ({ type: 'mcq', question: 'After merging a feature branch, is it safe to delete it?', options: ['Yes — its changes are now in the target branch', 'No — you will lose all the changes', 'Only if you push first', 'Only if there are no conflicts'], answer: 0 }),
        () => ({ type: 'fix', question: 'Fix this merge command:', broken: 'git merge -branch feature', solution: 'git merge feature' }),
    ]
},

// ===== Lesson 8: Remote Repositories (git remote, git push, git pull) =====
{
    id: 8,
    title: 'Remote Repositories',
    theme: 'Open Source Project — sharing with the world',
    repoConfig: {
        files: { 'README.md': '# My Project\nAn awesome open source tool', 'lib.js': 'module.exports = {}' },
        commits: [{ message: 'Initial commit' }]
    },
    defaultCmd: 'git remote -v',
    tutorial: `<h3>What Are Remotes?</h3>
<p>A <span class="keyword">remote</span> is a copy of your repository hosted somewhere else (like GitHub, GitLab, etc.).</p>
<h3>Adding a Remote</h3>
<div class="git-example">$ git remote add origin https://github.com/user/project.git</div>
<p><code>origin</code> is the conventional name for your main remote.</p>
<h3>Pushing Your Code</h3>
<p>Send your commits to the remote:</p>
<div class="git-example">$ git push origin main</div>
<h3>Pulling Changes</h3>
<p>Download and merge changes from the remote:</p>
<div class="git-example">$ git pull origin main</div>
<h3>Viewing Remotes</h3>
<div class="git-example">$ git remote -v</div>
<div class="note"><code>push</code> sends your commits up. <code>pull</code> brings others' commits down. Simple!</div>`,
    exercises: [
        { instruction: 'Add a remote called <code>origin</code> with URL <code>https://github.com/user/project.git</code>.', hint: 'Use git remote add name url', solution: 'git remote add origin https://github.com/user/project.git', check: 'command' },
        { instruction: 'Push your main branch to origin.', hint: 'Use git push remote branch', solution: ['git push origin main', 'git push'], check: 'command' },
        { instruction: 'Pull changes from origin main.', hint: 'Use git pull remote branch', solution: ['git pull origin main', 'git pull'], check: 'command' },
    ],
    tests: [
        () => ({ type: 'mcq', question: 'What is a remote in Git?', options: ['A copy of the repo hosted elsewhere', 'A local branch', 'A commit message', 'A configuration file'], answer: 0 }),
        () => ({ type: 'write', question: 'Push the main branch to origin.', solution: ['git push origin main', 'git push'] }),
        () => ({ type: 'mcq', question: 'What is the conventional name for the main remote?', options: ['origin', 'main', 'remote', 'upstream'], answer: 0 }),
        () => ({ type: 'write', question: 'View configured remotes with their URLs.', solution: 'git remote -v' }),
        () => ({ type: 'mcq', question: 'What does <code>git pull</code> do?', options: ['Downloads and merges changes from the remote', 'Uploads your changes', 'Creates a new branch', 'Deletes remote changes'], answer: 0 }),
        () => ({ type: 'mcq', question: 'What does <code>git push</code> do?', options: ['Sends your commits to the remote', 'Downloads commits', 'Creates a remote', 'Merges branches'], answer: 0 }),
    ]
},

// ===== Lesson 9: Cloning (git clone) =====
{
    id: 9,
    title: 'Cloning Repositories',
    theme: 'Contributing to open source',
    repoConfig: {
        files: { 'README.md': '# Cool Library\nA useful utility library' },
        commits: [{ message: 'Initial commit' }]
    },
    defaultCmd: 'git clone https://github.com/example/cool-library.git',
    tutorial: `<h3>Getting Someone Else's Code</h3>
<p><code>git clone</code> creates a local copy of a remote repository:</p>
<div class="git-example">$ git clone https://github.com/example/cool-library.git</div>
<p>This downloads everything — all files, all branches, all history.</p>
<h3>What Clone Does</h3>
<ol style="margin:12px 0 12px 24px;line-height:2">
<li>Creates a new folder with the project name</li>
<li>Downloads all the files and history</li>
<li>Sets up <code>origin</code> remote automatically</li>
</ol>
<h3>Cloning into a Specific Folder</h3>
<div class="git-example">$ git clone https://github.com/example/project.git my-folder</div>
<div class="note">Clone is how you start working on an existing project. It's usually the very first command you run.</div>`,
    exercises: [
        { instruction: 'Clone the repository at <code>https://github.com/example/project.git</code>.', hint: 'Use git clone url', solution: 'git clone https://github.com/example/project.git', check: 'command' },
        { instruction: 'Clone a repo into a folder called <code>my-copy</code>.', hint: 'Add the folder name after the URL', solution: 'git clone https://github.com/example/project.git my-copy', check: 'command' },
    ],
    tests: [
        () => ({ type: 'mcq', question: 'What does <code>git clone</code> do?', options: ['Creates a local copy of a remote repository', 'Creates a new empty repository', 'Copies a single file', 'Backs up your repository'], answer: 0 }),
        () => ({ type: 'mcq', question: 'After cloning, what remote is automatically configured?', options: ['origin', 'upstream', 'source', 'main'], answer: 0 }),
        () => ({ type: 'write', question: 'Clone <code>https://github.com/user/app.git</code>.', solution: 'git clone https://github.com/user/app.git' }),
        () => ({ type: 'mcq', question: 'Does <code>git clone</code> download the commit history?', options: ['Yes — all history and branches', 'No — only the latest files', 'Only the main branch', 'Only tagged releases'], answer: 0 }),
        () => ({ type: 'mcq', question: 'What does clone create on your computer?', options: ['A new folder with the full project', 'A zip file', 'A bookmark to the remote', 'A patch file'], answer: 0 }),
        () => ({ type: 'fix', question: 'Fix this clone command:', broken: 'git clne https://github.com/user/repo.git', solution: 'git clone https://github.com/user/repo.git' }),
    ]
},

// ===== Lesson 10: Git Stash =====
{
    id: 10,
    title: 'Stashing Changes',
    theme: 'Startup App — juggling tasks',
    repoConfig: {
        files: { 'app.js': 'const app = express();\napp.get("/", handler);', 'server.js': 'app.listen(3000);' },
        commits: [{ message: 'Initial server setup' }]
    },
    defaultCmd: 'git stash',
    tutorial: `<h3>Saving Work for Later</h3>
<p>Sometimes you need to switch branches but you're not ready to commit. <code>git stash</code> saves your uncommitted changes temporarily:</p>
<div class="git-example">$ git stash</div>
<p>Your working directory is now clean and you can switch branches safely.</p>
<h3>Getting Your Changes Back</h3>
<div class="git-example">$ git stash pop</div>
<p>This restores your stashed changes and removes them from the stash.</p>
<h3>Viewing Stashed Changes</h3>
<div class="git-example">$ git stash list</div>
<div class="note">Think of stash as a clipboard for your uncommitted work. Stash it, do something else, then pop it back.</div>`,
    exercises: [
        { instruction: 'Stash your current changes.', hint: 'Use git stash', solution: ['git stash', 'git stash push'], check: 'command' },
        { instruction: 'Restore your most recent stash.', hint: 'Use git stash pop', solution: 'git stash pop', check: 'command' },
        { instruction: 'List all stashed changes.', hint: 'Use git stash list', solution: 'git stash list', check: 'command' },
    ],
    tests: [
        () => ({ type: 'mcq', question: 'What does <code>git stash</code> do?', options: ['Temporarily saves uncommitted changes', 'Permanently deletes changes', 'Commits changes', 'Pushes to remote'], answer: 0 }),
        () => ({ type: 'write', question: 'Restore stashed changes.', solution: 'git stash pop' }),
        () => ({ type: 'mcq', question: 'What does <code>git stash pop</code> do?', options: ['Restores stashed changes and removes them from stash', 'Deletes the stash', 'Shows stash contents', 'Creates a new stash'], answer: 0 }),
        () => ({ type: 'write', question: 'View all items in the stash.', solution: 'git stash list' }),
        () => ({ type: 'mcq', question: 'When is stashing most useful?', options: ['When you need to switch branches with uncommitted work', 'When you want to delete files', 'When you want to push code', 'When you create a new repo'], answer: 0 }),
        () => ({ type: 'write', question: 'Drop the most recent stash entry.', solution: 'git stash drop' }),
    ]
},

// ===== Lesson 11: Tags (git tag) =====
{
    id: 11,
    title: 'Tagging Releases',
    theme: 'Mobile App — version releases',
    repoConfig: {
        files: { 'app.js': 'const VERSION = "1.0.0";', 'package.json': '{"name":"myapp","version":"1.0.0"}' },
        commits: [{ message: 'Release version 1.0.0' }, { message: 'Fix login bug' }, { message: 'Add dark mode' }]
    },
    defaultCmd: 'git tag',
    tutorial: `<h3>Marking Important Points</h3>
<p><span class="keyword">Tags</span> are labels you attach to specific commits — usually to mark releases like v1.0, v2.0, etc.</p>
<h3>Creating a Tag</h3>
<div class="git-example">$ git tag v1.0.0</div>
<h3>Annotated Tags (with a message)</h3>
<div class="git-example">$ git tag -m "First stable release" v1.0.0</div>
<h3>Listing Tags</h3>
<div class="git-example">$ git tag</div>
<h3>Deleting a Tag</h3>
<div class="git-example">$ git tag -d v1.0.0</div>
<div class="note">Tags don't move like branches do. Once a tag is placed on a commit, it stays there forever (unless you delete it).</div>`,
    exercises: [
        { instruction: 'Create a tag called <code>v1.0.0</code>.', hint: 'Use git tag tagname', solution: 'git tag v1.0.0', check: 'command' },
        { instruction: 'List all tags.', hint: 'Use git tag with no arguments', solution: 'git tag', check: 'command' },
        { instruction: 'Delete the tag <code>v1.0.0</code>.', hint: 'Use git tag -d tagname', solution: 'git tag -d v1.0.0', check: 'command' },
    ],
    tests: [
        () => ({ type: 'mcq', question: 'What is a Git tag used for?', options: ['Marking specific commits, usually for releases', 'Creating branches', 'Staging files', 'Deleting commits'], answer: 0 }),
        () => ({ type: 'write', question: 'Create a tag called <code>v2.0</code>.', solution: 'git tag v2.0' }),
        () => ({ type: 'write', question: 'Delete a tag called <code>beta</code>.', solution: 'git tag -d beta' }),
        () => ({ type: 'mcq', question: 'How are tags different from branches?', options: ['Tags don\'t move — they stay on one commit', 'Tags can only be created on main', 'Tags are automatically pushed', 'There is no difference'], answer: 0 }),
        () => ({ type: 'mcq', question: 'What command lists all tags?', options: ['git tag', 'git tags', 'git tag --list-all', 'git show tags'], answer: 0 }),
        () => ({ type: 'write', question: 'List all tags in the repository.', solution: 'git tag' }),
    ]
},

// ===== Lesson 12: Removing & Renaming Files =====
{
    id: 12,
    title: 'Removing & Renaming',
    theme: 'Photo Gallery — organizing files',
    repoConfig: {
        files: { 'photo1.jpg': '[image data]', 'photo2.jpg': '[image data]', 'old-readme.md': '# Gallery', 'temp.txt': 'delete me' },
        commits: [{ message: 'Add gallery files' }]
    },
    defaultCmd: 'git status',
    tutorial: `<h3>Removing Files</h3>
<p>To delete a tracked file and stage the deletion:</p>
<div class="git-example">$ git rm temp.txt</div>
<p>To stop tracking a file but keep it on disk:</p>
<div class="git-example">$ git rm --cached temp.txt</div>
<h3>Renaming Files</h3>
<p>To rename (or move) a file:</p>
<div class="git-example">$ git mv old-readme.md README.md</div>
<p>This is equivalent to renaming the file, running <code>git rm</code> on the old name, and <code>git add</code> on the new name.</p>
<div class="note"><code>git rm</code> is safer than just deleting a file manually because it stages the deletion for you automatically.</div>`,
    exercises: [
        { instruction: 'Remove <code>temp.txt</code> from the repo and working directory.', hint: 'Use git rm filename', solution: 'git rm temp.txt', check: 'command' },
        { instruction: 'Rename <code>old-readme.md</code> to <code>README.md</code>.', hint: 'Use git mv old new', solution: 'git mv old-readme.md README.md', check: 'command' },
        { instruction: 'Stop tracking <code>photo1.jpg</code> but keep the file on disk.', hint: 'Use git rm --cached', solution: 'git rm --cached photo1.jpg', check: 'command' },
    ],
    tests: [
        () => ({ type: 'mcq', question: 'What does <code>git rm</code> do?', options: ['Deletes a file and stages the deletion', 'Only deletes from disk', 'Only removes from staging', 'Reverts a file'], answer: 0 }),
        () => ({ type: 'write', question: 'Rename <code>old.js</code> to <code>new.js</code>.', solution: 'git mv old.js new.js' }),
        () => ({ type: 'mcq', question: 'What does <code>git rm --cached file</code> do?', options: ['Stops tracking the file but keeps it on disk', 'Deletes the file from disk', 'Stages the file', 'Reverts changes'], answer: 0 }),
        () => ({ type: 'write', question: 'Remove <code>debug.log</code> from the repo and disk.', solution: 'git rm debug.log' }),
        () => ({ type: 'mcq', question: 'What is <code>git mv</code> equivalent to?', options: ['Rename + git rm old + git add new', 'Just renaming the file', 'git add + git commit', 'git rm + git push'], answer: 0 }),
        () => ({ type: 'fix', question: 'Fix this rename command:', broken: 'git move old.txt new.txt', solution: 'git mv old.txt new.txt' }),
    ]
},

// ===== Lesson 13: .gitignore =====
{
    id: 13,
    title: 'Ignoring Files',
    theme: 'Web App — keeping secrets out of Git',
    repoConfig: {
        files: { 'app.js': 'const key = process.env.API_KEY;', '.env': 'API_KEY=secret123', 'node_modules/lodash.js': '// lodash', '.gitignore': '' },
        commits: [{ message: 'Initial web app' }]
    },
    defaultCmd: 'git status',
    tutorial: `<h3>Files Git Should Ignore</h3>
<p>Some files should never be committed:</p>
<ul style="margin:12px 0 12px 24px;line-height:2">
<li><code>.env</code> files with passwords and API keys</li>
<li><code>node_modules/</code> — installed dependencies</li>
<li>Build output, log files, OS files</li>
</ul>
<h3>The .gitignore File</h3>
<p>Create a file called <code>.gitignore</code> in your project root:</p>
<pre><code># Secret files
.env

# Dependencies
node_modules/

# Build output
dist/
*.log</code></pre>
<h3>Patterns</h3>
<p><code>*</code> matches any characters. <code>/</code> at the end means a directory. Lines starting with <code>#</code> are comments.</p>
<div class="note">Add your <code>.gitignore</code> early! It's harder to untrack files after they've been committed.</div>`,
    exercises: [
        { instruction: 'What command would you use to check which files are untracked?', hint: 'The same command you always use to check state', solution: 'git status', check: 'command' },
        { instruction: 'Stop tracking <code>.env</code> (already committed) but keep it on disk.', hint: 'Use git rm --cached', solution: 'git rm --cached .env', check: 'command' },
    ],
    tests: [
        () => ({ type: 'mcq', question: 'What is the purpose of <code>.gitignore</code>?', options: ['To tell Git which files to never track', 'To delete files', 'To encrypt files', 'To compress files'], answer: 0 }),
        () => ({ type: 'mcq', question: 'Which of these should typically be in .gitignore?', options: ['node_modules/', 'index.html', 'README.md', 'package.json'], answer: 0 }),
        () => ({ type: 'mcq', question: 'What does <code>*.log</code> in .gitignore mean?', options: ['Ignore all files ending in .log', 'Ignore only the file named log', 'Delete all log files', 'Track all log files'], answer: 0 }),
        () => ({ type: 'mcq', question: 'If a file is already tracked, does adding it to .gitignore stop tracking it?', options: ['No — you must also run git rm --cached', 'Yes — immediately', 'Yes — after the next commit', 'No — you must delete and re-add it'], answer: 0 }),
        () => ({ type: 'write', question: 'Stop tracking a committed file <code>secret.key</code> but keep it on disk.', solution: 'git rm --cached secret.key' }),
        () => ({ type: 'mcq', question: 'Should you commit the .gitignore file itself?', options: ['Yes — so all contributors use the same ignore rules', 'No — it is automatically applied', 'No — it contains secrets', 'Only on private repos'], answer: 0 }),
    ]
},

// ===== Lesson 14: Checking Out & Showing Commits =====
{
    id: 14,
    title: 'Inspecting Commits',
    theme: 'Blog Engine — understanding history',
    repoConfig: {
        files: { 'engine.js': 'class BlogEngine {}', 'template.html': '<div>{{content}}</div>' },
        commits: [{ message: 'Create blog engine' }, { message: 'Add template system' }, { message: 'Improve rendering' }]
    },
    defaultCmd: 'git log --oneline',
    tutorial: `<h3>Looking at a Specific Commit</h3>
<p>Use <code>git show</code> to see the details of any commit:</p>
<div class="git-example">$ git show HEAD</div>
<p><code>HEAD</code> refers to the latest commit on the current branch.</p>
<h3>Show a Specific Commit</h3>
<div class="git-example">$ git show a1b2c3d</div>
<p>Use the commit hash (or first few characters) from <code>git log</code>.</p>
<h3>What is HEAD?</h3>
<p><code>HEAD</code> is a pointer to the current commit. It usually points to the tip of your current branch. When you commit, HEAD moves forward to the new commit.</p>
<div class="note"><code>HEAD~1</code> means "one commit before HEAD", <code>HEAD~2</code> means two commits back, and so on.</div>`,
    exercises: [
        { instruction: 'Show details of the latest commit.', hint: 'Use git show HEAD', solution: ['git show HEAD', 'git show'], check: 'command' },
        { instruction: 'View the commit log in one-line format.', hint: 'Use git log --oneline', solution: 'git log --oneline', check: 'command' },
    ],
    tests: [
        () => ({ type: 'mcq', question: 'What does <code>HEAD</code> refer to in Git?', options: ['The latest commit on the current branch', 'The first commit ever made', 'The main branch', 'The remote repository'], answer: 0 }),
        () => ({ type: 'write', question: 'Show details of the most recent commit.', solution: ['git show HEAD', 'git show'] }),
        () => ({ type: 'mcq', question: 'What does <code>HEAD~1</code> mean?', options: ['One commit before HEAD', 'The first commit', 'The next commit', 'A branch named HEAD'], answer: 0 }),
        () => ({ type: 'mcq', question: 'What does <code>git show</code> display?', options: ['Details of a specific commit', 'All branches', 'The staging area', 'Remote URLs'], answer: 0 }),
        () => ({ type: 'write', question: 'View the compact commit log.', solution: 'git log --oneline' }),
        () => ({ type: 'mcq', question: 'When you make a new commit, what happens to HEAD?', options: ['It moves forward to the new commit', 'It stays on the old commit', 'It resets to the first commit', 'It is deleted'], answer: 0 }),
    ]
},

// ===== Lesson 15: Git Reset In Depth =====
{
    id: 15,
    title: 'Reset In Depth',
    theme: 'E-commerce — rolling back mistakes',
    repoConfig: {
        files: { 'cart.js': 'class Cart { add(item) {} }', 'checkout.js': 'function checkout() {}', 'payment.js': 'function pay() {}' },
        commits: [{ message: 'Add cart' }, { message: 'Add checkout' }, { message: 'Add payment (buggy)' }]
    },
    defaultCmd: 'git log --oneline',
    tutorial: `<h3>Three Flavors of Reset</h3>
<p><code>git reset</code> moves HEAD backward to a previous commit. There are three modes:</p>
<h3>--soft</h3>
<div class="git-example">$ git reset --soft HEAD~1</div>
<p>Moves HEAD back but keeps your changes staged. Ready to re-commit.</p>
<h3>--mixed (default)</h3>
<div class="git-example">$ git reset HEAD~1</div>
<p>Moves HEAD back and unstages changes, but keeps them in your working directory.</p>
<h3>--hard</h3>
<div class="git-example">$ git reset --hard HEAD~1</div>
<p>Moves HEAD back and <strong>discards all changes</strong>. Everything is gone.</p>
<div class="note">Use <code>--soft</code> to redo a commit message. Use <code>--mixed</code> to rework what to include. Use <code>--hard</code> only when you truly want to throw everything away.</div>`,
    exercises: [
        { instruction: 'Soft reset to one commit before HEAD.', hint: 'Use git reset --soft HEAD~1', solution: 'git reset --soft HEAD~1', check: 'command' },
        { instruction: 'Hard reset to one commit before HEAD.', hint: 'Use git reset --hard HEAD~1', solution: 'git reset --hard HEAD~1', check: 'command' },
        { instruction: 'Do a default (mixed) reset to one commit back.', hint: 'Just git reset HEAD~1', solution: ['git reset HEAD~1', 'git reset --mixed HEAD~1'], check: 'command' },
    ],
    tests: [
        () => ({ type: 'mcq', question: 'What does <code>git reset --soft HEAD~1</code> do?', options: ['Moves HEAD back, keeps changes staged', 'Moves HEAD back, discards all changes', 'Deletes the repository', 'Pushes to remote'], answer: 0 }),
        () => ({ type: 'mcq', question: 'What does <code>git reset --hard HEAD~1</code> do?', options: ['Moves HEAD back and discards all changes', 'Moves HEAD back, keeps changes staged', 'Only unstages files', 'Nothing — it needs a commit hash'], answer: 0 }),
        () => ({ type: 'write', question: 'Soft reset to the previous commit.', solution: 'git reset --soft HEAD~1' }),
        () => ({ type: 'write', question: 'Hard reset to the previous commit.', solution: 'git reset --hard HEAD~1' }),
        () => ({ type: 'mcq', question: 'What is the default mode of <code>git reset</code>?', options: ['--mixed', '--soft', '--hard', '--keep'], answer: 0 }),
        () => ({ type: 'mcq', question: 'Which reset mode is the most destructive?', options: ['--hard', '--soft', '--mixed', 'They are all the same'], answer: 0 }),
    ]
},

// ===== Lesson 16: Git Revert =====
{
    id: 16,
    title: 'Reverting Commits',
    theme: 'API Server — safely undoing deployed changes',
    repoConfig: {
        files: { 'api.js': 'app.get("/users", getUsers);', 'routes.js': 'const routes = [];' },
        commits: [{ message: 'Add user API' }, { message: 'Add routes config' }, { message: 'Break the login endpoint' }]
    },
    defaultCmd: 'git log --oneline',
    tutorial: `<h3>Revert vs Reset</h3>
<p><code>git reset</code> rewrites history — it removes commits. <code>git revert</code> creates a <em>new</em> commit that undoes a previous one.</p>
<h3>Why Revert?</h3>
<p>If you've already pushed commits, rewriting history with reset is dangerous. Revert is safe because it doesn't change existing commits.</p>
<h3>Using Revert</h3>
<div class="git-example">$ git revert HEAD</div>
<p>This creates a new commit that reverses whatever HEAD did.</p>
<div class="git-example">$ git revert a1b2c3d</div>
<p>Revert any specific commit by its hash.</p>
<div class="note">Use <code>reset</code> for local, unpushed mistakes. Use <code>revert</code> for pushed, shared commits.</div>`,
    exercises: [
        { instruction: 'Revert the most recent commit.', hint: 'Use git revert HEAD', solution: 'git revert HEAD', check: 'command' },
    ],
    tests: [
        () => ({ type: 'mcq', question: 'What does <code>git revert</code> do?', options: ['Creates a new commit that undoes a previous commit', 'Deletes a commit from history', 'Unstages files', 'Resets HEAD'], answer: 0 }),
        () => ({ type: 'mcq', question: 'When should you use revert instead of reset?', options: ['When the commit has already been pushed/shared', 'When you want to delete history', 'When working alone', 'Never — always use reset'], answer: 0 }),
        () => ({ type: 'write', question: 'Revert the latest commit.', solution: 'git revert HEAD' }),
        () => ({ type: 'mcq', question: 'Does <code>git revert</code> modify existing commits?', options: ['No — it creates a new commit', 'Yes — it removes the old commit', 'Yes — it changes the commit message', 'It depends on the flags used'], answer: 0 }),
        () => ({ type: 'mcq', question: 'After a revert, the reverted commit is:', options: ['Still in the history', 'Deleted', 'Moved to a branch', 'Hidden'], answer: 0 }),
        () => ({ type: 'fix', question: 'Fix this revert command:', broken: 'git reverse HEAD', solution: 'git revert HEAD' }),
    ]
},

// ===== Lesson 17: Cherry-Pick =====
{
    id: 17,
    title: 'Cherry-Picking',
    theme: 'Multi-platform App — picking features across branches',
    repoConfig: {
        files: { 'app.js': 'class App {}', 'feature.js': 'function coolFeature() {}' },
        commits: [{ message: 'Initial app' }, { message: 'Add cool feature' }, { message: 'Add another thing' }],
        branches: ['release']
    },
    defaultCmd: 'git log --oneline',
    tutorial: `<h3>Picking Specific Commits</h3>
<p><code>git cherry-pick</code> applies a specific commit from another branch onto your current branch:</p>
<div class="git-example">$ git cherry-pick a1b2c3d</div>
<p>This copies the commit's changes and creates a new commit on your current branch.</p>
<h3>When to Use It</h3>
<ul style="margin:12px 0 12px 24px;line-height:2">
<li>A bugfix from one branch that's needed on another</li>
<li>Picking specific features without merging everything</li>
<li>Backporting fixes to release branches</li>
</ul>
<div class="note">Cherry-pick creates a <em>copy</em> of the commit — the original stays on its branch. The new commit gets a different hash.</div>`,
    exercises: [
        { instruction: 'View the log to find commit hashes.', hint: 'Use git log --oneline', solution: 'git log --oneline', check: 'command' },
    ],
    tests: [
        () => ({ type: 'mcq', question: 'What does <code>git cherry-pick</code> do?', options: ['Copies a specific commit onto the current branch', 'Merges two branches', 'Deletes a commit', 'Creates a new branch'], answer: 0 }),
        () => ({ type: 'mcq', question: 'After cherry-picking, the original commit:', options: ['Stays on its original branch unchanged', 'Is moved to the current branch', 'Is deleted', 'Is modified'], answer: 0 }),
        () => ({ type: 'mcq', question: 'When is cherry-pick most useful?', options: ['Applying a single bugfix from another branch', 'Merging all changes between branches', 'Deleting old branches', 'Pushing to remote'], answer: 0 }),
        () => ({ type: 'mcq', question: 'Does the cherry-picked commit keep the same hash?', options: ['No — it gets a new hash', 'Yes — always', 'Only if forced', 'Only on the same branch'], answer: 0 }),
        () => ({ type: 'mcq', question: 'Cherry-pick requires:', options: ['A commit hash', 'A branch name', 'A remote URL', 'A tag name'], answer: 0 }),
        () => ({ type: 'fix', question: 'Fix this command:', broken: 'git cherry pick abc1234', solution: 'git cherry-pick abc1234' }),
    ]
},

// ===== Lesson 18: Rebasing =====
{
    id: 18,
    title: 'Rebasing',
    theme: 'Team Project — keeping history clean',
    repoConfig: {
        files: { 'main.js': 'console.log("main");', 'feature.js': 'console.log("feature");' },
        commits: [{ message: 'Initial setup' }, { message: 'Add main logic' }],
        branches: ['feature-x']
    },
    defaultCmd: 'git log --oneline',
    tutorial: `<h3>Merge vs Rebase</h3>
<p>Both <code>merge</code> and <code>rebase</code> integrate changes from one branch into another, but they do it differently:</p>
<p><strong>Merge</strong> creates a merge commit that joins two branches.</p>
<p><strong>Rebase</strong> replays your commits on top of another branch, creating a linear history.</p>
<h3>Using Rebase</h3>
<div class="git-example">$ git switch feature-x
$ git rebase main</div>
<p>This takes all commits on <code>feature-x</code> and replays them after the latest commit on <code>main</code>.</p>
<h3>The Golden Rule</h3>
<p><strong>Never rebase commits that have been pushed to a shared repository.</strong> Rebasing rewrites commit history.</p>
<div class="note">Rebase gives you a cleaner, linear history. Merge preserves the true branching history. Both are valid — teams choose based on preference.</div>`,
    exercises: [
        { instruction: 'Rebase the current branch onto <code>main</code>.', hint: 'Use git rebase main', solution: 'git rebase main', check: 'command' },
    ],
    tests: [
        () => ({ type: 'mcq', question: 'What does <code>git rebase main</code> do?', options: ['Replays current branch commits on top of main', 'Merges main into current branch', 'Deletes the current branch', 'Pushes to main'], answer: 0 }),
        () => ({ type: 'mcq', question: 'What is the "golden rule" of rebasing?', options: ['Never rebase pushed/shared commits', 'Always rebase before merging', 'Never use rebase', 'Only rebase on main'], answer: 0 }),
        () => ({ type: 'mcq', question: 'How does rebase differ from merge?', options: ['Rebase creates linear history, merge creates a merge commit', 'They are identical', 'Merge is faster', 'Rebase pushes to remote'], answer: 0 }),
        () => ({ type: 'write', question: 'Rebase the current branch onto <code>main</code>.', solution: 'git rebase main' }),
        () => ({ type: 'mcq', question: 'Does rebase change commit hashes?', options: ['Yes — commits are recreated with new hashes', 'No — hashes stay the same', 'Only the first commit changes', 'Only if there are conflicts'], answer: 0 }),
        () => ({ type: 'mcq', question: 'Which gives a cleaner, linear history?', options: ['Rebase', 'Merge', 'Both are the same', 'Neither'], answer: 0 }),
    ]
},

// ===== Lesson 19: Git Config =====
{
    id: 19,
    title: 'Git Configuration',
    theme: 'New Developer Setup — personalizing Git',
    repoConfig: {
        files: { 'README.md': '# My Project' },
        commits: [{ message: 'Initial commit' }]
    },
    defaultCmd: 'git config --list',
    tutorial: `<h3>Setting Up Your Identity</h3>
<p>Git needs to know who you are for commit authorship:</p>
<div class="git-example">$ git config --global user.name "Your Name"
$ git config --global user.email "you@example.com"</div>
<h3>Viewing Configuration</h3>
<div class="git-example">$ git config --list</div>
<h3>Scope Levels</h3>
<ul style="margin:12px 0 12px 24px;line-height:2">
<li><code>--global</code> — applies to all repos for your user</li>
<li><code>--local</code> — applies only to the current repo (overrides global)</li>
</ul>
<h3>Checking a Specific Value</h3>
<div class="git-example">$ git config user.name</div>
<div class="note">Always set your name and email before making your first commit. These appear in every commit you make.</div>`,
    exercises: [
        { instruction: 'Set your global username to "Dev Student".', hint: 'Use git config --global user.name "Dev Student"', solution: 'git config --global user.name "Dev Student"', check: 'command' },
        { instruction: 'View all configuration settings.', hint: 'Use git config --list', solution: ['git config --list', 'git config -l'], check: 'command' },
        { instruction: 'Check the current user.name value.', hint: 'Use git config user.name', solution: 'git config user.name', check: 'command' },
    ],
    tests: [
        () => ({ type: 'mcq', question: 'Why do you set user.name and user.email?', options: ['So Git knows who authored each commit', 'To log in to GitHub', 'To encrypt your code', 'To set file permissions'], answer: 0 }),
        () => ({ type: 'write', question: 'Set your global email to "me@example.com".', solution: 'git config --global user.email "me@example.com"' }),
        () => ({ type: 'mcq', question: 'What does <code>--global</code> mean in git config?', options: ['The setting applies to all repos for your user', 'It applies to all users on the machine', 'It pushes the config to remote', 'It only affects the current branch'], answer: 0 }),
        () => ({ type: 'write', question: 'List all Git configuration settings.', solution: ['git config --list', 'git config -l'] }),
        () => ({ type: 'mcq', question: 'Which scope overrides the other?', options: ['--local overrides --global', '--global overrides --local', 'They don\'t interact', 'Both are the same'], answer: 0 }),
        () => ({ type: 'fix', question: 'Fix this config command:', broken: 'git config global user.name "Dev"', solution: 'git config --global user.name "Dev"' }),
    ]
},

// ===== Lesson 20: Putting It All Together =====
{
    id: 20,
    title: 'Real-World Workflow',
    theme: 'Team Collaboration — the complete workflow',
    repoConfig: {
        files: { 'app.js': 'const app = require("express")();', 'README.md': '# Team Project', 'test.js': 'describe("app", () => {});' },
        commits: [{ message: 'Initial project setup' }, { message: 'Add README' }]
    },
    defaultCmd: 'git status',
    tutorial: `<h3>A Real-World Git Workflow</h3>
<p>Here's the workflow most teams follow daily:</p>
<h3>1. Start Fresh</h3>
<div class="git-example">$ git pull origin main</div>
<h3>2. Create a Feature Branch</h3>
<div class="git-example">$ git switch -c feature-login</div>
<h3>3. Make Changes, Stage, Commit</h3>
<div class="git-example">$ git add .
$ git commit -m "Add login form"</div>
<h3>4. Push Your Branch</h3>
<div class="git-example">$ git push origin feature-login</div>
<h3>5. After Review, Merge & Clean Up</h3>
<div class="git-example">$ git switch main
$ git merge feature-login
$ git branch -d feature-login
$ git push origin main</div>
<div class="note">This "feature branch" workflow keeps main stable while letting everyone work independently. It's the most common Git workflow in the industry.</div>`,
    exercises: [
        { instruction: 'Pull the latest changes from origin main.', hint: 'Use git pull origin main', solution: ['git pull origin main', 'git pull'], check: 'command' },
        { instruction: 'Create and switch to a branch called <code>feature-login</code>.', hint: 'Use git switch -c', solution: ['git switch -c feature-login', 'git checkout -b feature-login'], check: 'command' },
        { instruction: 'Stage all files and commit with message "Add login form".', hint: 'Use git add . then git commit -m', solution: 'git add . && git commit -m "Add login form"', check: 'command' },
        { instruction: 'Push the current branch to origin.', hint: 'Use git push origin branch-name', solution: ['git push origin feature-login', 'git push'], check: 'command' },
    ],
    tests: [
        () => ({ type: 'mcq', question: 'What is the first step when starting work each day?', options: ['Pull the latest changes', 'Create a new repo', 'Delete old branches', 'Run git init'], answer: 0 }),
        () => ({ type: 'write', question: 'Create and switch to a branch called <code>feature-search</code>.', solution: ['git switch -c feature-search', 'git checkout -b feature-search'] }),
        () => ({ type: 'mcq', question: 'Why use feature branches?', options: ['To keep main stable while developing features', 'To make the repo bigger', 'Because Git requires them', 'To avoid using commits'], answer: 0 }),
        () => ({ type: 'write', question: 'Push your code to origin.', solution: ['git push origin main', 'git push'] }),
        () => ({ type: 'mcq', question: 'After merging, what should you do with the feature branch?', options: ['Delete it — its changes are in main now', 'Keep it forever', 'Rename it', 'Push it again'], answer: 0 }),
        () => ({ type: 'mcq', question: 'What is this workflow called?', options: ['Feature branch workflow', 'Waterfall workflow', 'Solo workflow', 'Reset workflow'], answer: 0 }),
    ]
},

];
