(function () {
'use strict';

// ===== Helpers =====
const $ = id => document.getElementById(id);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const shuffle = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ===== State =====
let SQL = null;
let db = null;
let currentLesson = null;
let currentTab = 'tutorial';
let testState = null;

const defaultProgress = () => ({
    currentLesson: 0,
    completed: new Array(20).fill(false),
    bestScores: new Array(20).fill(0),
    exercisesDone: Array.from({ length: 20 }, () => [])
});

let progress = defaultProgress();

function loadProgress() {
    try {
        const raw = localStorage.getItem('edu-sql-progress');
        if (raw) {
            const p = JSON.parse(raw);
            progress = { ...defaultProgress(), ...p };
            // ensure arrays are right length
            while (progress.completed.length < 20) progress.completed.push(false);
            while (progress.bestScores.length < 20) progress.bestScores.push(0);
            while (progress.exercisesDone.length < 20) progress.exercisesDone.push([]);
        }
    } catch (e) { progress = defaultProgress(); }
}

function saveProgress() {
    localStorage.setItem('edu-sql-progress', JSON.stringify(progress));
}

function resetProgress() {
    showConfirm('Reset Progress', 'This will erase all your progress. Are you sure?', () => {
        progress = defaultProgress();
        localStorage.removeItem('edu-sql-progress');
        currentLesson = null;
        renderSidebar();
        updateProgressBar();
        showWelcome();
        showToast('Progress reset');
    });
}

// ===== SQL Engine =====
async function initSQL() {
    SQL = await initSqlJs({
        locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`
    });
}

function initDB(lesson) {
    if (db) db.close();
    db = new SQL.Database();
    try {
        db.run(lesson.schema);
    } catch (e) {
        console.error('Schema init error:', e);
    }
}

function execSQL(query) {
    try {
        const results = db.exec(query);
        if (!results.length) return { columns: [], rows: [], message: 'Query executed successfully. No rows returned.' };
        return { columns: results[0].columns, rows: results[0].values };
    } catch (e) {
        return { error: e.message };
    }
}

function renderResults(result, container) {
    if (result.error) {
        container.innerHTML = `<p class="results-error">${escHTML(result.error)}</p>`;
        return;
    }
    if (!result.columns.length) {
        container.innerHTML = `<p class="results-info">${escHTML(result.message || 'Done.')}</p>`;
        return;
    }
    let html = '<table class="results-table"><thead><tr>';
    result.columns.forEach(c => html += `<th>${escHTML(c)}</th>`);
    html += '</tr></thead><tbody>';
    const maxRows = 100;
    const rows = result.rows.slice(0, maxRows);
    rows.forEach(r => {
        html += '<tr>';
        r.forEach(v => html += `<td>${v === null ? '<em>NULL</em>' : escHTML(String(v))}</td>`);
        html += '</tr>';
    });
    html += '</tbody></table>';
    if (result.rows.length > maxRows) {
        html += `<p class="results-count">Showing ${maxRows} of ${result.rows.length} rows</p>`;
    } else {
        html += `<p class="results-count">${result.rows.length} row${result.rows.length !== 1 ? 's' : ''}</p>`;
    }
    container.innerHTML = html;
}

function escHTML(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Compare two query results for equivalence
// When ordered=true, row order matters (for ORDER BY queries)
function resultsMatch(a, b, ordered) {
    if (a.error || b.error) return false;
    if (a.columns.length !== b.columns.length) return false;
    if (a.rows.length !== b.rows.length) return false;
    // Compare column names (case-insensitive)
    const colsA = a.columns.map(c => c.toLowerCase());
    const colsB = b.columns.map(c => c.toLowerCase());
    if (colsA.join(',') !== colsB.join(',')) return false;
    // Normalize rows
    const normalize = rows => rows.map(r => r.map(v => String(v ?? '').toLowerCase().trim()).join('|'));
    const ra = normalize(a.rows);
    const rb = normalize(b.rows);
    if (ordered) {
        return ra.join('\n') === rb.join('\n');
    }
    return ra.sort().join('\n') === rb.sort().join('\n');
}

// Detect if a query uses ORDER BY (so we compare row order)
function hasOrderBy(sql) {
    return /ORDER\s+BY/i.test(sql);
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
    $('progress-bar').style.width = `${(done / 20) * 100}%`;
    $('progress-text').textContent = `${done} / 20`;
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
    initDB(lesson);

    // Hide welcome, show lesson
    $('welcome-screen').classList.add('hidden');
    $('lesson-view').classList.remove('hidden');

    // Header
    $('lesson-number').textContent = `Lesson ${lesson.id} of 20`;
    $('lesson-title').textContent = lesson.title;
    $('lesson-theme').textContent = lesson.theme;

    // Tutorial
    $('tutorial-content').innerHTML = lesson.tutorial;

    // Sandbox
    $('sandbox-dataset-name').textContent = lesson.theme;
    $('sandbox-editor').value = lesson.defaultQuery || '';
    $('sandbox-results').innerHTML = '<p class="results-placeholder">Run a query to see results here.</p>';
    $('schema-text').textContent = lesson.schemaDisplay || '';
    $('schema-display').classList.add('hidden');

    // Exercises
    renderExercises(lesson);

    // Test
    resetTestUI(lesson);

    // Nav buttons
    $('prev-lesson').style.visibility = lesson.id > 1 ? 'visible' : 'hidden';
    $('next-lesson').style.visibility = lesson.id < 20 ? 'visible' : 'hidden';

    // Default to tutorial tab
    switchTab('tutorial');
    renderSidebar();

    // Scroll to top
    $('main-content').scrollTop = 0;

    // Close sidebar on mobile
    $('sidebar').classList.remove('open');
}

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.toggle('active', tc.id === `tab-${tab}`));
    // Re-init DB when switching to exercises or test to get clean state
    if ((tab === 'exercises' || tab === 'test') && currentLesson) {
        initDB(currentLesson);
    }
}

// ===== Exercises =====
function renderExercises(lesson) {
    const container = $('exercises-list');
    container.innerHTML = '';
    const idx = lesson.id - 1;
    // Ensure exercisesDone array exists for this lesson
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
                <textarea class="sql-editor exercise-editor" id="ex-editor-${i}" spellcheck="false" placeholder="Write your SQL here...">${done ? ex.solution : ''}</textarea>
                <div class="editor-actions">
                    <button class="btn-primary ex-check" data-idx="${i}">Check</button>
                </div>
            </div>
            <div class="exercise-feedback" id="ex-feedback-${i}"></div>
            <div class="exercise-results results-area" id="ex-results-${i}" style="display:none"></div>
        `;
        container.appendChild(card);
    });

    // Hint toggles
    container.querySelectorAll('.hint-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const hint = $(`hint-${btn.dataset.idx}`);
            hint.classList.toggle('visible');
            btn.textContent = hint.classList.contains('visible') ? 'Hide hint' : 'Show hint';
        });
    });

    // Check buttons
    container.querySelectorAll('.ex-check').forEach(btn => {
        btn.addEventListener('click', () => checkExercise(parseInt(btn.dataset.idx)));
    });

    // Ctrl+Enter in exercise editors
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
    const userQuery = editor.value.trim();

    if (!userQuery) {
        feedback.className = 'exercise-feedback incorrect';
        feedback.textContent = 'Please write a query first.';
        return;
    }

    // Re-init DB for clean comparison
    initDB(currentLesson);

    // For data modification queries (INSERT/UPDATE/DELETE/CREATE), use verify approach
    if (ex.verify) {
        const userExec = execSQL(userQuery);
        if (userExec.error) {
            feedback.className = 'exercise-feedback incorrect';
            feedback.textContent = `Error: ${userExec.error}`;
            resultsDiv.style.display = 'none';
            return;
        }
        const userVerify = execSQL(ex.verify);
        initDB(currentLesson);
        execSQL(ex.solution);
        const expectedVerify = execSQL(ex.verify);

        if (resultsMatch(userVerify, expectedVerify, hasOrderBy(ex.solution))) {
            markExerciseDone(i);
            feedback.className = 'exercise-feedback correct';
            feedback.textContent = 'Correct!';
            resultsDiv.style.display = 'block';
            renderResults(userVerify, resultsDiv);
            $(`ex-editor-${i}`).closest('.exercise-card').classList.add('completed', 'flash-success');
        } else {
            feedback.className = 'exercise-feedback incorrect';
            feedback.textContent = 'Not quite. Check your query and try again.';
            resultsDiv.style.display = 'block';
            renderResults(userVerify, resultsDiv);
        }
    } else {
        // Standard SELECT comparison
        const userResult = execSQL(userQuery);
        if (userResult.error) {
            feedback.className = 'exercise-feedback incorrect';
            feedback.textContent = `Error: ${userResult.error}`;
            resultsDiv.style.display = 'none';
            return;
        }
        const expectedResult = execSQL(ex.solution);
        if (resultsMatch(userResult, expectedResult, hasOrderBy(ex.solution))) {
            markExerciseDone(i);
            feedback.className = 'exercise-feedback correct';
            feedback.textContent = 'Correct!';
            resultsDiv.style.display = 'block';
            renderResults(userResult, resultsDiv);
            $(`ex-editor-${i}`).closest('.exercise-card').classList.add('completed', 'flash-success');
        } else {
            feedback.className = 'exercise-feedback incorrect';
            feedback.textContent = 'Not quite. Your results don\'t match the expected output. Try again!';
            resultsDiv.style.display = 'block';
            renderResults(userResult, resultsDiv);
        }
    }
}

function markExerciseDone(i) {
    const idx = currentLesson.id - 1;
    progress.exercisesDone[idx][i] = true;
    $('exercises-done').textContent = progress.exercisesDone[idx].filter(Boolean).length;
    // Check if all exercises done
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
    initDB(currentLesson);
    // Generate 5 random questions from templates
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
        html += `<div class="editor-container"><textarea class="sql-editor test-editor" spellcheck="false" placeholder="Write your SQL here...">${q.type === 'fix' ? q.broken : ''}</textarea></div>`;
        html += '<div class="test-submit-row"><button class="btn-primary test-submit-btn">Submit Answer</button></div>';
    }
    html += '</div>';
    $('test-question-area').innerHTML = html;

    // MCQ selection
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

    // Submit handler
    const submitBtn = $('test-question-area').querySelector('.test-submit-btn');
    submitBtn.addEventListener('click', () => {
        submitTestAnswer(q, selectedMCQ);
    });

    // Ctrl+Enter for write/fix
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

    // Re-init DB for clean state
    initDB(currentLesson);

    if (q.type === 'mcq') {
        correct = selectedMCQ === q.answer;
        userAnswer = q.options[selectedMCQ] || 'No answer';
    } else if (q.type === 'write' || q.type === 'fix') {
        const editor = $('test-question-area').querySelector('.test-editor');
        userAnswer = editor ? editor.value.trim() : '';
        if (!userAnswer) { showToast('Please write a query'); return; }

        if (q.verify) {
            // Data modification: run user query, then verify
            const userExec = execSQL(userAnswer);
            if (userExec.error) { correct = false; }
            else {
                const userVerify = execSQL(q.verify);
                initDB(currentLesson);
                execSQL(q.solution);
                const expectedVerify = execSQL(q.verify);
                correct = resultsMatch(userVerify, expectedVerify, hasOrderBy(q.solution));
            }
        } else {
            // SELECT: compare results
            const userResult = execSQL(userAnswer);
            if (userResult.error) { correct = false; }
            else {
                initDB(currentLesson);
                const expectedResult = execSQL(q.solution);
                correct = resultsMatch(userResult, expectedResult, hasOrderBy(q.solution));
            }
        }
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

    // Review
    let reviewHTML = '';
    testState.answers.forEach((a, i) => {
        const cls = a.correct ? 'correct' : 'incorrect';
        reviewHTML += `<div class="review-item ${cls}">
            <div class="review-question">${i + 1}. ${a.correct ? '\u2713' : '\u2717'} ${a.question.type.toUpperCase()}: ${a.question.question.replace(/<[^>]+>/g, '').substring(0, 120)}${a.question.question.length > 120 ? '...' : ''}</div>
            ${!a.correct && a.question.solution ? `<div class="review-answer">Expected: ${escHTML(a.question.solution)}</div>` : ''}
        </div>`;
    });
    $('test-review').innerHTML = reviewHTML;

    // Save score
    const idx = currentLesson.id - 1;
    if (score > progress.bestScores[idx]) {
        progress.bestScores[idx] = score;
    }
    if (score >= 3) {
        progress.completed[idx] = true;
    }
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
    const ok = $('confirm-ok');
    const cancel = $('confirm-cancel');
    const close = () => $('confirm-dialog').classList.add('hidden');
    const handler = () => { close(); onOk(); };
    ok.onclick = handler;
    cancel.onclick = close;
    $('confirm-dialog').querySelector('.dialog-overlay').onclick = close;
}

// ===== Event Listeners =====
function bindEvents() {
    // Start button
    $('start-btn').addEventListener('click', () => loadLesson(1));

    // Sidebar toggle (mobile)
    $('sidebar-toggle').addEventListener('click', () => $('sidebar').classList.toggle('open'));

    // Reset
    $('reset-btn').addEventListener('click', resetProgress);

    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Tutorial next
    $('tutorial-next').addEventListener('click', () => switchTab('sandbox'));

    // Sandbox
    $('sandbox-run').addEventListener('click', () => {
        const query = $('sandbox-editor').value.trim();
        if (!query) return;
        const result = execSQL(query);
        renderResults(result, $('sandbox-results'));
    });
    $('sandbox-clear').addEventListener('click', () => {
        $('sandbox-editor').value = '';
        $('sandbox-results').innerHTML = '<p class="results-placeholder">Run a query to see results here.</p>';
    });
    $('sandbox-editor').addEventListener('keydown', e => {
        if (e.ctrlKey && e.key === 'Enter') {
            $('sandbox-run').click();
        }
    });
    $('schema-toggle').addEventListener('click', () => {
        const d = $('schema-display');
        d.classList.toggle('hidden');
        $('schema-toggle').textContent = d.classList.contains('hidden') ? 'Show Schema' : 'Hide Schema';
    });

    // Test
    $('test-start').addEventListener('click', startTest);
    $('test-retake').addEventListener('click', startTest);
    $('test-next-lesson').addEventListener('click', () => {
        if (currentLesson && currentLesson.id < 20) loadLesson(currentLesson.id + 1);
    });

    // Lesson nav
    $('prev-lesson').addEventListener('click', () => {
        if (currentLesson && currentLesson.id > 1) loadLesson(currentLesson.id - 1);
    });
    $('next-lesson').addEventListener('click', () => {
        if (currentLesson && currentLesson.id < 20) loadLesson(currentLesson.id + 1);
    });
}

// ===== Initialization =====
async function init() {
    loadProgress();
    renderSidebar();
    updateProgressBar();
    bindEvents();

    try {
        await initSQL();
    } catch (e) {
        $('main-content').innerHTML = `<div style="padding:40px;text-align:center"><h2>Failed to load SQL engine</h2><p>${escHTML(e.message)}</p><p>Please check your internet connection and refresh.</p></div>`;
        return;
    }

    if (progress.currentLesson > 0) {
        loadLesson(progress.currentLesson);
    } else {
        showWelcome();
    }
}

// ===== LESSONS DATA =====
const LESSONS = [
// --- Lesson 1: SELECT Basics (Space) ---
{
    id: 1,
    title: 'SELECT Basics',
    theme: 'Space \u2014 planets, moons, distances',
    tutorial: `<h3>The SELECT Statement</h3>
<p>Every SQL query starts with <code>SELECT</code>. It tells the database which columns you want to retrieve.</p>
<h3>Select All Columns</h3>
<p>Use <code>*</code> to grab everything:</p>
<div class="sql-example">SELECT * FROM planets;</div>
<h3>Select Specific Columns</h3>
<p>List the column names separated by commas:</p>
<div class="sql-example">SELECT name, type FROM planets;</div>
<h3>Multiple Columns</h3>
<p>You can pick any combination:</p>
<div class="sql-example">SELECT name, diameter_km, moons FROM planets;</div>
<div class="note">Tip: <code>SELECT</code> and <code>FROM</code> are SQL keywords. They're not case-sensitive\u2014<code>select</code> works too\u2014but UPPERCASE is the convention.</div>`,
    schema: `CREATE TABLE planets (name TEXT, type TEXT, diameter_km INT, distance_au REAL, moons INT, has_rings INT);
INSERT INTO planets VALUES ('Mercury','rocky',4879,0.39,0,0),('Venus','rocky',12104,0.72,0,0),('Earth','rocky',12756,1.0,1,0),('Mars','rocky',6792,1.52,2,0),('Jupiter','gas giant',142984,5.20,95,1),('Saturn','gas giant',120536,9.58,146,1),('Uranus','ice giant',51118,19.22,28,1),('Neptune','ice giant',49528,30.05,16,1),('Pluto','dwarf',2376,39.48,5,0);`,
    schemaDisplay: 'planets(name TEXT, type TEXT, diameter_km INT, distance_au REAL, moons INT, has_rings INT)',
    defaultQuery: 'SELECT * FROM planets;',
    exercises: [
        { instruction: 'Select all columns from the planets table.', hint: 'Use SELECT * FROM table_name', solution: 'SELECT * FROM planets' },
        { instruction: 'Select only the name and type of each planet.', hint: 'List columns separated by commas after SELECT', solution: 'SELECT name, type FROM planets' },
        { instruction: 'Select the name, diameter_km, and moons columns.', hint: 'SELECT col1, col2, col3 FROM table', solution: 'SELECT name, diameter_km, moons FROM planets' }
    ],
    tests: [
        () => { const c = pick(['name','type','diameter_km','distance_au','moons']); return { type:'write', question:`Select only the <code>${c}</code> column from the planets table.`, solution:`SELECT ${c} FROM planets` }; },
        () => { const cols = shuffle(['name','type','diameter_km','distance_au','moons','has_rings']).slice(0,2); return { type:'write', question:`Select the <code>${cols[0]}</code> and <code>${cols[1]}</code> columns from planets.`, solution:`SELECT ${cols[0]}, ${cols[1]} FROM planets` }; },
        () => ({ type:'write', question:'Select all columns from the planets table.', solution:'SELECT * FROM planets' }),
        () => ({ type:'mcq', question:'What does <code>SELECT *</code> mean in SQL?', options:['Select all columns','Select all tables','Delete everything','Create a new table'], answer:0 }),
        () => ({ type:'mcq', question:'Which keyword tells SQL which table to query?', options:['FROM','WHERE','SELECT','INTO'], answer:0 }),
        () => ({ type:'fix', question:'Fix this broken query:', broken:'SELCT name FORM planets;', solution:'SELECT name FROM planets;' }),
        () => ({ type:'fix', question:'Fix this query (missing keyword):', broken:'name, type planets;', solution:'SELECT name, type FROM planets;' }),
    ]
},

// --- Lesson 2: WHERE Clauses (RPG) ---
{
    id: 2,
    title: 'WHERE Clauses',
    theme: 'RPG \u2014 heroes, classes, levels',
    tutorial: `<h3>Filtering with WHERE</h3>
<p>The <code>WHERE</code> clause filters rows based on conditions:</p>
<div class="sql-example">SELECT * FROM heroes WHERE class = 'Warrior';</div>
<h3>Comparison Operators</h3>
<p><code>=</code>, <code>!=</code>, <code>&lt;</code>, <code>&gt;</code>, <code>&lt;=</code>, <code>&gt;=</code></p>
<div class="sql-example">SELECT name, level FROM heroes WHERE level > 10;</div>
<h3>Combining Conditions</h3>
<p>Use <code>AND</code> and <code>OR</code>:</p>
<div class="sql-example">SELECT * FROM heroes WHERE class = 'Mage' AND level >= 15;</div>
<div class="sql-example">SELECT * FROM heroes WHERE hp < 100 OR defense > 50;</div>
<div class="note">Text values must be in single quotes: <code>'Warrior'</code>. Numbers don't need quotes.</div>`,
    schema: `CREATE TABLE heroes (name TEXT, class TEXT, level INT, hp INT, attack INT, defense INT, is_alive INT);
INSERT INTO heroes VALUES ('Aldric','Warrior',15,320,45,60,1),('Luna','Mage',22,180,70,25,1),('Shadow','Rogue',18,200,55,30,1),('Theron','Warrior',8,250,35,50,1),('Ivy','Healer',20,150,20,35,1),('Grimm','Warrior',25,400,60,70,1),('Sera','Mage',12,160,50,20,1),('Dax','Rogue',5,120,30,15,0),('Mira','Healer',16,175,25,40,1),('Bolt','Mage',30,220,80,30,1);`,
    schemaDisplay: 'heroes(name TEXT, class TEXT, level INT, hp INT, attack INT, defense INT, is_alive INT)',
    defaultQuery: "SELECT * FROM heroes;",
    exercises: [
        { instruction: "Select all Warriors (class = 'Warrior').", hint: "Use WHERE class = 'Warrior'", solution: "SELECT * FROM heroes WHERE class = 'Warrior'" },
        { instruction: 'Find all heroes with level greater than 15.', hint: 'Use WHERE level > 15', solution: 'SELECT * FROM heroes WHERE level > 15' },
        { instruction: "Find all living Mages (class = 'Mage' AND is_alive = 1).", hint: 'Combine conditions with AND', solution: "SELECT * FROM heroes WHERE class = 'Mage' AND is_alive = 1" },
        { instruction: 'Find heroes with attack > 40 OR defense > 50.', hint: 'Use OR to match either condition', solution: 'SELECT * FROM heroes WHERE attack > 40 OR defense > 50' }
    ],
    tests: [
        () => { const cls = pick(['Warrior','Mage','Rogue','Healer']); return { type:'write', question:`Select all heroes whose class is '${cls}'.`, solution:`SELECT * FROM heroes WHERE class = '${cls}'` }; },
        () => { const lvl = randInt(8,20); return { type:'write', question:`Find all heroes with level greater than ${lvl}.`, solution:`SELECT * FROM heroes WHERE level > ${lvl}` }; },
        () => { const hp = randInt(150,300); return { type:'write', question:`Select names of heroes with hp less than ${hp}.`, solution:`SELECT name FROM heroes WHERE hp < ${hp}` }; },
        () => ({ type:'mcq', question:'What does <code>AND</code> do in a WHERE clause?', options:['Both conditions must be true','Either condition can be true','Negates the condition','Sorts the results'], answer:0 }),
        () => ({ type:'mcq', question:"What does <code>WHERE level != 10</code> mean?", options:['Level is not equal to 10','Level is 10','Level is null','Syntax error'], answer:0 }),
        () => ({ type:'fix', question:'Fix this query:', broken:"SELECT * FROM heroes WHERE class = Warrior;", solution:"SELECT * FROM heroes WHERE class = 'Warrior';" }),
        () => ({ type:'fix', question:'Fix this query:', broken:"SELECT * FROM heroes level > 10;", solution:"SELECT * FROM heroes WHERE level > 10;" }),
    ]
},

// --- Lesson 3: ORDER BY (Music) ---
{
    id: 3,
    title: 'ORDER BY',
    theme: 'Music \u2014 songs, artists, years',
    tutorial: `<h3>Sorting Results</h3>
<p><code>ORDER BY</code> sorts your query results by one or more columns.</p>
<div class="sql-example">SELECT * FROM songs ORDER BY year;</div>
<h3>Ascending & Descending</h3>
<p><code>ASC</code> (default) sorts low\u2192high. <code>DESC</code> sorts high\u2192low:</p>
<div class="sql-example">SELECT * FROM songs ORDER BY streams_millions DESC;</div>
<h3>Multiple Sort Columns</h3>
<p>Sort by genre first, then by year within each genre:</p>
<div class="sql-example">SELECT * FROM songs ORDER BY genre, year DESC;</div>
<div class="note">ORDER BY goes after WHERE (if used). It's always near the end of your query.</div>`,
    schema: `CREATE TABLE songs (title TEXT, artist TEXT, genre TEXT, duration_sec INT, year INT, streams_millions INT);
INSERT INTO songs VALUES ('Midnight Run','Nova','Pop',210,2021,850),('Thunder Road','Axel Stone','Rock',245,2019,420),('Quiet Storm','Luna Bay','R&B',198,2022,630),('Binary Dreams','Synthex','Electronic',183,2020,510),('Broken Crown','The Willows','Rock',276,2018,390),('Sunlit','Mara Gold','Pop',195,2023,920),('Deep Blue','Oceanic','Electronic',222,2021,480),('Wildfire','Axel Stone','Rock',258,2022,550),('Paper Moon','Luna Bay','R&B',201,2020,410),('Neon Lights','Synthex','Electronic',190,2023,700);`,
    schemaDisplay: 'songs(title TEXT, artist TEXT, genre TEXT, duration_sec INT, year INT, streams_millions INT)',
    defaultQuery: 'SELECT * FROM songs;',
    exercises: [
        { instruction: 'Select all songs ordered by year (oldest first).', hint: 'Use ORDER BY year or ORDER BY year ASC', solution: 'SELECT * FROM songs ORDER BY year ASC' },
        { instruction: 'Select all songs ordered by streams descending (most popular first).', hint: 'Use ORDER BY column DESC', solution: 'SELECT * FROM songs ORDER BY streams_millions DESC' },
        { instruction: 'Select title and genre, ordered by genre then by title.', hint: 'ORDER BY genre, title', solution: 'SELECT title, genre FROM songs ORDER BY genre, title' }
    ],
    tests: [
        () => { const col = pick(['year','duration_sec','streams_millions']); const dir = pick(['ASC','DESC']); return { type:'write', question:`Select all songs ordered by <code>${col}</code> ${dir === 'DESC' ? 'descending' : 'ascending'}.`, solution:`SELECT * FROM songs ORDER BY ${col} ${dir}` }; },
        () => { const col = pick(['title','artist']); return { type:'write', question:`Select title and artist, ordered alphabetically by <code>${col}</code>.`, solution:`SELECT title, artist FROM songs ORDER BY ${col} ASC` }; },
        () => ({ type:'mcq', question:'What is the default sort order for ORDER BY?', options:['Ascending (ASC)','Descending (DESC)','Random','Alphabetical only'], answer:0 }),
        () => ({ type:'mcq', question:'Where does ORDER BY go in a query?', options:['After WHERE and before LIMIT','Before FROM','Before WHERE','Inside SELECT'], answer:0 }),
        () => ({ type:'fix', question:'Fix this query:', broken:'SELECT * FROM songs ORDERBY year;', solution:'SELECT * FROM songs ORDER BY year;' }),
        () => ({ type:'fix', question:'Fix this query:', broken:'SELECT * FROM songs ORDER year DESC;', solution:'SELECT * FROM songs ORDER BY year DESC;' }),
    ]
},

// --- Lesson 4: LIMIT & OFFSET (Movies) ---
{
    id: 4,
    title: 'LIMIT & OFFSET',
    theme: 'Movies \u2014 titles, ratings, box office',
    tutorial: `<h3>Limiting Results</h3>
<p><code>LIMIT</code> restricts how many rows are returned:</p>
<div class="sql-example">SELECT * FROM movies LIMIT 5;</div>
<h3>Skipping Rows with OFFSET</h3>
<p><code>OFFSET</code> skips a number of rows before returning results:</p>
<div class="sql-example">SELECT * FROM movies LIMIT 5 OFFSET 5;</div>
<p>This skips the first 5 rows and returns the next 5\u2014like page 2!</p>
<h3>Combining with ORDER BY</h3>
<p>Get the top 3 highest-rated movies:</p>
<div class="sql-example">SELECT * FROM movies ORDER BY rating DESC LIMIT 3;</div>
<div class="note">LIMIT and OFFSET are great for pagination: page N = LIMIT size OFFSET (N-1)*size.</div>`,
    schema: `CREATE TABLE movies (title TEXT, genre TEXT, year INT, rating REAL, box_office_millions INT);
INSERT INTO movies VALUES ('Star Odyssey','Sci-Fi',2020,8.4,650),('The Last Dance','Drama',2019,7.9,320),('Neon City','Action',2022,7.2,480),('Whisper','Horror',2021,6.8,120),('Golden Age','Drama',2023,8.7,890),('Pixel Wars','Sci-Fi',2018,7.5,410),('Crimson Tide','Action',2021,6.5,290),('Moonfall','Sci-Fi',2022,8.1,530),('The Garden','Drama',2020,7.8,250),('Velocity','Action',2023,7.0,380);`,
    schemaDisplay: 'movies(title TEXT, genre TEXT, year INT, rating REAL, box_office_millions INT)',
    defaultQuery: 'SELECT * FROM movies;',
    exercises: [
        { instruction: 'Select the first 5 movies.', hint: 'Use LIMIT 5', solution: 'SELECT * FROM movies LIMIT 5' },
        { instruction: 'Select the top 3 movies by rating (highest first).', hint: 'ORDER BY rating DESC LIMIT 3', solution: 'SELECT * FROM movies ORDER BY rating DESC LIMIT 3' },
        { instruction: 'Skip the first 3 movies and show the next 4.', hint: 'Use LIMIT 4 OFFSET 3', solution: 'SELECT * FROM movies LIMIT 4 OFFSET 3' }
    ],
    tests: [
        () => { const n = randInt(2,6); return { type:'write', question:`Select the first ${n} movies from the table.`, solution:`SELECT * FROM movies LIMIT ${n}` }; },
        () => { const n = randInt(2,4); return { type:'write', question:`Select the top ${n} movies by box_office_millions (highest first).`, solution:`SELECT * FROM movies ORDER BY box_office_millions DESC LIMIT ${n}` }; },
        () => { const off = randInt(2,5); return { type:'write', question:`Skip the first ${off} movies and return the next 3.`, solution:`SELECT * FROM movies LIMIT 3 OFFSET ${off}` }; },
        () => ({ type:'mcq', question:'What does <code>LIMIT 5 OFFSET 10</code> return?', options:['Rows 11 through 15','Rows 1 through 5','Rows 5 through 10','Rows 10 through 15'], answer:0 }),
        () => ({ type:'mcq', question:'Where does LIMIT go in a SQL query?', options:['At the end, after ORDER BY','Before FROM','Before WHERE','Before ORDER BY'], answer:0 }),
        () => ({ type:'fix', question:'Fix this query:', broken:'SELECT * FROM movies LIMIT 3 OFFSET;', solution:'SELECT * FROM movies LIMIT 3 OFFSET 0;' }),
    ]
},

// --- Lesson 5: DISTINCT (Pet Shelter) ---
{
    id: 5,
    title: 'DISTINCT',
    theme: 'Pet Shelter \u2014 animals, breeds, ages',
    tutorial: `<h3>Removing Duplicates</h3>
<p><code>DISTINCT</code> removes duplicate values from your results:</p>
<div class="sql-example">SELECT DISTINCT species FROM animals;</div>
<h3>Why Duplicates Happen</h3>
<p>A shelter has many cats and dogs. Selecting <code>species</code> without DISTINCT shows "Cat" and "Dog" repeated for every row.</p>
<h3>DISTINCT with Multiple Columns</h3>
<p>Finds unique combinations:</p>
<div class="sql-example">SELECT DISTINCT species, breed FROM animals;</div>
<h3>COUNT with DISTINCT</h3>
<p>Count how many unique values exist:</p>
<div class="sql-example">SELECT COUNT(DISTINCT breed) FROM animals;</div>
<div class="note">DISTINCT applies to the entire row of selected columns, not just the first one.</div>`,
    schema: `CREATE TABLE animals (name TEXT, species TEXT, breed TEXT, age INT, weight_kg REAL, adopted INT);
INSERT INTO animals VALUES ('Bella','Dog','Labrador',3,28.5,1),('Max','Dog','German Shepherd',5,35.0,0),('Whiskers','Cat','Tabby',2,4.5,1),('Luna','Cat','Siamese',4,3.8,0),('Charlie','Dog','Labrador',1,22.0,0),('Mittens','Cat','Tabby',6,5.2,1),('Rocky','Dog','Bulldog',4,25.0,0),('Shadow','Cat','Persian',3,4.0,0),('Daisy','Dog','Labrador',2,24.0,1),('Cleo','Cat','Siamese',1,3.2,0);`,
    schemaDisplay: 'animals(name TEXT, species TEXT, breed TEXT, age INT, weight_kg REAL, adopted INT)',
    defaultQuery: 'SELECT * FROM animals;',
    exercises: [
        { instruction: 'Select all unique species from the animals table.', hint: 'SELECT DISTINCT species FROM animals', solution: 'SELECT DISTINCT species FROM animals' },
        { instruction: 'Select all unique breed values.', hint: 'Use DISTINCT with the breed column', solution: 'SELECT DISTINCT breed FROM animals' },
        { instruction: 'Count how many distinct breeds there are.', hint: 'Use COUNT(DISTINCT breed)', solution: 'SELECT COUNT(DISTINCT breed) FROM animals' }
    ],
    tests: [
        () => { const col = pick(['species','breed']); return { type:'write', question:`Select all unique <code>${col}</code> values from the animals table.`, solution:`SELECT DISTINCT ${col} FROM animals` }; },
        () => ({ type:'write', question:'Select unique combinations of species and breed.', solution:'SELECT DISTINCT species, breed FROM animals' }),
        () => { const col = pick(['species','breed']); return { type:'write', question:`Count the number of distinct <code>${col}</code> values.`, solution:`SELECT COUNT(DISTINCT ${col}) FROM animals` }; },
        () => ({ type:'mcq', question:'What does <code>DISTINCT</code> do?', options:['Removes duplicate rows from results','Sorts the results','Limits the number of rows','Filters rows by condition'], answer:0 }),
        () => ({ type:'mcq', question:'<code>SELECT DISTINCT species, breed</code> returns unique...', options:['Combinations of species and breed','Species only','Breeds only','All rows'], answer:0 }),
        () => ({ type:'fix', question:'Fix this query:', broken:'SELECT DISTICT species FROM animals;', solution:'SELECT DISTINCT species FROM animals;' }),
    ]
},

// --- Lesson 6: Aggregate Functions (Sports) ---
{
    id: 6,
    title: 'Aggregate Functions',
    theme: 'Sports \u2014 teams, players, scores',
    tutorial: `<h3>Aggregate Functions</h3>
<p>Aggregates compute a single value from many rows:</p>
<p><code>COUNT(*)</code> \u2014 number of rows<br><code>SUM(col)</code> \u2014 total<br><code>AVG(col)</code> \u2014 average<br><code>MIN(col)</code> / <code>MAX(col)</code> \u2014 smallest / largest</p>
<div class="sql-example">SELECT COUNT(*) FROM players;</div>
<div class="sql-example">SELECT AVG(goals) FROM players;</div>
<h3>With WHERE</h3>
<p>Aggregate only matching rows:</p>
<div class="sql-example">SELECT SUM(goals) FROM players WHERE team = 'Wolves';</div>
<div class="note">Aggregates return one row. You can select multiple aggregates at once: <code>SELECT MIN(goals), MAX(goals) FROM players;</code></div>`,
    schema: `CREATE TABLE players (name TEXT, team TEXT, position TEXT, goals INT, assists INT, salary INT);
INSERT INTO players VALUES ('Kane','Wolves','Forward',22,8,90000),('Silva','Eagles','Midfielder',12,15,75000),('Bruno','Wolves','Midfielder',18,20,85000),('Lee','Titans','Forward',25,5,95000),('Chen','Eagles','Forward',14,9,70000),('Garcia','Titans','Defender',3,7,60000),('Rossi','Wolves','Defender',5,4,65000),('Park','Eagles','Midfielder',10,12,72000),('Torres','Titans','Forward',20,11,88000),('Smith','Wolves','Forward',16,6,78000),('Ali','Eagles','Defender',2,8,55000),('Jones','Titans','Midfielder',8,14,68000);`,
    schemaDisplay: 'players(name TEXT, team TEXT, position TEXT, goals INT, assists INT, salary INT)',
    defaultQuery: 'SELECT * FROM players;',
    exercises: [
        { instruction: 'Count the total number of players.', hint: 'Use COUNT(*)', solution: 'SELECT COUNT(*) FROM players' },
        { instruction: 'Find the total goals scored by all players.', hint: 'Use SUM(goals)', solution: 'SELECT SUM(goals) FROM players' },
        { instruction: 'Find the highest salary among all players.', hint: 'Use MAX(salary)', solution: 'SELECT MAX(salary) FROM players' },
        { instruction: "Find the average goals for the 'Wolves' team.", hint: "Use AVG(goals) with WHERE team = 'Wolves'", solution: "SELECT AVG(goals) FROM players WHERE team = 'Wolves'" }
    ],
    tests: [
        () => { const fn = pick(['COUNT','SUM','AVG','MIN','MAX']); const col = fn === 'COUNT' ? '*' : pick(['goals','assists','salary']); return { type:'write', question:`Use <code>${fn}(${col})</code> on the players table.`, solution:`SELECT ${fn}(${col}) FROM players` }; },
        () => { const team = pick(['Wolves','Eagles','Titans']); return { type:'write', question:`Find the total goals scored by the '${team}' team.`, solution:`SELECT SUM(goals) FROM players WHERE team = '${team}'` }; },
        () => { const fn = pick(['MIN','MAX']); return { type:'write', question:`Find the ${fn === 'MIN' ? 'lowest' : 'highest'} salary.`, solution:`SELECT ${fn}(salary) FROM players` }; },
        () => ({ type:'mcq', question:'What does <code>COUNT(*)</code> count?', options:['All rows including NULLs','Only non-NULL values','Only distinct values','Only numeric values'], answer:0 }),
        () => ({ type:'mcq', question:'What does <code>AVG(goals)</code> return?', options:['The average of the goals column','The total goals','The number of players with goals','The median goals'], answer:0 }),
        () => ({ type:'fix', question:'Fix this query:', broken:'SELECT AVERAGE(goals) FROM players;', solution:'SELECT AVG(goals) FROM players;' }),
        () => ({ type:'fix', question:'Fix this query:', broken:'SELECT MAX salary FROM players;', solution:'SELECT MAX(salary) FROM players;' }),
    ]
},

// --- Lesson 7: GROUP BY (Bookstore) ---
{
    id: 7,
    title: 'GROUP BY',
    theme: 'Bookstore \u2014 books, genres, sales',
    tutorial: `<h3>Grouping Results</h3>
<p><code>GROUP BY</code> groups rows that share a value, letting you run aggregates per group:</p>
<div class="sql-example">SELECT genre, COUNT(*) FROM books GROUP BY genre;</div>
<h3>Aggregates per Group</h3>
<p>Get average price by genre:</p>
<div class="sql-example">SELECT genre, AVG(price) FROM books GROUP BY genre;</div>
<h3>Multiple Group Columns</h3>
<div class="sql-example">SELECT genre, author, COUNT(*) FROM books GROUP BY genre, author;</div>
<div class="note">Every column in SELECT (that isn't an aggregate) must appear in GROUP BY.</div>`,
    schema: `CREATE TABLE books (title TEXT, author TEXT, genre TEXT, pages INT, price REAL, copies_sold INT);
INSERT INTO books VALUES ('Starfall','Nyx','Sci-Fi',320,14.99,45000),('The Deep','Marina','Mystery',280,12.99,32000),('Iron Bloom','Nyx','Sci-Fi',410,16.99,38000),('Red Cloak','Elena','Fantasy',350,13.99,52000),('Still Water','Marina','Mystery',240,11.99,28000),('Sky Realm','Tai','Fantasy',390,15.99,61000),('Neuron','Nyx','Sci-Fi',290,13.99,41000),('The Signal','Dev','Non-Fiction',200,9.99,22000),('Wild Hearts','Elena','Romance',310,12.99,48000),('Code Blue','Dev','Non-Fiction',180,10.99,19000),('Dark Forest','Tai','Fantasy',420,17.99,55000),('Love Note','Elena','Romance',260,11.99,37000);`,
    schemaDisplay: 'books(title TEXT, author TEXT, genre TEXT, pages INT, price REAL, copies_sold INT)',
    defaultQuery: 'SELECT * FROM books;',
    exercises: [
        { instruction: 'Count the number of books in each genre.', hint: 'SELECT genre, COUNT(*) FROM books GROUP BY genre', solution: 'SELECT genre, COUNT(*) FROM books GROUP BY genre' },
        { instruction: 'Find the average price per genre.', hint: 'Use AVG(price) with GROUP BY genre', solution: 'SELECT genre, AVG(price) FROM books GROUP BY genre' },
        { instruction: 'Find total copies sold per author.', hint: 'SUM(copies_sold) GROUP BY author', solution: 'SELECT author, SUM(copies_sold) FROM books GROUP BY author' }
    ],
    tests: [
        () => { const agg = pick(['COUNT(*)','AVG(price)','SUM(copies_sold)','MAX(pages)']); const label = { 'COUNT(*)':'count of books','AVG(price)':'average price','SUM(copies_sold)':'total copies sold','MAX(pages)':'longest book (pages)' }[agg]; return { type:'write', question:`Find the ${label} per genre.`, solution:`SELECT genre, ${agg} FROM books GROUP BY genre` }; },
        () => ({ type:'write', question:'Find the total copies sold per author.', solution:'SELECT author, SUM(copies_sold) FROM books GROUP BY author' }),
        () => ({ type:'write', question:'Count how many books each author has written.', solution:'SELECT author, COUNT(*) FROM books GROUP BY author' }),
        () => ({ type:'mcq', question:'What does GROUP BY do?', options:['Groups rows with same values so aggregates work per group','Sorts the results','Filters rows','Joins two tables'], answer:0 }),
        () => ({ type:'mcq', question:'If you SELECT genre, COUNT(*) but forget GROUP BY genre, what happens?', options:['An error or unexpected single-row result','It works fine','It returns duplicates','It sorts by genre'], answer:0 }),
        () => ({ type:'fix', question:'Fix this query:', broken:'SELECT genre COUNT(*) FROM books GROUP BY genre;', solution:'SELECT genre, COUNT(*) FROM books GROUP BY genre;' }),
    ]
},

// --- Lesson 8: HAVING (Restaurant) ---
{
    id: 8,
    title: 'HAVING',
    theme: 'Restaurant \u2014 menu, calories, prices',
    tutorial: `<h3>Filtering Groups</h3>
<p><code>HAVING</code> filters groups after <code>GROUP BY</code>, like <code>WHERE</code> for aggregates:</p>
<div class="sql-example">SELECT category, AVG(price) FROM menu_items GROUP BY category HAVING AVG(price) > 10;</div>
<h3>WHERE vs HAVING</h3>
<p><code>WHERE</code> filters individual rows <em>before</em> grouping. <code>HAVING</code> filters groups <em>after</em> aggregation.</p>
<div class="sql-example">SELECT category, COUNT(*) FROM menu_items WHERE is_vegetarian = 1 GROUP BY category HAVING COUNT(*) >= 2;</div>
<div class="note">Rule of thumb: if the condition uses an aggregate function (COUNT, SUM, AVG, etc.), use HAVING. Otherwise, use WHERE.</div>`,
    schema: `CREATE TABLE menu_items (name TEXT, category TEXT, price REAL, calories INT, is_vegetarian INT, prep_time_min INT);
INSERT INTO menu_items VALUES ('Caesar Salad','Appetizer',8.99,350,1,5),('Bruschetta','Appetizer',7.99,280,1,8),('Grilled Salmon','Main',18.99,520,0,15),('Mushroom Risotto','Main',15.99,480,1,20),('Steak','Main',24.99,700,0,18),('Chicken Wrap','Main',12.99,450,0,10),('Tiramisu','Dessert',9.99,420,1,5),('Chocolate Cake','Dessert',8.99,550,1,3),('Lemonade','Drink',3.99,120,1,2),('Espresso','Drink',2.99,5,1,1),('Iced Tea','Drink',3.49,80,1,2),('Garlic Bread','Appetizer',5.99,310,1,6);`,
    schemaDisplay: 'menu_items(name TEXT, category TEXT, price REAL, calories INT, is_vegetarian INT, prep_time_min INT)',
    defaultQuery: 'SELECT * FROM menu_items;',
    exercises: [
        { instruction: 'Find categories where the average price is greater than 8.', hint: 'GROUP BY category HAVING AVG(price) > 8', solution: 'SELECT category, AVG(price) FROM menu_items GROUP BY category HAVING AVG(price) > 8' },
        { instruction: 'Find categories with more than 2 items.', hint: 'GROUP BY category HAVING COUNT(*) > 2', solution: 'SELECT category, COUNT(*) FROM menu_items GROUP BY category HAVING COUNT(*) > 2' },
        { instruction: 'Find categories where total calories exceed 800.', hint: 'SUM(calories) > 800', solution: 'SELECT category, SUM(calories) FROM menu_items GROUP BY category HAVING SUM(calories) > 800' }
    ],
    tests: [
        () => { const thresh = pick([7,8,9,10]); return { type:'write', question:`Find categories where average price is greater than ${thresh}.`, solution:`SELECT category, AVG(price) FROM menu_items GROUP BY category HAVING AVG(price) > ${thresh}` }; },
        () => { const n = pick([2,3]); return { type:'write', question:`Find categories with more than ${n} items.`, solution:`SELECT category, COUNT(*) FROM menu_items GROUP BY category HAVING COUNT(*) > ${n}` }; },
        () => ({ type:'mcq', question:'What is the difference between WHERE and HAVING?', options:['WHERE filters rows before grouping; HAVING filters after','They are the same','WHERE is for numbers, HAVING for text','HAVING comes before GROUP BY'], answer:0 }),
        () => ({ type:'mcq', question:'Can you use HAVING without GROUP BY?', options:['Technically yes, but it rarely makes sense','No, it causes an error','Yes, it works like WHERE','Only with COUNT'], answer:0 }),
        () => ({ type:'fix', question:'Fix this query (uses WHERE instead of HAVING):', broken:'SELECT category, AVG(price) FROM menu_items GROUP BY category WHERE AVG(price) > 10;', solution:'SELECT category, AVG(price) FROM menu_items GROUP BY category HAVING AVG(price) > 10;' }),
        () => ({ type:'fix', question:'Fix this query:', broken:'SELECT category, COUNT(*) FROM menu_items GROUP BY category HAVING > 2;', solution:'SELECT category, COUNT(*) FROM menu_items GROUP BY category HAVING COUNT(*) > 2;' }),
    ]
},

// --- Lesson 9: INSERT INTO (Zoo) ---
{
    id: 9,
    title: 'INSERT INTO',
    theme: 'Zoo \u2014 animals, exhibits, habitats',
    tutorial: `<h3>Adding Data</h3>
<p><code>INSERT INTO</code> adds new rows to a table:</p>
<div class="sql-example">INSERT INTO animals VALUES (9, 'Coco', 'Parrot', 2, 1.2, 0);</div>
<h3>Specifying Columns</h3>
<p>You can list which columns to fill (others get NULL or defaults):</p>
<div class="sql-example">INSERT INTO animals (id, name, species, exhibit_id) VALUES (9, 'Coco', 'Parrot', 2);</div>
<h3>Multiple Rows</h3>
<div class="sql-example">INSERT INTO animals VALUES (9,'Coco','Parrot',2,1.2,0), (10,'Rex','Iguana',1,3.5,0);</div>
<div class="note">The number of values must match the number of columns (or specified columns).</div>`,
    schema: `CREATE TABLE exhibits (id INT, name TEXT, biome TEXT);
CREATE TABLE animals (id INT, name TEXT, species TEXT, exhibit_id INT, weight_kg REAL, endangered INT);
INSERT INTO exhibits VALUES (1,'Tropical House','Tropical'),(2,'African Plains','Savanna'),(3,'Arctic Zone','Arctic');
INSERT INTO animals VALUES (1,'Ellie','Elephant',2,4500.0,1),(2,'Leo','Lion',2,190.0,0),(3,'Penny','Penguin',3,5.5,0),(4,'Kira','Tiger',1,220.0,1),(5,'Splash','Seal',3,85.0,0),(6,'Mango','Toucan',1,0.6,0),(7,'Frost','Polar Bear',3,450.0,1),(8,'Zara','Zebra',2,350.0,0);`,
    schemaDisplay: 'exhibits(id INT, name TEXT, biome TEXT)\nanimals(id INT, name TEXT, species TEXT, exhibit_id INT, weight_kg REAL, endangered INT)',
    defaultQuery: 'SELECT * FROM animals;',
    exercises: [
        { instruction: "Insert a new animal: id=9, name='Coco', species='Parrot', exhibit_id=1, weight_kg=1.2, endangered=0.", hint: "INSERT INTO animals VALUES (9,'Coco','Parrot',1,1.2,0)", solution: "INSERT INTO animals VALUES (9,'Coco','Parrot',1,1.2,0)", verify: "SELECT * FROM animals WHERE id = 9" },
        { instruction: "Insert two animals at once: (10,'Rex','Iguana',1,3.5,0) and (11,'Nala','Giraffe',2,800.0,1).", hint: 'Use multiple value tuples separated by commas', solution: "INSERT INTO animals VALUES (10,'Rex','Iguana',1,3.5,0),(11,'Nala','Giraffe',2,800.0,1)", verify: "SELECT * FROM animals WHERE id IN (10,11) ORDER BY id" },
        { instruction: "Insert a new exhibit: id=4, name='Nocturnal Cave', biome='Underground'.", hint: "INSERT INTO exhibits VALUES (...)", solution: "INSERT INTO exhibits VALUES (4,'Nocturnal Cave','Underground')", verify: "SELECT * FROM exhibits WHERE id = 4" }
    ],
    tests: [
        () => { const names = ['Pip','Boo','Rex','Sunny','Dash']; const species = ['Gecko','Frog','Owl','Snake','Rabbit']; const i = randInt(0,4); return { type:'write', question:`Insert a new animal: id=9, name='${names[i]}', species='${species[i]}', exhibit_id=1, weight_kg=2.0, endangered=0.`, solution:`INSERT INTO animals VALUES (9,'${names[i]}','${species[i]}',1,2.0,0)`, verify:"SELECT * FROM animals WHERE id = 9" }; },
        () => ({ type:'mcq', question:'What happens if you INSERT fewer values than columns?', options:['Error: column count mismatch','Missing columns get NULL','It works fine','Extra columns are ignored'], answer:0 }),
        () => ({ type:'mcq', question:'Which is correct syntax?', options:["INSERT INTO t VALUES (1, 'a')","INSERT VALUES INTO t (1, 'a')","INSERT t INTO VALUES (1, 'a')","INTO INSERT t VALUES (1, 'a')"], answer:0 }),
        () => ({ type:'fix', question:'Fix this query:', broken:"INSERT INTO animals VALUE (9,'Pip','Gecko',1,2.0,0);", solution:"INSERT INTO animals VALUES (9,'Pip','Gecko',1,2.0,0);" }),
        () => ({ type:'fix', question:'Fix this query:', broken:"INSERT animals VALUES (9,'Pip','Gecko',1,2.0,0);", solution:"INSERT INTO animals VALUES (9,'Pip','Gecko',1,2.0,0);" }),
        () => { const n = pick(['Socks','Blue','Tank']); return { type:'write', question:`Insert exhibit id=4, name='${n} Den', biome='Forest'.`, solution:`INSERT INTO exhibits VALUES (4,'${n} Den','Forest')`, verify:"SELECT * FROM exhibits WHERE id = 4" }; },
    ]
},

// --- Lesson 10: UPDATE (Video Games) ---
{
    id: 10,
    title: 'UPDATE',
    theme: 'Video Games \u2014 inventory, stats, prices',
    tutorial: `<h3>Modifying Data</h3>
<p><code>UPDATE</code> changes existing rows:</p>
<div class="sql-example">UPDATE games SET price = 29.99 WHERE title = 'Pixel Quest';</div>
<h3>Multiple Columns</h3>
<div class="sql-example">UPDATE games SET price = 19.99, on_sale = 1 WHERE genre = 'RPG';</div>
<h3>Danger: UPDATE without WHERE</h3>
<p>Without <code>WHERE</code>, ALL rows get updated!</p>
<div class="sql-example">UPDATE games SET on_sale = 0; -- affects every row!</div>
<div class="note">Always double-check your WHERE clause before running an UPDATE. There's no undo!</div>`,
    schema: `CREATE TABLE games (id INT, title TEXT, genre TEXT, price REAL, rating REAL, copies_sold INT, on_sale INT);
INSERT INTO games VALUES (1,'Pixel Quest','RPG',39.99,8.5,120000,0),(2,'Speed Racer','Racing',29.99,7.2,85000,1),(3,'Dark Realms','RPG',49.99,9.1,200000,0),(4,'Puzzle Box','Puzzle',9.99,8.0,150000,0),(5,'Star Fleet','Strategy',34.99,7.8,95000,1),(6,'Ninja Storm','Action',24.99,6.9,70000,0),(7,'Farm Life','Simulation',19.99,8.3,180000,0),(8,'Cyber Run','Action',44.99,7.5,110000,0),(9,'Word Master','Puzzle',4.99,7.0,60000,1),(10,'Galaxy Wars','Strategy',39.99,8.8,160000,0);`,
    schemaDisplay: 'games(id INT, title TEXT, genre TEXT, price REAL, rating REAL, copies_sold INT, on_sale INT)',
    defaultQuery: 'SELECT * FROM games;',
    exercises: [
        { instruction: "Set the price of 'Pixel Quest' to 29.99.", hint: "UPDATE games SET price = 29.99 WHERE title = 'Pixel Quest'", solution: "UPDATE games SET price = 29.99 WHERE title = 'Pixel Quest'", verify: "SELECT price FROM games WHERE title = 'Pixel Quest'" },
        { instruction: "Put all RPG games on sale (set on_sale = 1).", hint: "UPDATE games SET on_sale = 1 WHERE genre = 'RPG'", solution: "UPDATE games SET on_sale = 1 WHERE genre = 'RPG'", verify: "SELECT title, on_sale FROM games WHERE genre = 'RPG' ORDER BY title" },
        { instruction: "Give all games rated above 8.0 a 10% price reduction.", hint: "SET price = price * 0.9 WHERE rating > 8.0", solution: "UPDATE games SET price = price * 0.9 WHERE rating > 8.0", verify: "SELECT title, price FROM games WHERE rating > 8.0 ORDER BY title" }
    ],
    tests: [
        () => { const game = pick(['Pixel Quest','Speed Racer','Dark Realms','Puzzle Box','Star Fleet']); const price = pick([19.99,24.99,14.99]); return { type:'write', question:`Set the price of '${game}' to ${price}.`, solution:`UPDATE games SET price = ${price} WHERE title = '${game}'`, verify:`SELECT price FROM games WHERE title = '${game}'` }; },
        () => { const genre = pick(['RPG','Action','Puzzle','Strategy']); return { type:'write', question:`Put all ${genre} games on sale (set on_sale = 1).`, solution:`UPDATE games SET on_sale = 1 WHERE genre = '${genre}'`, verify:`SELECT title, on_sale FROM games WHERE genre = '${genre}' ORDER BY title` }; },
        () => ({ type:'mcq', question:'What happens if you run UPDATE without a WHERE clause?', options:['Every row in the table is updated','Nothing happens','Only the first row is updated','An error occurs'], answer:0 }),
        () => ({ type:'mcq', question:'Can you update multiple columns in one UPDATE?', options:['Yes, separate them with commas in SET','No, you need separate UPDATE statements','Only with a subquery','Only for numeric columns'], answer:0 }),
        () => ({ type:'fix', question:'Fix this query:', broken:"UPDATE games price = 19.99 WHERE id = 1;", solution:"UPDATE games SET price = 19.99 WHERE id = 1;" }),
        () => ({ type:'fix', question:'Fix this query:', broken:"UPDATE SET games on_sale = 1 WHERE genre = 'RPG';", solution:"UPDATE games SET on_sale = 1 WHERE genre = 'RPG';" }),
    ]
},

// --- Lesson 11: DELETE (Email) ---
{
    id: 11,
    title: 'DELETE',
    theme: 'Email Inbox \u2014 managing messages',
    tutorial: `<h3>Removing Rows</h3>
<p><code>DELETE FROM</code> removes rows that match a condition:</p>
<div class="sql-example">DELETE FROM emails WHERE is_spam = 1;</div>
<h3>Delete with Multiple Conditions</h3>
<div class="sql-example">DELETE FROM emails WHERE is_read = 1 AND sender = 'newsletter@spam.com';</div>
<h3>Danger: DELETE without WHERE</h3>
<p><code>DELETE FROM emails;</code> deletes ALL rows. Be careful!</p>
<div class="note">Tip: Run a SELECT with the same WHERE first to preview which rows will be deleted.</div>`,
    schema: `CREATE TABLE emails (id INT, sender TEXT, subject TEXT, body TEXT, is_read INT, is_spam INT, received_date TEXT);
INSERT INTO emails VALUES (1,'alice@mail.com','Meeting Tomorrow','Let us meet at 3pm.',1,0,'2024-01-15'),(2,'promo@deals.com','50% OFF!!!','Buy now and save!',0,1,'2024-01-14'),(3,'bob@work.com','Project Update','The deadline moved.',1,0,'2024-01-13'),(4,'spam@fake.com','You Won!','Claim your prize!',0,1,'2024-01-12'),(5,'alice@mail.com','Re: Meeting','Confirmed.',1,0,'2024-01-15'),(6,'news@daily.com','Daily Digest','Top stories today.',0,0,'2024-01-14'),(7,'spam@junk.com','Free Gift','Click here now!',0,1,'2024-01-11'),(8,'bob@work.com','Lunch?','Want to grab lunch?',1,0,'2024-01-15'),(9,'promo@deals.com','Last Chance!','Sale ends tonight!',1,1,'2024-01-10'),(10,'carol@mail.com','Photos','Here are the photos.',0,0,'2024-01-13'),(11,'spam@fake.com','Urgent!!!','Act now!',0,1,'2024-01-09'),(12,'alice@mail.com','Weekend Plans','BBQ on Saturday?',0,0,'2024-01-16');`,
    schemaDisplay: 'emails(id INT, sender TEXT, subject TEXT, body TEXT, is_read INT, is_spam INT, received_date TEXT)',
    defaultQuery: 'SELECT * FROM emails;',
    exercises: [
        { instruction: 'Delete all spam emails (is_spam = 1).', hint: 'DELETE FROM emails WHERE is_spam = 1', solution: 'DELETE FROM emails WHERE is_spam = 1', verify: 'SELECT COUNT(*) FROM emails WHERE is_spam = 1' },
        { instruction: "Delete all read emails from 'bob@work.com'.", hint: "WHERE is_read = 1 AND sender = 'bob@work.com'", solution: "DELETE FROM emails WHERE is_read = 1 AND sender = 'bob@work.com'", verify: "SELECT COUNT(*) FROM emails WHERE is_read = 1 AND sender = 'bob@work.com'" },
        { instruction: "Delete emails received before '2024-01-12'.", hint: "WHERE received_date < '2024-01-12'", solution: "DELETE FROM emails WHERE received_date < '2024-01-12'", verify: "SELECT COUNT(*) FROM emails WHERE received_date < '2024-01-12'" }
    ],
    tests: [
        () => { const sender = pick(['alice@mail.com','bob@work.com','carol@mail.com']); return { type:'write', question:`Delete all emails from '${sender}'.`, solution:`DELETE FROM emails WHERE sender = '${sender}'`, verify:`SELECT COUNT(*) FROM emails WHERE sender = '${sender}'` }; },
        () => ({ type:'write', question:'Delete all spam emails.', solution:'DELETE FROM emails WHERE is_spam = 1', verify:'SELECT COUNT(*) FROM emails WHERE is_spam = 1' }),
        () => ({ type:'mcq', question:'What does <code>DELETE FROM emails;</code> (no WHERE) do?', options:['Deletes ALL rows from the table','Does nothing','Deletes the table itself','Only deletes the first row'], answer:0 }),
        () => ({ type:'mcq', question:'How can you preview which rows DELETE will remove?', options:['Run a SELECT with the same WHERE clause first','You cannot preview','Use DELETE PREVIEW','Use EXPLAIN DELETE'], answer:0 }),
        () => ({ type:'fix', question:'Fix this query:', broken:'DELETE emails WHERE is_spam = 1;', solution:'DELETE FROM emails WHERE is_spam = 1;' }),
        () => ({ type:'fix', question:'Fix this query:', broken:"DELETE FROM emails WHERE sender = alice@mail.com;", solution:"DELETE FROM emails WHERE sender = 'alice@mail.com';" }),
    ]
},

// --- Lesson 12: CREATE TABLE (Free Design) ---
{
    id: 12,
    title: 'CREATE TABLE & Data Types',
    theme: 'Free Design \u2014 build your own table',
    tutorial: `<h3>Creating Tables</h3>
<p><code>CREATE TABLE</code> defines a new table with columns and types:</p>
<div class="sql-example">CREATE TABLE students (\n  id INTEGER PRIMARY KEY,\n  name TEXT NOT NULL,\n  age INT,\n  gpa REAL DEFAULT 0.0\n);</div>
<h3>SQLite Data Types</h3>
<p><code>INTEGER</code> \u2014 whole numbers<br><code>TEXT</code> \u2014 strings<br><code>REAL</code> \u2014 decimals<br><code>BLOB</code> \u2014 binary data</p>
<h3>Constraints</h3>
<p><code>PRIMARY KEY</code> \u2014 unique identifier<br><code>NOT NULL</code> \u2014 must have a value<br><code>DEFAULT</code> \u2014 fallback value<br><code>IF NOT EXISTS</code> \u2014 avoid errors if table exists</p>
<div class="note">Experiment! Create your own tables and insert data into them in the sandbox.</div>`,
    schema: `CREATE TABLE example_items (id INTEGER PRIMARY KEY, name TEXT, quantity INT, price REAL, created TEXT);
INSERT INTO example_items VALUES (1,'Widget',100,9.99,'2024-01-01'),(2,'Gadget',50,24.99,'2024-01-05'),(3,'Doohickey',200,4.99,'2024-01-10'),(4,'Thingamajig',75,14.99,'2024-01-15');`,
    schemaDisplay: 'example_items(id INTEGER PRIMARY KEY, name TEXT, quantity INT, price REAL, created TEXT)',
    defaultQuery: 'SELECT * FROM example_items;',
    exercises: [
        { instruction: "Create a table called 'students' with columns: id INTEGER PRIMARY KEY, name TEXT NOT NULL, age INT, grade REAL.", hint: 'CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT NOT NULL, age INT, grade REAL)', solution: 'CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT NOT NULL, age INT, grade REAL)', verify: "SELECT name FROM sqlite_master WHERE type='table' AND name='students'" },
        { instruction: "Insert a new item into example_items: id=5, name='Gizmo', quantity=150, price=19.99, created='2024-02-01'.", hint: "INSERT INTO example_items VALUES (5,'Gizmo',150,19.99,'2024-02-01')", solution: "INSERT INTO example_items VALUES (5,'Gizmo',150,19.99,'2024-02-01')", verify: "SELECT * FROM example_items WHERE id = 5" },
        { instruction: "Create a table 'products' with: id INTEGER PRIMARY KEY, name TEXT NOT NULL, price REAL DEFAULT 0, in_stock INT DEFAULT 1.", hint: 'Use DEFAULT keyword for default values', solution: "CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, price REAL DEFAULT 0, in_stock INT DEFAULT 1)", verify: "SELECT name FROM sqlite_master WHERE type='table' AND name='products'" }
    ],
    tests: [
        () => { const tbl = pick(['pets','vehicles','recipes']); return { type:'write', question:`Create a table called '${tbl}' with columns: id INTEGER PRIMARY KEY, name TEXT, category TEXT.`, solution:`CREATE TABLE ${tbl} (id INTEGER PRIMARY KEY, name TEXT, category TEXT)`, verify:`SELECT name FROM sqlite_master WHERE type='table' AND name='${tbl}'` }; },
        () => ({ type:'mcq', question:'Which SQLite type stores decimal numbers?', options:['REAL','INTEGER','TEXT','DECIMAL'], answer:0 }),
        () => ({ type:'mcq', question:'What does PRIMARY KEY do?', options:['Ensures each row has a unique identifier','Sorts the table','Makes the column required','Encrypts the data'], answer:0 }),
        () => ({ type:'mcq', question:'What does NOT NULL mean?', options:['The column must have a value (cannot be empty)','The column must be zero','The column is deleted','The column is hidden'], answer:0 }),
        () => ({ type:'fix', question:'Fix this query:', broken:'CREATE TABLE tasks (id INTEGER PRIMARY KEY name TEXT);', solution:'CREATE TABLE tasks (id INTEGER PRIMARY KEY, name TEXT);' }),
        () => ({ type:'fix', question:'Fix this query:', broken:'CREATE TABL items (id INT, name TEXT);', solution:'CREATE TABLE items (id INT, name TEXT);' }),
    ]
},

// --- Lesson 13: JOINs (School) ---
{
    id: 13,
    title: 'JOINs',
    theme: 'School \u2014 students, classes, enrollments',
    tutorial: `<h3>Combining Tables</h3>
<p><code>JOIN</code> combines rows from two or more tables based on a related column:</p>
<div class="sql-example">SELECT students.name, classes.name\nFROM enrollments\nJOIN students ON enrollments.student_id = students.id\nJOIN classes ON enrollments.class_id = classes.id;</div>
<h3>INNER JOIN</h3>
<p>Returns only rows with matches in both tables (default JOIN type).</p>
<h3>LEFT JOIN</h3>
<p>Returns all rows from the left table, plus matches from the right. Unmatched = NULL.</p>
<div class="sql-example">SELECT s.name, e.class_id\nFROM students s\nLEFT JOIN enrollments e ON s.id = e.student_id;</div>
<h3>Table Aliases</h3>
<p>Use short aliases: <code>students s</code> lets you write <code>s.name</code> instead of <code>students.name</code>.</p>
<div class="note">JOINs are one of SQL's most powerful features. They let you store data efficiently across tables while still querying it together.</div>`,
    schema: `CREATE TABLE students (id INT, name TEXT, grade INT, gpa REAL);
CREATE TABLE classes (id INT, name TEXT, teacher TEXT, room TEXT);
CREATE TABLE enrollments (student_id INT, class_id INT, semester TEXT, grade_letter TEXT);
INSERT INTO students VALUES (1,'Emma',10,3.8),(2,'Liam',11,3.5),(3,'Sophia',10,3.9),(4,'Noah',12,3.2),(5,'Ava',11,3.7),(6,'Mason',10,2.9),(7,'Olivia',12,3.6),(8,'Ethan',11,3.1);
INSERT INTO classes VALUES (1,'Math 101','Dr. Park','A101'),(2,'English Lit','Ms. Chen','B205'),(3,'Physics','Dr. Ruiz','C110'),(4,'History','Mr. Adams','A203'),(5,'Art','Ms. Kim','D102');
INSERT INTO enrollments VALUES (1,1,'Fall','A'),(1,2,'Fall','B'),(2,1,'Fall','B'),(2,3,'Fall','A'),(3,2,'Fall','A'),(3,4,'Fall','A'),(4,3,'Fall','C'),(4,5,'Fall','B'),(5,1,'Fall','A'),(5,4,'Fall','B'),(6,2,'Fall','C'),(6,5,'Fall','A'),(7,3,'Fall','B'),(7,4,'Fall','A'),(8,1,'Fall','B'),(8,5,'Fall','C');`,
    schemaDisplay: 'students(id, name, grade, gpa)\nclasses(id, name, teacher, room)\nenrollments(student_id, class_id, semester, grade_letter)',
    defaultQuery: 'SELECT * FROM students;',
    exercises: [
        { instruction: 'Join enrollments with students to show student names with their class_ids.', hint: 'JOIN students ON enrollments.student_id = students.id', solution: 'SELECT students.name, enrollments.class_id FROM enrollments JOIN students ON enrollments.student_id = students.id' },
        { instruction: 'Join all three tables to show student name, class name, and grade_letter.', hint: 'Two JOINs: one for students, one for classes', solution: 'SELECT students.name, classes.name, enrollments.grade_letter FROM enrollments JOIN students ON enrollments.student_id = students.id JOIN classes ON enrollments.class_id = classes.id' },
        { instruction: "Use a LEFT JOIN to show all students and their enrollments (students with no enrollments should still appear with NULL).", hint: 'FROM students LEFT JOIN enrollments ON students.id = enrollments.student_id', solution: 'SELECT students.name, enrollments.class_id FROM students LEFT JOIN enrollments ON students.id = enrollments.student_id' }
    ],
    tests: [
        () => ({ type:'write', question:'Join students and enrollments to show each student\'s name and their grade_letter.', solution:'SELECT students.name, enrollments.grade_letter FROM enrollments JOIN students ON enrollments.student_id = students.id' }),
        () => { const teacher = pick(['Dr. Park','Ms. Chen','Dr. Ruiz','Mr. Adams','Ms. Kim']); return { type:'write', question:`Find all student names enrolled in classes taught by '${teacher}'.`, solution:`SELECT students.name FROM enrollments JOIN students ON enrollments.student_id = students.id JOIN classes ON enrollments.class_id = classes.id WHERE classes.teacher = '${teacher}'` }; },
        () => ({ type:'mcq', question:'What does INNER JOIN return?', options:['Only rows with matches in both tables','All rows from both tables','All rows from the left table','All rows from the right table'], answer:0 }),
        () => ({ type:'mcq', question:'What does LEFT JOIN return for unmatched rows?', options:['The left table row with NULLs for right table columns','Nothing (skips unmatched)','An error','The right table row with NULLs'], answer:0 }),
        () => ({ type:'fix', question:'Fix this query (wrong join condition):', broken:'SELECT students.name, enrollments.grade_letter FROM enrollments JOIN students ON enrollments.class_id = students.id;', solution:'SELECT students.name, enrollments.grade_letter FROM enrollments JOIN students ON enrollments.student_id = students.id;' }),
        () => ({ type:'fix', question:'Fix this query (missing ON clause):', broken:'SELECT students.name, classes.name FROM enrollments JOIN students JOIN classes;', solution:'SELECT students.name, classes.name FROM enrollments JOIN students ON enrollments.student_id = students.id JOIN classes ON enrollments.class_id = classes.id;' }),
    ]
},

// --- Lesson 14: Subqueries (Company) ---
{
    id: 14,
    title: 'Subqueries',
    theme: 'Company \u2014 employees, departments, salaries',
    tutorial: `<h3>Queries Inside Queries</h3>
<p>A subquery is a <code>SELECT</code> nested inside another query:</p>
<div class="sql-example">SELECT name FROM employees\nWHERE salary > (SELECT AVG(salary) FROM employees);</div>
<h3>Subquery with IN</h3>
<p>Find employees in departments with high budgets:</p>
<div class="sql-example">SELECT name FROM employees\nWHERE department_id IN (\n  SELECT id FROM departments WHERE budget > 500000\n);</div>
<h3>Subquery in FROM</h3>
<p>Use a subquery as a derived table:</p>
<div class="sql-example">SELECT dept_name, avg_sal FROM (\n  SELECT d.name AS dept_name, AVG(e.salary) AS avg_sal\n  FROM employees e JOIN departments d ON e.department_id = d.id\n  GROUP BY d.name\n) WHERE avg_sal > 70000;</div>
<div class="note">Subqueries let you break complex problems into smaller steps. The inner query runs first, then its result feeds the outer query.</div>`,
    schema: `CREATE TABLE departments (id INT, name TEXT, budget INT);
CREATE TABLE employees (id INT, name TEXT, department_id INT, salary INT, hire_date TEXT, title TEXT);
INSERT INTO departments VALUES (1,'Engineering',800000),(2,'Marketing',400000),(3,'Sales',350000),(4,'HR',250000);
INSERT INTO employees VALUES (1,'Alice',1,95000,'2020-03-15','Senior Engineer'),(2,'Bob',1,82000,'2021-06-01','Engineer'),(3,'Carol',2,68000,'2019-11-20','Marketing Lead'),(4,'Dave',3,72000,'2022-01-10','Sales Rep'),(5,'Eve',1,105000,'2018-05-22','Staff Engineer'),(6,'Frank',2,58000,'2023-02-14','Marketing Analyst'),(7,'Grace',3,65000,'2020-09-30','Sales Rep'),(8,'Hank',4,55000,'2021-08-05','HR Coordinator'),(9,'Ivy',1,78000,'2022-07-18','Engineer'),(10,'Jack',3,70000,'2019-04-12','Sales Lead'),(11,'Kate',4,62000,'2020-12-01','HR Manager'),(12,'Leo',2,73000,'2021-03-25','Marketing Manager');`,
    schemaDisplay: 'departments(id INT, name TEXT, budget INT)\nemployees(id INT, name TEXT, department_id INT, salary INT, hire_date TEXT, title TEXT)',
    defaultQuery: 'SELECT * FROM employees;',
    exercises: [
        { instruction: 'Find all employees who earn more than the average salary.', hint: 'WHERE salary > (SELECT AVG(salary) FROM employees)', solution: 'SELECT name, salary FROM employees WHERE salary > (SELECT AVG(salary) FROM employees)' },
        { instruction: 'Find employees in departments with a budget over 500000.', hint: 'WHERE department_id IN (SELECT id FROM departments WHERE budget > 500000)', solution: 'SELECT name FROM employees WHERE department_id IN (SELECT id FROM departments WHERE budget > 500000)' },
        { instruction: 'Find the department name with the highest total salary expense.', hint: 'Use a subquery with MAX and GROUP BY', solution: "SELECT d.name FROM departments d JOIN employees e ON d.id = e.department_id GROUP BY d.name ORDER BY SUM(e.salary) DESC LIMIT 1" }
    ],
    tests: [
        () => { const thresh = pick([60000,70000,80000]); return { type:'write', question:`Find names of employees earning more than ${thresh}.`, solution:`SELECT name FROM employees WHERE salary > ${thresh}` }; },
        () => { const budget = pick([300000,400000,500000]); return { type:'write', question:`Find employee names in departments with budget over ${budget}.`, solution:`SELECT name FROM employees WHERE department_id IN (SELECT id FROM departments WHERE budget > ${budget})` }; },
        () => ({ type:'write', question:'Find employees who earn above the average salary. Show name and salary.', solution:'SELECT name, salary FROM employees WHERE salary > (SELECT AVG(salary) FROM employees)' }),
        () => ({ type:'mcq', question:'When does the inner subquery execute?', options:['Before the outer query','After the outer query','At the same time','Only if needed'], answer:0 }),
        () => ({ type:'mcq', question:'What does <code>IN (SELECT ...)</code> check?', options:['If the value is in the list returned by the subquery','If the subquery returns TRUE','If the value is NULL','If the tables match'], answer:0 }),
        () => ({ type:'fix', question:'Fix this query (missing parentheses around subquery):', broken:'SELECT name FROM employees WHERE salary > SELECT AVG(salary) FROM employees;', solution:'SELECT name FROM employees WHERE salary > (SELECT AVG(salary) FROM employees);' }),
    ]
},

// --- Lesson 15: LIKE & Text Functions (Movie Quotes) ---
{
    id: 15,
    title: 'LIKE, Wildcards & Text Functions',
    theme: 'Movie Quotes \u2014 characters, lines, films',
    tutorial: `<h3>Pattern Matching with LIKE</h3>
<p><code>LIKE</code> searches for patterns in text:</p>
<p><code>%</code> \u2014 matches any number of characters<br><code>_</code> \u2014 matches exactly one character</p>
<div class="sql-example">SELECT * FROM quotes WHERE quote LIKE '%force%';</div>
<div class="sql-example">SELECT * FROM quotes WHERE character_name LIKE 'D___';\n-- Names starting with D, exactly 4 characters</div>
<h3>Text Functions</h3>
<p><code>UPPER()</code>, <code>LOWER()</code> \u2014 change case<br><code>LENGTH()</code> \u2014 string length<br><code>SUBSTR(col, start, len)</code> \u2014 extract substring<br><code>||</code> \u2014 concatenation</p>
<div class="sql-example">SELECT character_name || ': ' || quote AS full_quote FROM quotes;</div>
<div class="sql-example">SELECT quote, LENGTH(quote) AS len FROM quotes ORDER BY len DESC;</div>
<div class="note">LIKE is case-insensitive in SQLite by default for ASCII characters.</div>`,
    schema: `CREATE TABLE quotes (id INT, character_name TEXT, quote TEXT, film TEXT, year INT, genre TEXT);
INSERT INTO quotes VALUES (1,'Captain Rex','I have a feeling this mission will be legendary.','Star Battalion',2019,'Sci-Fi'),(2,'Diana Storm','The truth never hides for long.','Shadow Court',2021,'Drama'),(3,'Duke Silver','In this town, jazz is the only law.','Midnight Groove',2020,'Comedy'),(4,'Elena Frost','Winter taught me patience. Ice taught me strength.','Frozen Throne',2022,'Fantasy'),(5,'Captain Rex','We ride at dawn, or we do not ride at all.','Star Battalion 2',2022,'Sci-Fi'),(6,'Maxine Power','Power is nothing without precision.','Thunder Strike',2018,'Action'),(7,'Old Ben','I have seen things you would not believe.','Desert Wanderer',2020,'Western'),(8,'Diana Storm','Every shadow was once touched by light.','Shadow Court 2',2023,'Drama'),(9,'Zara Quick','Speed is life. Hesitation is death.','Velocity',2021,'Action'),(10,'Duke Silver','Never trust a man who does not like music.','Midnight Groove 2',2023,'Comedy'),(11,'Elena Frost','The coldest heart burns the brightest.','Frozen Throne 2',2024,'Fantasy'),(12,'Old Ben','Time is the only currency that matters.','Desert Wanderer 2',2023,'Western');`,
    schemaDisplay: 'quotes(id INT, character_name TEXT, quote TEXT, film TEXT, year INT, genre TEXT)',
    defaultQuery: 'SELECT * FROM quotes;',
    exercises: [
        { instruction: "Find all quotes that contain the word 'never' (case-insensitive).", hint: "Use WHERE quote LIKE '%never%'", solution: "SELECT * FROM quotes WHERE quote LIKE '%never%'" },
        { instruction: "Find characters whose names start with 'D'.", hint: "Use WHERE character_name LIKE 'D%'", solution: "SELECT DISTINCT character_name FROM quotes WHERE character_name LIKE 'D%'" },
        { instruction: "Concatenate character_name and quote with ': ' between them. Alias it as full_quote.", hint: "Use || for concatenation", solution: "SELECT character_name || ': ' || quote AS full_quote FROM quotes" }
    ],
    tests: [
        () => { const word = pick(['the','never','is','have','life']); return { type:'write', question:`Find all quotes containing the word '${word}'.`, solution:`SELECT * FROM quotes WHERE quote LIKE '%${word}%'` }; },
        () => { const letter = pick(['C','D','E','M','O','Z']); return { type:'write', question:`Find all distinct character names starting with '${letter}'.`, solution:`SELECT DISTINCT character_name FROM quotes WHERE character_name LIKE '${letter}%'` }; },
        () => ({ type:'write', question:'Select all quotes and their lengths, sorted by length descending.', solution:'SELECT quote, LENGTH(quote) AS len FROM quotes ORDER BY len DESC' }),
        () => ({ type:'mcq', question:'What does <code>%</code> match in a LIKE pattern?', options:['Any number of characters (including zero)','Exactly one character','Only letters','Only numbers'], answer:0 }),
        () => ({ type:'mcq', question:'What does <code>_</code> match in a LIKE pattern?', options:['Exactly one character','Any number of characters','Only letters','Nothing (literal underscore)'], answer:0 }),
        () => ({ type:'fix', question:'Fix this query:', broken:"SELECT * FROM quotes WHERE quote LIKE 'never';", solution:"SELECT * FROM quotes WHERE quote LIKE '%never%';" }),
        () => ({ type:'fix', question:'Fix this query:', broken:"SELECT character_name + quote FROM quotes;", solution:"SELECT character_name || quote FROM quotes;" }),
    ]
},

// --- Lesson 16: CASE Expressions & NULL Handling (Weather Stations) ---
{
    id: 16,
    title: 'CASE Expressions & NULL Handling',
    theme: 'Weather Stations \u2014 sensors, readings, missing data',
    tutorial: `<h3>CASE Expressions</h3>
<p>The <code>CASE</code> expression lets you add conditional logic to your queries \u2014 like if/else in programming:</p>
<div class="sql-example">SELECT station, temp_c,
  CASE
    WHEN temp_c < 10 THEN 'Cold'
    WHEN temp_c < 25 THEN 'Warm'
    ELSE 'Hot'
  END AS temp_label
FROM readings;</div>
<p>Each <code>WHEN</code> is checked in order. The first match wins. <code>ELSE</code> is the fallback (if omitted, unmatched rows get NULL).</p>
<h3>Working with NULL</h3>
<p>NULL means "unknown" or "missing". It is <strong>not</strong> zero or an empty string. You cannot use <code>= NULL</code>; instead use <code>IS NULL</code> or <code>IS NOT NULL</code>:</p>
<div class="sql-example">SELECT * FROM readings WHERE humidity IS NULL;</div>
<h3>COALESCE &amp; NULLIF</h3>
<p><code>COALESCE(a, b, ...)</code> returns the first non-NULL value:</p>
<div class="sql-example">SELECT station, COALESCE(wind_speed, 0) AS wind FROM readings;</div>
<p><code>NULLIF(a, b)</code> returns NULL if <code>a = b</code>, otherwise returns <code>a</code>. Useful for turning sentinel values into NULL:</p>
<div class="sql-example">SELECT station, NULLIF(condition, 'Unknown') AS cond FROM readings;</div>
<div class="note">Any arithmetic with NULL produces NULL: <code>5 + NULL = NULL</code>. Any comparison with NULL (using =, <, >) returns NULL (not TRUE or FALSE).</div>`,
    schema: `CREATE TABLE readings (id INT, station TEXT, date TEXT, temp_c REAL, humidity INT, wind_speed REAL, condition TEXT);
INSERT INTO readings VALUES (1,'Alpine Summit','2024-01-15',-8.2,45,12.5,'Snow'),(2,'Alpine Summit','2024-02-10',-3.1,NULL,8.0,'Cloudy'),(3,'Desert Flats','2024-01-15',32.7,12,NULL,'Clear'),(4,'Desert Flats','2024-02-10',35.4,8,5.2,'Clear'),(5,'Coastal Bay','2024-01-15',18.3,78,22.1,'Rain'),(6,'Coastal Bay','2024-02-10',20.5,82,NULL,'Cloudy'),(7,'Forest Ridge','2024-01-15',5.0,65,3.4,'Fog'),(8,'Forest Ridge','2024-02-10',NULL,NULL,NULL,'Unknown'),(9,'Urban Central','2024-01-15',12.8,55,7.6,'Clear'),(10,'Urban Central','2024-02-10',15.2,60,9.1,'Cloudy'),(11,'Alpine Summit','2024-03-05',2.0,50,15.3,'Snow'),(12,'Desert Flats','2024-03-05',38.9,5,4.0,'Clear'),(13,'Coastal Bay','2024-03-05',NULL,75,18.7,'Rain'),(14,'Forest Ridge','2024-03-05',8.4,62,NULL,'Unknown'),(15,'Urban Central','2024-03-05',18.0,48,6.2,'Clear');`,
    schemaDisplay: 'readings(id INT, station TEXT, date TEXT, temp_c REAL, humidity INT, wind_speed REAL, condition TEXT)',
    defaultQuery: 'SELECT * FROM readings;',
    exercises: [
        { instruction: "Use CASE to label each reading's temp_c as 'Cold' (below 10), 'Warm' (10 to 25), or 'Hot' (above 25). Show station, temp_c, and the label as temp_label. Exclude rows where temp_c IS NULL.", hint: "CASE WHEN temp_c < 10 THEN 'Cold' WHEN temp_c <= 25 THEN 'Warm' ELSE 'Hot' END AS temp_label", solution: "SELECT station, temp_c, CASE WHEN temp_c < 10 THEN 'Cold' WHEN temp_c <= 25 THEN 'Warm' ELSE 'Hot' END AS temp_label FROM readings WHERE temp_c IS NOT NULL" },
        { instruction: "Find all readings where humidity is missing (NULL). Show station and date.", hint: "Use IS NULL", solution: "SELECT station, date FROM readings WHERE humidity IS NULL" },
        { instruction: "Select station, date, and wind_speed but replace NULL wind_speed values with 0. Alias the result as wind.", hint: "Use COALESCE(wind_speed, 0)", solution: "SELECT station, date, COALESCE(wind_speed, 0) AS wind FROM readings" },
        { instruction: "Select station and condition, but return NULL when condition is 'Unknown'. Alias the result as cond.", hint: "Use NULLIF(condition, 'Unknown')", solution: "SELECT station, NULLIF(condition, 'Unknown') AS cond FROM readings" }
    ],
    tests: [
        () => { const thresh = pick([10,15,20]); return { type:'write', question:`Use CASE to label temp_c: below ${thresh} is 'Cold', ${thresh} and above is 'Warm'. Show station, temp_c, and the label as temp_label. Exclude NULL temp_c.`, solution:`SELECT station, temp_c, CASE WHEN temp_c < ${thresh} THEN 'Cold' ELSE 'Warm' END AS temp_label FROM readings WHERE temp_c IS NOT NULL` }; },
        () => { const col = pick(['humidity','wind_speed']); return { type:'write', question:`Find all readings where ${col} IS NULL. Show station and date.`, solution:`SELECT station, date FROM readings WHERE ${col} IS NULL` }; },
        () => { const col = pick(['wind_speed','humidity']); const def = col === 'wind_speed' ? '0' : '0'; return { type:'write', question:`Select station, date, and ${col} but replace NULL values with ${def} using COALESCE. Alias the result as filled.`, solution:`SELECT station, date, COALESCE(${col}, ${def}) AS filled FROM readings` }; },
        () => ({ type:'mcq', question:'What is the correct way to check for NULL values in SQL?', options:['IS NULL','= NULL','== NULL','EQUALS NULL'], answer:0 }),
        () => ({ type:'mcq', question:'What does COALESCE(NULL, NULL, 5, 3) return?', options:['5','NULL','3','0'], answer:0 }),
        () => ({ type:'mcq', question:'What does NULLIF(10, 10) return?', options:['NULL','10','0','An error'], answer:0 }),
        () => ({ type:'fix', question:'Fix this CASE expression:', broken:"SELECT station, CASE WHEN temp_c < 10 'Cold' WHEN temp_c < 25 'Warm' ELSE 'Hot' END AS label FROM readings;", solution:"SELECT station, CASE WHEN temp_c < 10 THEN 'Cold' WHEN temp_c < 25 THEN 'Warm' ELSE 'Hot' END AS label FROM readings;" }),
    ]
},

// --- Lesson 17: UNION & Set Operations (E-commerce) ---
{
    id: 17,
    title: 'UNION & Set Operations',
    theme: 'E-commerce \u2014 online and store orders',
    tutorial: `<h3>Combining Results with UNION</h3>
<p>Set operations combine the results of two or more <code>SELECT</code> statements.</p>
<p><code>UNION ALL</code> stacks all rows (keeps duplicates):</p>
<div class="sql-example">SELECT customer, product FROM online_orders
UNION ALL
SELECT customer, product FROM store_orders;</div>
<p><code>UNION</code> removes duplicate rows from the combined result:</p>
<div class="sql-example">SELECT customer FROM online_orders
UNION
SELECT customer FROM store_orders;</div>
<h3>INTERSECT &amp; EXCEPT</h3>
<p><code>INTERSECT</code> returns only rows that appear in <strong>both</strong> queries:</p>
<div class="sql-example">SELECT product FROM online_orders
INTERSECT
SELECT product FROM store_orders;</div>
<p><code>EXCEPT</code> returns rows from the first query that are <strong>not</strong> in the second:</p>
<div class="sql-example">SELECT product FROM online_orders
EXCEPT
SELECT product FROM store_orders;</div>
<div class="note">All set operations require the same number of columns with compatible types in both SELECT statements. Column names come from the first query.</div>`,
    schema: `CREATE TABLE online_orders (id INT, customer TEXT, product TEXT, amount REAL, order_date TEXT);
CREATE TABLE store_orders (id INT, customer TEXT, product TEXT, amount REAL, order_date TEXT);
INSERT INTO online_orders VALUES (1,'Alice','Laptop',999.99,'2024-01-10'),(2,'Bob','Headphones',79.99,'2024-01-12'),(3,'Carol','Keyboard',49.99,'2024-01-15'),(4,'Alice','Mouse',29.99,'2024-01-18'),(5,'Dave','Monitor',349.99,'2024-01-20'),(6,'Eve','Laptop',999.99,'2024-02-01'),(7,'Frank','Tablet',449.99,'2024-02-05'),(8,'Bob','Webcam',89.99,'2024-02-10');
INSERT INTO store_orders VALUES (1,'Grace','Laptop',1049.99,'2024-01-11'),(2,'Hank','Mouse',34.99,'2024-01-13'),(3,'Alice','Keyboard',54.99,'2024-01-16'),(4,'Ivan','Headphones',84.99,'2024-01-19'),(5,'Carol','Printer',199.99,'2024-01-22'),(6,'Jack','Monitor',379.99,'2024-02-02'),(7,'Grace','Tablet',479.99,'2024-02-06'),(8,'Hank','Desk Lamp',45.99,'2024-02-12');`,
    schemaDisplay: 'online_orders(id INT, customer TEXT, product TEXT, amount REAL, order_date TEXT)\nstore_orders(id INT, customer TEXT, product TEXT, amount REAL, order_date TEXT)',
    defaultQuery: 'SELECT * FROM online_orders;\n-- SELECT * FROM store_orders;',
    exercises: [
        { instruction: "Combine all orders from both tables using UNION ALL. Select customer, product, and amount from each.", hint: "SELECT customer, product, amount FROM online_orders UNION ALL SELECT customer, product, amount FROM store_orders", solution: "SELECT customer, product, amount FROM online_orders UNION ALL SELECT customer, product, amount FROM store_orders" },
        { instruction: "Get a list of all distinct customer names from both tables using UNION.", hint: "SELECT customer FROM ... UNION SELECT customer FROM ...", solution: "SELECT customer FROM online_orders UNION SELECT customer FROM store_orders" },
        { instruction: "Find products that were sold in both channels using INTERSECT.", hint: "SELECT product FROM ... INTERSECT SELECT product FROM ...", solution: "SELECT product FROM online_orders INTERSECT SELECT product FROM store_orders" },
        { instruction: "Find products sold online but NOT in store using EXCEPT.", hint: "SELECT product FROM online_orders EXCEPT SELECT product FROM store_orders", solution: "SELECT product FROM online_orders EXCEPT SELECT product FROM store_orders" }
    ],
    tests: [
        () => { const cols = pick(['customer, product','customer, product, amount']); return { type:'write', question:`Combine all rows from online_orders and store_orders using UNION ALL. Select ${cols}.`, solution:`SELECT ${cols} FROM online_orders UNION ALL SELECT ${cols} FROM store_orders` }; },
        () => { const col = pick(['customer','product']); return { type:'write', question:`Get all distinct ${col} values from both tables using UNION.`, solution:`SELECT ${col} FROM online_orders UNION SELECT ${col} FROM store_orders` }; },
        () => ({ type:'write', question:'Find products that appear in both online_orders and store_orders using INTERSECT.', solution:'SELECT product FROM online_orders INTERSECT SELECT product FROM store_orders' }),
        () => ({ type:'mcq', question:'What is the difference between UNION and UNION ALL?', options:['UNION removes duplicates, UNION ALL keeps them','UNION ALL removes duplicates, UNION keeps them','UNION is faster','There is no difference'], answer:0 }),
        () => ({ type:'mcq', question:'What must be true about the two SELECTs in a UNION?', options:['Same number of columns with compatible types','Same table names','Same WHERE clauses','Same number of rows'], answer:0 }),
        () => ({ type:'fix', question:'Fix this UNION (mismatched columns):', broken:"SELECT customer, product FROM online_orders UNION SELECT customer FROM store_orders;", solution:"SELECT customer, product FROM online_orders UNION SELECT customer, product FROM store_orders;" }),
        () => ({ type:'mcq', question:'What does EXCEPT return?', options:['Rows in the first query but not in the second','Rows in both queries','Rows in neither query','All rows minus duplicates'], answer:0 }),
    ]
},

// --- Lesson 18: Common Table Expressions (CTEs) (Social Media) ---
{
    id: 18,
    title: 'Common Table Expressions (CTEs)',
    theme: 'Social Media \u2014 users, posts, follows',
    tutorial: `<h3>What is a CTE?</h3>
<p>A <strong>Common Table Expression</strong> (CTE) is a named temporary result set defined with <code>WITH...AS</code>. Think of it as a named subquery you can reference like a table:</p>
<div class="sql-example">WITH active_users AS (
  SELECT user_id, COUNT(*) AS post_count
  FROM posts
  GROUP BY user_id
  HAVING COUNT(*) >= 3
)
SELECT u.username, a.post_count
FROM active_users a
JOIN users u ON u.id = a.user_id;</div>
<h3>Why CTEs?</h3>
<p>CTEs make complex queries more readable by breaking them into logical steps. Compare the CTE above with a nested subquery \u2014 the CTE version reads top-to-bottom.</p>
<h3>Multiple CTEs</h3>
<p>You can define multiple CTEs separated by commas:</p>
<div class="sql-example">WITH post_stats AS (
  SELECT user_id, COUNT(*) AS posts
  FROM posts GROUP BY user_id
),
follower_stats AS (
  SELECT following_id AS user_id, COUNT(*) AS followers
  FROM follows GROUP BY following_id
)
SELECT u.username, COALESCE(p.posts,0) AS posts, COALESCE(f.followers,0) AS followers
FROM users u
LEFT JOIN post_stats p ON u.id = p.user_id
LEFT JOIN follower_stats f ON u.id = f.user_id;</div>
<div class="note">CTEs exist only for the duration of the query. They are not stored anywhere. Each CTE can reference previously defined CTEs in the same WITH clause.</div>`,
    schema: `CREATE TABLE users (id INT, username TEXT, join_date TEXT);
CREATE TABLE posts (id INT, user_id INT, content TEXT, created_date TEXT, likes_count INT);
CREATE TABLE follows (follower_id INT, following_id INT);
INSERT INTO users VALUES (1,'alice_dev','2023-01-15'),(2,'bob_photo','2023-03-22'),(3,'carol_writes','2023-02-10'),(4,'dave_music','2023-06-01'),(5,'eve_travels','2023-04-18'),(6,'frank_cooks','2023-07-30');
INSERT INTO posts VALUES (1,1,'Just shipped a new feature!','2024-01-10',45),(2,1,'Debugging at midnight again','2024-01-15',32),(3,1,'Code review tips thread','2024-02-01',78),(4,2,'Sunset at the beach','2024-01-12',120),(5,2,'New camera lens review','2024-01-20',95),(6,3,'My top 10 books of 2024','2024-01-18',67),(7,3,'Writing productivity hacks','2024-02-05',53),(8,3,'Short story draft','2024-02-12',41),(9,3,'Poetry collection update','2024-02-20',29),(10,4,'New album dropping soon','2024-01-25',88),(11,5,'Hiking in Patagonia','2024-02-01',110),(12,5,'Travel budget tips','2024-02-10',72);
INSERT INTO follows VALUES (1,2),(1,3),(2,1),(2,3),(3,1),(3,2),(3,4),(4,1),(4,5),(5,1),(5,2),(5,3),(6,1),(6,2),(6,3),(6,4),(6,5);`,
    schemaDisplay: 'users(id INT, username TEXT, join_date TEXT)\nposts(id INT, user_id INT, content TEXT, created_date TEXT, likes_count INT)\nfollows(follower_id INT, following_id INT)',
    defaultQuery: 'SELECT * FROM users;\n-- SELECT * FROM posts;\n-- SELECT * FROM follows;',
    exercises: [
        { instruction: "Write a CTE named 'prolific' that finds user_ids with more than 2 posts. Then select the username and post count by joining with the users table.", hint: "WITH prolific AS (SELECT user_id, COUNT(*) AS post_count FROM posts GROUP BY user_id HAVING COUNT(*) > 2)", solution: "WITH prolific AS (SELECT user_id, COUNT(*) AS post_count FROM posts GROUP BY user_id HAVING COUNT(*) > 2) SELECT u.username, p.post_count FROM prolific p JOIN users u ON u.id = p.user_id" },
        { instruction: "Write a CTE named 'avg_likes' that calculates each user's average likes_count. Then select users whose average is above the overall average likes. Show username and avg_likes.", hint: "First CTE gets AVG(likes_count) per user_id, then compare to (SELECT AVG(likes_count) FROM posts)", solution: "WITH avg_likes AS (SELECT user_id, AVG(likes_count) AS avg_likes FROM posts GROUP BY user_id) SELECT u.username, a.avg_likes FROM avg_likes a JOIN users u ON u.id = a.user_id WHERE a.avg_likes > (SELECT AVG(likes_count) FROM posts)" },
        { instruction: "Use two CTEs: 'post_counts' (count posts per user_id) and 'follower_counts' (count followers per following_id). Then join both with users to show username, posts, and followers.", hint: "WITH post_counts AS (...), follower_counts AS (...) SELECT ...", solution: "WITH post_counts AS (SELECT user_id, COUNT(*) AS posts FROM posts GROUP BY user_id), follower_counts AS (SELECT following_id AS user_id, COUNT(*) AS followers FROM follows GROUP BY following_id) SELECT u.username, COALESCE(p.posts, 0) AS posts, COALESCE(f.followers, 0) AS followers FROM users u LEFT JOIN post_counts p ON u.id = p.user_id LEFT JOIN follower_counts f ON u.id = f.user_id" }
    ],
    tests: [
        () => { const n = pick([1,2,3]); return { type:'write', question:`Write a CTE named 'active' that finds user_ids with more than ${n} posts. Then select username and post count by joining with users.`, solution:`WITH active AS (SELECT user_id, COUNT(*) AS post_count FROM posts GROUP BY user_id HAVING COUNT(*) > ${n}) SELECT u.username, a.post_count FROM active a JOIN users u ON u.id = a.user_id` }; },
        () => { const n = pick([50,60,70]); return { type:'write', question:`Write a CTE named 'popular' that finds posts with likes_count > ${n}. Then select the username and content by joining with users.`, solution:`WITH popular AS (SELECT * FROM posts WHERE likes_count > ${n}) SELECT u.username, p.content FROM popular p JOIN users u ON u.id = p.user_id` }; },
        () => ({ type:'write', question:'Write a CTE named "follower_counts" that counts followers per user (following_id). Then select username and follower count, joining with users.', solution:'WITH follower_counts AS (SELECT following_id AS user_id, COUNT(*) AS followers FROM follows GROUP BY following_id) SELECT u.username, f.followers FROM follower_counts f JOIN users u ON u.id = f.user_id' }),
        () => ({ type:'mcq', question:'What does CTE stand for?', options:['Common Table Expression','Computed Table Entity','Conditional Table Expression','Cascaded Table Extension'], answer:0 }),
        () => ({ type:'mcq', question:'How long does a CTE exist?', options:['Only for the duration of the single query','Until the session ends','Permanently like a table','Until explicitly dropped'], answer:0 }),
        () => ({ type:'fix', question:'Fix this CTE (missing AS keyword):', broken:"WITH active (SELECT user_id, COUNT(*) AS cnt FROM posts GROUP BY user_id) SELECT * FROM active;", solution:"WITH active AS (SELECT user_id, COUNT(*) AS cnt FROM posts GROUP BY user_id) SELECT * FROM active;" }),
        () => ({ type:'fix', question:'Fix this CTE (wrong reference):', broken:"WITH post_stats AS (SELECT user_id, COUNT(*) AS cnt FROM posts GROUP BY user_id) SELECT * FROM posts_stats;", solution:"WITH post_stats AS (SELECT user_id, COUNT(*) AS cnt FROM posts GROUP BY user_id) SELECT * FROM post_stats;" }),
    ]
},

// --- Lesson 19: Window Functions (Sales Analytics) ---
{
    id: 19,
    title: 'Window Functions',
    theme: 'Sales Analytics \u2014 employees, departments, revenue',
    tutorial: `<h3>What are Window Functions?</h3>
<p>Window functions perform calculations across a set of rows <strong>related to the current row</strong>, without collapsing them like GROUP BY does. They use the <code>OVER()</code> clause:</p>
<div class="sql-example">SELECT employee, department, revenue,
  SUM(revenue) OVER () AS total_revenue
FROM sales;</div>
<h3>PARTITION BY</h3>
<p><code>PARTITION BY</code> divides rows into groups (partitions). The window function is applied within each partition:</p>
<div class="sql-example">SELECT employee, department, revenue,
  SUM(revenue) OVER (PARTITION BY department) AS dept_total
FROM sales;</div>
<h3>Ranking Functions</h3>
<p><code>ROW_NUMBER()</code> \u2014 unique sequential number<br>
<code>RANK()</code> \u2014 same rank for ties, gaps after<br>
<code>DENSE_RANK()</code> \u2014 same rank for ties, no gaps</p>
<div class="sql-example">SELECT employee, department, revenue,
  RANK() OVER (PARTITION BY department ORDER BY revenue DESC) AS dept_rank
FROM sales;</div>
<h3>Running Totals &amp; LAG/LEAD</h3>
<p>Add <code>ORDER BY</code> inside <code>OVER()</code> to create running totals:</p>
<div class="sql-example">SELECT employee, month, revenue,
  SUM(revenue) OVER (PARTITION BY employee ORDER BY month) AS running_total
FROM sales;</div>
<p><code>LAG(col, n)</code> accesses a previous row, <code>LEAD(col, n)</code> accesses a following row:</p>
<div class="sql-example">SELECT employee, month, revenue,
  LAG(revenue, 1) OVER (PARTITION BY employee ORDER BY month) AS prev_month
FROM sales;</div>
<div class="note">Window functions do NOT reduce the number of rows. Every original row is preserved in the output, with extra calculated columns.</div>`,
    schema: `CREATE TABLE sales (id INT, employee TEXT, department TEXT, month TEXT, revenue INT, units_sold INT);
INSERT INTO sales VALUES (1,'Alice','Engineering','2024-01',15000,120),(2,'Alice','Engineering','2024-02',18000,145),(3,'Alice','Engineering','2024-03',16500,130),(4,'Bob','Engineering','2024-01',12000,95),(5,'Bob','Engineering','2024-02',14000,110),(6,'Bob','Engineering','2024-03',13500,105),(7,'Carol','Marketing','2024-01',9000,70),(8,'Carol','Marketing','2024-02',11000,88),(9,'Carol','Marketing','2024-03',10500,82),(10,'Dave','Marketing','2024-01',8500,65),(11,'Dave','Marketing','2024-02',9500,75),(12,'Dave','Marketing','2024-03',12000,95),(13,'Eve','Sales','2024-01',20000,160),(14,'Eve','Sales','2024-02',22000,175),(15,'Eve','Sales','2024-03',19000,150),(16,'Frank','Sales','2024-01',17000,135),(17,'Frank','Sales','2024-02',15500,125),(18,'Frank','Sales','2024-03',18500,148);`,
    schemaDisplay: 'sales(id INT, employee TEXT, department TEXT, month TEXT, revenue INT, units_sold INT)',
    defaultQuery: 'SELECT * FROM sales;',
    exercises: [
        { instruction: "Rank employees by revenue within each department (highest first). Show employee, department, revenue, and the rank as dept_rank.", hint: "RANK() OVER (PARTITION BY department ORDER BY revenue DESC)", solution: "SELECT employee, department, revenue, RANK() OVER (PARTITION BY department ORDER BY revenue DESC) AS dept_rank FROM sales" },
        { instruction: "Calculate a running total of revenue per employee, ordered by month. Show employee, month, revenue, and the running total as running_total.", hint: "SUM(revenue) OVER (PARTITION BY employee ORDER BY month)", solution: "SELECT employee, month, revenue, SUM(revenue) OVER (PARTITION BY employee ORDER BY month) AS running_total FROM sales" },
        { instruction: "Use LAG to show each employee's previous month revenue alongside the current. Show employee, month, revenue, and previous revenue as prev_revenue.", hint: "LAG(revenue, 1) OVER (PARTITION BY employee ORDER BY month)", solution: "SELECT employee, month, revenue, LAG(revenue, 1) OVER (PARTITION BY employee ORDER BY month) AS prev_revenue FROM sales" },
        { instruction: "Assign a ROW_NUMBER() to all sales ordered by revenue DESC. Show employee, revenue, and the number as row_num.", hint: "ROW_NUMBER() OVER (ORDER BY revenue DESC)", solution: "SELECT employee, revenue, ROW_NUMBER() OVER (ORDER BY revenue DESC) AS row_num FROM sales" }
    ],
    tests: [
        () => { const func = pick(['RANK()','DENSE_RANK()']); const dept = pick(['Engineering','Marketing','Sales']); return { type:'write', question:`Use ${func} to rank employees by revenue (DESC) within the '${dept}' department. Show employee, revenue, and the rank as rnk. Filter to department = '${dept}'.`, solution:`SELECT employee, revenue, ${func} OVER (ORDER BY revenue DESC) AS rnk FROM sales WHERE department = '${dept}'` }; },
        () => { const col = pick(['revenue','units_sold']); return { type:'write', question:`Calculate a running total of ${col} per employee ordered by month. Show employee, month, ${col}, and the running total as running_total.`, solution:`SELECT employee, month, ${col}, SUM(${col}) OVER (PARTITION BY employee ORDER BY month) AS running_total FROM sales` }; },
        () => ({ type:'write', question:'Use LAG to show each employee\'s previous month revenue. Show employee, month, revenue, and the lagged value as prev_revenue.', solution:'SELECT employee, month, revenue, LAG(revenue, 1) OVER (PARTITION BY employee ORDER BY month) AS prev_revenue FROM sales' }),
        () => ({ type:'mcq', question:'What is the difference between RANK() and DENSE_RANK()?', options:['RANK leaves gaps after ties, DENSE_RANK does not','DENSE_RANK leaves gaps after ties, RANK does not','They are identical','RANK only works with PARTITION BY'], answer:0 }),
        () => ({ type:'mcq', question:'What does PARTITION BY do in a window function?', options:['Divides rows into groups for the function to operate on','Filters rows from the result','Sorts the final output','Limits the number of rows returned'], answer:0 }),
        () => ({ type:'fix', question:'Fix this window function (missing OVER clause):', broken:"SELECT employee, revenue, RANK() AS rnk FROM sales;", solution:"SELECT employee, revenue, RANK() OVER (ORDER BY revenue DESC) AS rnk FROM sales;" }),
        () => ({ type:'fix', question:'Fix this window function (wrong ORDER BY placement):', broken:"SELECT employee, month, revenue, SUM(revenue) OVER (PARTITION BY employee) AS rt FROM sales ORDER BY month;", solution:"SELECT employee, month, revenue, SUM(revenue) OVER (PARTITION BY employee ORDER BY month) AS rt FROM sales;" }),
    ]
},

// --- Lesson 20: BETWEEN, IN & Column Aliases (Travel / Flights) ---
{
    id: 20,
    title: 'BETWEEN, IN & Column Aliases',
    theme: 'Travel \u2014 flights, prices, destinations',
    tutorial: `<h3>BETWEEN</h3>
<p><code>BETWEEN</code> checks if a value falls within an inclusive range:</p>
<div class="sql-example">SELECT * FROM flights WHERE price BETWEEN 200 AND 500;</div>
<p>This is equivalent to <code>price >= 200 AND price <= 500</code>. Use <code>NOT BETWEEN</code> for the inverse.</p>
<h3>IN</h3>
<p><code>IN</code> checks if a value matches any item in a list:</p>
<div class="sql-example">SELECT * FROM flights WHERE destination IN ('Tokyo', 'Paris', 'London');</div>
<p>Much cleaner than chaining <code>OR</code> conditions. Use <code>NOT IN</code> to exclude values.</p>
<h3>Column Aliases with AS</h3>
<p><code>AS</code> gives a column or expression a custom name in the output:</p>
<div class="sql-example">SELECT airline, price, duration_min,
  ROUND(1.0 * price / duration_min, 2) AS price_per_minute
FROM flights;</div>
<p>Aliases make calculated columns readable. They can also be used on tables in JOINs.</p>
<h3>Combining Operators</h3>
<p>You can combine BETWEEN, IN, and other conditions freely:</p>
<div class="sql-example">SELECT airline, destination, price FROM flights
WHERE destination IN ('Tokyo', 'Paris')
  AND price BETWEEN 300 AND 800;</div>
<div class="note">BETWEEN is inclusive on both ends: <code>BETWEEN 5 AND 10</code> includes 5 and 10. Works with numbers, text, and dates.</div>`,
    schema: `CREATE TABLE flights (id INT, airline TEXT, origin TEXT, destination TEXT, price INT, duration_min INT, departure_date TEXT, stops INT);
INSERT INTO flights VALUES (1,'SkyAir','New York','London',450,420,'2024-06-15',0),(2,'OceanWings','New York','Tokyo',850,840,'2024-06-16',1),(3,'EuroJet','New York','Paris',520,480,'2024-06-15',0),(4,'SkyAir','Chicago','London',380,450,'2024-06-17',0),(5,'PacificLine','Los Angeles','Tokyo',780,720,'2024-06-18',0),(6,'EuroJet','Chicago','Paris',490,510,'2024-06-19',1),(7,'SkyAir','New York','Berlin',610,540,'2024-06-20',1),(8,'OceanWings','Los Angeles','Sydney',1200,1020,'2024-06-21',1),(9,'PacificLine','Chicago','Tokyo',920,900,'2024-06-22',2),(10,'EuroJet','New York','London',420,430,'2024-06-23',0),(11,'SkyAir','Los Angeles','Paris',680,660,'2024-06-24',1),(12,'OceanWings','New York','Sydney',1350,1080,'2024-06-25',2),(13,'PacificLine','Chicago','Berlin',590,570,'2024-06-26',1),(14,'SkyAir','Los Angeles','London',510,600,'2024-06-27',1),(15,'EuroJet','Chicago','Sydney',1150,1050,'2024-06-28',2);`,
    schemaDisplay: 'flights(id INT, airline TEXT, origin TEXT, destination TEXT, price INT, duration_min INT, departure_date TEXT, stops INT)',
    defaultQuery: 'SELECT * FROM flights;',
    exercises: [
        { instruction: "Find all flights with a price BETWEEN 200 AND 500. Show airline, destination, and price.", hint: "WHERE price BETWEEN 200 AND 500", solution: "SELECT airline, destination, price FROM flights WHERE price BETWEEN 200 AND 500" },
        { instruction: "Find flights to Tokyo, Paris, or London using IN. Show airline, destination, and price.", hint: "WHERE destination IN ('Tokyo','Paris','London')", solution: "SELECT airline, destination, price FROM flights WHERE destination IN ('Tokyo','Paris','London')" },
        { instruction: "Calculate the price per minute for each flight (price / duration_min), rounded to 2 decimal places. Alias it as price_per_min. Show airline, destination, and price_per_min.", hint: "ROUND(1.0 * price / duration_min, 2) AS price_per_min", solution: "SELECT airline, destination, ROUND(1.0 * price / duration_min, 2) AS price_per_min FROM flights" },
        { instruction: "Find flights to destinations IN ('Tokyo','Paris') with a price BETWEEN 400 AND 800. Show airline, destination, and price.", hint: "Combine IN and BETWEEN in the WHERE clause", solution: "SELECT airline, destination, price FROM flights WHERE destination IN ('Tokyo','Paris') AND price BETWEEN 400 AND 800" }
    ],
    tests: [
        () => { const lo = pick([200,300,400]); const hi = pick([600,700,800]); return { type:'write', question:`Find flights with price BETWEEN ${lo} AND ${hi}. Show airline, destination, and price.`, solution:`SELECT airline, destination, price FROM flights WHERE price BETWEEN ${lo} AND ${hi}` }; },
        () => { const dests = pick([['Tokyo','London'],['Paris','Berlin'],['Sydney','Tokyo'],['London','Paris','Berlin']]); const inList = dests.map(d => `'${d}'`).join(','); return { type:'write', question:`Find flights to destinations IN (${inList}). Show airline, destination, and price.`, solution:`SELECT airline, destination, price FROM flights WHERE destination IN (${inList})` }; },
        () => { const stops = pick([0,1]); return { type:'write', question:`Find flights with ${stops} stops and price BETWEEN 400 AND 900. Show airline, destination, price, and stops.`, solution:`SELECT airline, destination, price, stops FROM flights WHERE stops = ${stops} AND price BETWEEN 400 AND 900` }; },
        () => ({ type:'mcq', question:'Is BETWEEN inclusive or exclusive of the boundary values?', options:['Inclusive on both ends','Exclusive on both ends','Inclusive start, exclusive end','Exclusive start, inclusive end'], answer:0 }),
        () => ({ type:'mcq', question:'What does the AS keyword do in a SELECT?', options:['Creates an alias (custom name) for a column or expression','Filters results','Joins tables','Sorts output'], answer:0 }),
        () => ({ type:'fix', question:'Fix this BETWEEN (wrong syntax):', broken:"SELECT * FROM flights WHERE price BETWEEN 200, 500;", solution:"SELECT * FROM flights WHERE price BETWEEN 200 AND 500;" }),
        () => ({ type:'fix', question:'Fix this IN clause (missing quotes around strings):', broken:"SELECT * FROM flights WHERE destination IN (Tokyo, Paris, London);", solution:"SELECT * FROM flights WHERE destination IN ('Tokyo', 'Paris', 'London');" }),
    ]
}
];

// Start the app
init();

})();
