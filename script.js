/* ── NexTask – Futuristic To-Do App ── */
'use strict';

/* ─── State ─── */
let tasks   = JSON.parse(localStorage.getItem('nextask_tasks')  || '[]');
let theme   = localStorage.getItem('nextask_theme') || 'dark';
let filter  = 'all';
let search  = '';
let dragSrc = null;

/* ─── DOM refs ─── */
const taskInput       = document.getElementById('taskInput');
const addBtn          = document.getElementById('addBtn');
const inputError      = document.getElementById('inputError');
const prioritySelect  = document.getElementById('prioritySelect');
const dueDateInput    = document.getElementById('dueDateInput');
const searchInput     = document.getElementById('searchInput');
const taskList        = document.getElementById('taskList');
const emptyState      = document.getElementById('emptyState');
const totalCount      = document.getElementById('totalCount');
const pendingCount    = document.getElementById('pendingCount');
const doneCount       = document.getElementById('doneCount');
const themeToggle     = document.getElementById('themeToggle');
const clearCompleted  = document.getElementById('clearCompletedBtn');
const toastContainer  = document.getElementById('toastContainer');
const filterBtns      = document.querySelectorAll('.filter-btn');

/* ─── Init ─── */
applyTheme(theme);
render();
initParticles();

/* ─── Event listeners ─── */
addBtn.addEventListener('click', addTask);
taskInput.addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });
taskInput.addEventListener('input', () => { if (inputError.classList.contains('visible')) hideError(); });
searchInput.addEventListener('input', e => { search = e.target.value.toLowerCase(); render(); });
themeToggle.addEventListener('click', toggleTheme);
clearCompleted.addEventListener('click', clearCompletedTasks);
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filter = btn.dataset.filter;
    render();
  });
});

/* ─── Add Task ─── */
function addTask() {
  const text = taskInput.value.trim();
  if (!text) { showError(); return; }

  const task = {
    id:        crypto.randomUUID(),
    text,
    priority:  prioritySelect.value,
    dueDate:   dueDateInput.value,
    completed: false,
    createdAt: Date.now(),
    order:     tasks.length
  };

  tasks.unshift(task);
  save();
  render();
  taskInput.value    = '';
  dueDateInput.value = '';
  prioritySelect.value = 'medium';
  hideError();
  toast('Task added successfully', 'success', '✅');
}

/* ─── CRUD ─── */
function deleteTask(id) {
  const card = document.querySelector(`[data-id="${id}"]`);
  if (card) {
    card.classList.add('removing');
    card.addEventListener('animationend', () => {
      tasks = tasks.filter(t => t.id !== id);
      save();
      render();
    }, { once: true });
  }
  toast('Task deleted', 'error', '🗑️');
}

function toggleComplete(id) {
  const t = tasks.find(t => t.id === id);
  if (t) {
    t.completed = !t.completed;
    save();
    render();
  }
}

function startEdit(id) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  const card  = document.querySelector(`[data-id="${id}"]`);
  const title = card.querySelector('.task-title');
  const actions = card.querySelector('.task-actions');

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'task-edit-input';
  input.value = t.text;
  title.replaceWith(input);
  input.focus();

  // swap edit for save
  const editBtn = actions.querySelector('.btn-edit');
  if (editBtn) {
    editBtn.classList.replace('btn-edit', 'btn-save');
    editBtn.textContent = '💾';
    editBtn.onclick = () => saveEdit(id, input);
  }
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveEdit(id, input);
    if (e.key === 'Escape') render();
  });
}

function saveEdit(id, input) {
  const text = input.value.trim();
  if (!text) return;
  const t = tasks.find(t => t.id === id);
  if (t) { t.text = text; save(); render(); }
  toast('Task updated', 'info', '✏️');
}

/* ─── Render ─── */
function render() {
  taskList.innerHTML = '';

  let visible = tasks.filter(t => {
    const matchSearch = t.text.toLowerCase().includes(search);
    if (!matchSearch) return false;
    if (filter === 'active')    return !t.completed;
    if (filter === 'completed') return  t.completed;
    return true;
  });

  if (visible.length === 0) {
    emptyState.classList.add('visible');
  } else {
    emptyState.classList.remove('visible');
    visible.forEach(t => taskList.appendChild(buildCard(t)));
  }

  updateStats();
}

function buildCard(t) {
  const card = document.createElement('div');
  card.className = `task-card${t.completed ? ' completed' : ''}`;
  card.dataset.id       = t.id;
  card.dataset.priority = t.priority;
  card.draggable = true;

  // Due date status
  let dueDateHTML = '';
  if (t.dueDate) {
    const due     = new Date(t.dueDate + 'T00:00:00');
    const today   = new Date(); today.setHours(0,0,0,0);
    const overdue = !t.completed && due < today;
    const label   = due.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
    dueDateHTML = `<span class="due-date${overdue ? ' overdue' : ''}">📅 ${label}</span>`;
  }

  const created = new Date(t.createdAt).toLocaleString('en-US', {
    month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'
  });

  card.innerHTML = `
    <input type="checkbox" class="task-check" ${t.completed ? 'checked' : ''} />
    <div class="task-body">
      <div class="task-title-wrap">
        <span class="task-title">${escHtml(t.text)}</span>
        <span class="priority-badge ${t.priority}">${t.priority.toUpperCase()}</span>
      </div>
      <div class="task-meta">
        <span>🕐 ${created}</span>
        ${dueDateHTML}
      </div>
    </div>
    <div class="task-actions">
      <button class="btn-icon btn-edit" title="Edit">✏️</button>
      <button class="btn-icon btn-delete" title="Delete">🗑</button>
    </div>
  `;

  card.querySelector('.task-check').addEventListener('change', () => toggleComplete(t.id));
  card.querySelector('.btn-edit').addEventListener('click', () => startEdit(t.id));
  card.querySelector('.btn-delete').addEventListener('click', () => deleteTask(t.id));

  // Drag & drop
  card.addEventListener('dragstart', onDragStart);
  card.addEventListener('dragover',  onDragOver);
  card.addEventListener('drop',      onDrop);
  card.addEventListener('dragend',   onDragEnd);

  return card;
}

/* ─── Stats ─── */
function updateStats() {
  const total   = tasks.length;
  const done    = tasks.filter(t => t.completed).length;
  const pending = total - done;
  totalCount.textContent   = total;
  doneCount.textContent    = done;
  pendingCount.textContent = pending;
}

/* ─── Drag & Drop ─── */
function onDragStart(e) {
  dragSrc = this;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}
function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.task-card').forEach(c => c.classList.remove('drag-over'));
  if (this !== dragSrc) this.classList.add('drag-over');
}
function onDrop(e) {
  e.stopPropagation();
  if (this === dragSrc) return;
  const srcId  = dragSrc.dataset.id;
  const destId = this.dataset.id;
  const srcIdx  = tasks.findIndex(t => t.id === srcId);
  const destIdx = tasks.findIndex(t => t.id === destId);
  const [removed] = tasks.splice(srcIdx, 1);
  tasks.splice(destIdx, 0, removed);
  save();
  render();
}
function onDragEnd() {
  document.querySelectorAll('.task-card').forEach(c => {
    c.classList.remove('dragging', 'drag-over');
  });
}

/* ─── Clear completed ─── */
function clearCompletedTasks() {
  const before = tasks.length;
  tasks = tasks.filter(t => !t.completed);
  if (tasks.length === before) { toast('No completed tasks to clear', 'info', '💡'); return; }
  save();
  render();
  toast('Completed tasks cleared', 'success', '🧹');
}

/* ─── Theme ─── */
function toggleTheme() {
  theme = theme === 'dark' ? 'light' : 'dark';
  applyTheme(theme);
  localStorage.setItem('nextask_theme', theme);
  toast(`${theme === 'light' ? 'Light' : 'Dark'} mode activated`, 'info', theme === 'light' ? '☀️' : '🌙');
}
function applyTheme(t) {
  document.body.classList.toggle('light-mode', t === 'light');
  document.body.classList.toggle('dark-mode',  t === 'dark');
  themeToggle.querySelector('.toggle-icon').textContent = t === 'dark' ? '🌙' : '☀️';
}

/* ─── Error helpers ─── */
function showError() {
  inputError.classList.add('visible');
  taskInput.focus();
  setTimeout(hideError, 2800);
}
function hideError() { inputError.classList.remove('visible'); }

/* ─── Toast ─── */
function toast(message, type = 'info', icon = 'ℹ️') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icon}</span><span>${message}</span>`;
  toastContainer.appendChild(el);
  setTimeout(() => {
    el.classList.add('hide');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, 3000);
}

/* ─── LocalStorage ─── */
function save() { localStorage.setItem('nextask_tasks', JSON.stringify(tasks)); }

/* ─── Utils ─── */
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ─── Particles ─── */
function initParticles() {
  const canvas = document.getElementById('particles');
  const ctx    = canvas.getContext('2d');
  let W, H, pts;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', () => { resize(); spawnPts(); });

  function spawnPts() {
    const n = Math.floor((W * H) / 18000);
    pts = Array.from({ length: n }, () => ({
      x:  Math.random() * W,
      y:  Math.random() * H,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r:  Math.random() * 1.5 + 0.5,
      a:  Math.random() * 0.5 + 0.1
    }));
  }
  spawnPts();

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const isDark = document.body.classList.contains('dark-mode');
    pts.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = isDark
        ? `rgba(0,229,255,${p.a})`
        : `rgba(138,43,226,${p.a * 0.5})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
}
