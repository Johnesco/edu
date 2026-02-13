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
    completed: new Array(15).fill(false),
    bestScores: new Array(15).fill(0),
    exercisesDone: Array.from({ length: 15 }, () => [])
});

let progress = defaultProgress();

function loadProgress() {
    try {
        const raw = localStorage.getItem('edu-sql-progress');
        if (raw) {
            const p = JSON.parse(raw);
            progress = { ...defaultProgress(), ...p };
            // ensure arrays are right length
            while (progress.completed.length < 15) progress.completed.push(false);
            while (progress.bestScores.length < 15) progress.bestScores.push(0);
            while (progress.exercisesDone.length < 15) progress.exercisesDone.push([]);
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
    $('progress-bar').style.width = `${(done / 15) * 100}%`;
    $('progress-text').textContent = `${done} / 15`;
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
    $('lesson-number').textContent = `Lesson ${lesson.id} of 15`;
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
    $('next-lesson').style.visibility = lesson.id < 15 ? 'visible' : 'hidden';

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
        if (currentLesson && currentLesson.id < 15) loadLesson(currentLesson.id + 1);
    });

    // Lesson nav
    $('prev-lesson').addEventListener('click', () => {
        if (currentLesson && currentLesson.id > 1) loadLesson(currentLesson.id - 1);
    });
    $('next-lesson').addEventListener('click', () => {
        if (currentLesson && currentLesson.id < 15) loadLesson(currentLesson.id + 1);
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
}
];

// Start the app
init();

})();
