'use strict';

/* ========================================================
   THEME — dark / light toggle (no localStorage persistence)
======================================================== */

function toggleTheme() {
    const isLight = document.body.classList.toggle('light');
    const icon = document.getElementById('theme-icon');
    if (isLight) {
        icon.classList.replace('fa-moon', 'fa-sun');
    } else {
        icon.classList.replace('fa-sun', 'fa-moon');
    }
}

/* ========================================================
   MOBILE SIDEBAR
======================================================== */
function toggleSidebar() {
    const sb  = document.querySelector('.sidebar');
    const bd  = document.getElementById('sb-backdrop');
    const open = sb.classList.toggle('open');
    bd.classList.toggle('show', open);
}

function closeSidebar() {
    document.querySelector('.sidebar').classList.remove('open');
    document.getElementById('sb-backdrop').classList.remove('show');
}

/* ========================================================
   DATA — loaded live from MySQL via api.php
======================================================== */
let DB_PLAYERS = [];
let DB_GAMEPASSES = [];
let DB_TRANSACTIONS = [];
let DB_AUDIT = [];

// legacy badge helpers kept for reports

/* ========================================================
   HELPERS
======================================================== */

const srcBadge = s =>
    `<span class="badge b-${s ?? 'unknown'}">${s ?? '&mdash;'}</span>`;

const actBadge = (a, label) =>
    a != null
        ? `<span class="badge ${a ? 'b-active' : 'b-banned'}"><span class="badge-dot"></span>${label ?? (a ? 'Active' : 'Inactive')}</span>`
        : '&mdash;';

const actionBadge = a =>
    `<span class="badge b-${a.toLowerCase()}">${a}</span>`;

/* ========================================================
   SCREEN NAVIGATION
======================================================== */
function go(id) {
    document.querySelectorAll('.auth-screen, .app-screen')
            .forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    /* reset recovery form on navigation */
    if (id !== 's-rec') {
        const ri = document.getElementById('r-ident');
        const rr = document.getElementById('rec-result');
        const re = document.getElementById('rec-err');
        if (ri) ri.value = '';
        if (rr) rr.style.display = 'none';
        if (re) re.style.display = 'none';
    }
}

/* enter key for login */
['l-user', 'l-pass'].forEach(id =>
    document.getElementById(id).addEventListener('keydown', e => {
        if (e.key === 'Enter') doLogin();
    })
);

/* password eye toggle on login */
document.getElementById('l-eye').addEventListener('click', function () {
    toggleEye('l-pass', this);
});

function toggleEye(inputId, icon) {
    const inp = document.getElementById(inputId);
    if (inp.type === 'password') {
        inp.type = 'text';
        icon.className = 'fa-solid fa-eye-slash eye';
    } else {
        inp.type = 'password';
        icon.className = 'fa-solid fa-eye eye';
    }
}

/* ========================================================
   AUTH — CREATE ACCOUNT (SIGN UP)
======================================================== */
function initBirthdayDropdowns() {
    const months = [
        'January','February','March','April','May','June',
        'July','August','September','October','November','December'
    ];
    const curYear = new Date().getFullYear();
    const groups = [
        ['su-month', 'su-day', 'su-year'],
    ];

    groups.forEach(([monthId, dayId, yearId]) => {
        const mSel = document.getElementById(monthId);
        const dSel = document.getElementById(dayId);
        const ySel = document.getElementById(yearId);
        if (!mSel || !dSel || !ySel) return;
        if (mSel.options.length > 1 && dSel.options.length > 1 && ySel.options.length > 1) {
            return;
        }

        mSel.innerHTML = '<option value="">Month</option>';
        dSel.innerHTML = '<option value="">Day</option>';
        ySel.innerHTML = '<option value="">Year</option>';

        months.forEach((m, i) => {
            const o = document.createElement('option');
            o.value       = String(i + 1).padStart(2, '0');
            o.textContent = m;
            mSel.appendChild(o);
        });

        for (let d = 1; d <= 31; d++) {
            const o = document.createElement('option');
            o.value       = String(d).padStart(2, '0');
            o.textContent = d;
            dSel.appendChild(o);
        }

        for (let y = curYear; y >= 1900; y--) {
            const o = document.createElement('option');
            o.value       = y;
            o.textContent = y;
            ySel.appendChild(o);
        }
    });
}

function suStrength() {
    const v = document.getElementById('su-pass').value;
    let s = 0;
    if (v.length >= 8)          s++;
    if (/[A-Z]/.test(v))        s++;
    if (/[0-9]/.test(v))        s++;
    if (/[^a-zA-Z0-9]/.test(v)) s++;
    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
    const colors = ['', '#e03c31', '#facc15', '#00a2ff', '#22c55e'];
    const pcts   = ['0%', '25%', '50%', '75%', '100%'];
    document.getElementById('su-str-label').textContent = `Strength: ${labels[s] || '—'}`;
    const bar = document.getElementById('su-str-bar');
    bar.style.width      = pcts[s];
    bar.style.background = colors[s] || 'transparent';
}

function pickGender(el) {
    el.closest('.gender-row')?.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('picked'));
    el.classList.add('picked');
}

/* ========================================================
   APP NAVIGATION
======================================================== */
const PAGE_TITLES = {
    'p-dash':       'Dashboard',
    'p-accounts':   'Accounts',
    'p-players':    'Players',
    'p-gamepasses': 'Game Passes',
    'p-audit':      'Audit Log',
    'p-reports':    'Report Generator',
    'p-about':      'About',
};

function showPage(pid, navEl) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.sb-item').forEach(n => n.classList.remove('active'));
    document.getElementById(pid).classList.add('active');
    navEl.classList.add('active');
    document.getElementById('tb-title').textContent = PAGE_TITLES[pid] || '';
    /* close sidebar on mobile after nav */
    if (window.innerWidth <= 700) closeSidebar();
}

/* ========================================================
   RENDER
======================================================== */
function updateDate() {
    document.getElementById('tb-date').textContent =
        new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderTx(data) {
    const tb = document.getElementById('tb-tx');
    if (!data || !data.length) {
        tb.innerHTML = '<tr><td colspan="4"><div class="empty"><i class="fa-solid fa-receipt"></i><p>No transactions found.</p></div></td></tr>';
        return;
    }
    tb.innerHTML = data.map(r => `
        <tr>
            <td><b>${esc(r.uname)}</b></td>
            <td><span class="ptag"><i class="fa-solid fa-ticket"></i>${esc(r.gname)}</span></td>
            <td>${srcBadge(r.src)}</td>
            <td>${actBadge(Number(r.act))}</td>
        </tr>`).join('');
}

function renderPriceBars(data) {
    if (!data || !data.length) return;
    const max = Math.max(...data.map(g => Number(g.price)));
    document.getElementById('price-bars').innerHTML = data.map(g => {
        const pct = max > 0 ? Math.round(Number(g.price) / max * 100) : 4;
        return `<div class="bar-item">
            <div class="bar-name">${esc(g.gname)}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
            <div class="bar-val">${Number(g.price) ? 'R$' + g.price : 'Free'}</div>
        </div>`;
    }).join('');
}

function renderPlayers(data) {
    const tb = document.getElementById('tb-players');
    if (!data.length) {
        tb.innerHTML = '<tr><td colspan="6"><div class="empty"><i class="fa-solid fa-users-slash"></i><p>No players found.</p></div></td></tr>';
        return;
    }
    const canEdit = canManageOperations();
    tb.innerHTML = data.map(p => `
        <tr>
            <td style="color:var(--text-3);font-size:.78rem;">${esc(p.pid)}</td>
            <td><b>${esc(p.uname)}</b></td>
            <td style="color:var(--text-2);">${esc(p.jdate)}</td>
            <td>${actBadge(p.stat === 'active' ? 1 : 0, p.stat)}</td>
            <td><span class="ptag"><i class="fa-solid fa-ticket"></i>${esc(p.pass_count ?? 0)} pass${(p.pass_count ?? 0) != 1 ? 'es' : ''}</span></td>
            <td>
                ${canEdit ? `<button class="btn btn-ghost" onclick="toggleBan(${Number(p.pid)}, '${jsString(p.uname)}', '${jsString(p.stat)}')"
                        style="padding:5px 11px;font-size:.75rem;">
                    <i class="fa-solid fa-${p.stat === 'active' ? 'ban' : 'rotate-left'}"></i>
                    ${p.stat === 'active' ? 'Ban' : 'Unban'}
                </button>` : `<span style="color:var(--text-3);font-size:.76rem;"><i class="fa-solid fa-eye"></i> View only</span>`}
            </td>
        </tr>`).join('');
}

function renderGP(data) {
    const tb = document.getElementById('tb-gp');
    if (!data.length) {
        tb.innerHTML = '<tr><td colspan="7"><div class="empty"><i class="fa-solid fa-ticket"></i><p>No passes found.</p></div></td></tr>';
        return;
    }

    const canEdit = canManageOperations();
    const canBuy = CURRENT_USER?.role === 'user';
    tb.innerHTML = data.map(g => `
        <tr>
            <td style="color:var(--text-3);font-size:.78rem;">${esc(g.gpid)}</td>
            <td><b>${esc(g.gname)}</b></td>
            <td style="color:var(--text-2);">${esc(g.descr)}</td>
            <td style="font-weight:800;color:var(--yellow);">${Number(g.price) ? 'R$ ' + g.price : '<span style="color:var(--green);">Free</span>'}</td>
            <td><span class="ptag">${esc(g.benefit)}</span></td>
            <td><span class="badge ${Number(g.sale) ? 'b-on' : 'b-off'}"><span class="badge-dot"></span>${Number(g.sale) ? 'On Sale' : 'Off Sale'}</span></td>
            <td style="display:flex;gap:4px;flex-wrap:wrap;">
                ${canEdit ? `
                    <button class="btn btn-ghost" onclick="openEditGamepass(${Number(g.gpid)})" style="padding:5px 11px;font-size:.75rem;">
                        <i class="fa-solid fa-pen"></i> Edit
                    </button>
                    <button class="btn btn-ghost" onclick="deleteGamepass(${Number(g.gpid)}, '${jsString(g.gname)}')" style="padding:5px 11px;font-size:.75rem;color:var(--red);">
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                ` : canBuy ? `
                    <button class="btn btn-ghost" onclick="buyGamepass(${Number(g.gpid)}, '${jsString(g.gname)}')" style="padding:5px 11px;font-size:.75rem;" ${Number(g.sale) !== 1 || ownsGamepass(g.gpid) ? 'disabled' : ''}>
                        <i class="fa-solid fa-cart-shopping"></i> ${ownsGamepass(g.gpid) ? 'Owned' : (Number(g.sale) === 1 ? 'Buy' : 'Off Sale')}
                    </button>
                    ${ownsGamepass(g.gpid) ? `
                        <button class="btn btn-ghost" onclick="printReceipt(${Number(g.gpid)}, '${jsString(g.gname)}')" style="padding:5px 11px;font-size:.75rem;">
                            <i class="fa-solid fa-receipt"></i> Receipt
                        </button>
                    ` : ''}
                ` : `<span style="color:var(--text-3);font-size:.76rem;"><i class="fa-solid fa-eye"></i> View only</span>`}
            </td>
        </tr>`).join('');
}

function ownsGamepass(gpid) {
    const username = String(CURRENT_USER?.username || '').toLowerCase();
    if (!username) return false;
    return DB_TRANSACTIONS.some(tx => {
        const txUser = String(tx.uname || '').toLowerCase();
        return Number(tx.gpid) === Number(gpid) && Number(tx.act) === 1 && txUser === username;
    });
}

function renderAudit(data) {
    const tb = document.getElementById('tb-audit');
    const chip = document.querySelector('#p-audit .chip');
    if (chip) {
        chip.textContent = `${data?.length || 0} record${(data?.length || 0) === 1 ? '' : 's'}`;
    }
    if (!data || !data.length) {
        tb.innerHTML = '<tr><td colspan="7"><div class="empty"><i class="fa-solid fa-clock-rotate-left"></i><p>No audit records.</p></div></td></tr>';
        return;
    }
    tb.innerHTML = data.map(a => `
        <tr>
            <td style="color:var(--text-3);font-size:.78rem;">${esc(a.id)}</td>
            <td><span class="badge b-unknown">${esc(a.module || 'system')}</span></td>
            <td>${actionBadge(a.action)}</td>
            <td><b>${esc(a.actor || '-')}</b></td>
            <td><span class="ptag">${esc(a.target || '-')}</span></td>
            <td style="color:var(--text-2);max-width:320px;">${esc(a.details || '-')}</td>
            <td style="color:var(--text-3);font-size:.76rem;">${esc(a.ts)}</td>
        </tr>`).join('');
}

function updateDashStats(s) {
    if (!s) return;
    const vals = document.querySelectorAll('.si-val');
    if (vals[0]) vals[0].textContent = s.total;
    if (vals[1]) vals[1].textContent = s.active;
    if (vals[2]) vals[2].textContent = s.banned;
    if (vals[3]) vals[3].textContent = s.passes;
    if (vals[4]) vals[4].textContent = 'R$' + s.revenue;
    const subs = document.querySelectorAll('.si-sub');
    if (subs[0]) subs[0].textContent = 'All registered players';
    if (subs[1]) subs[1].textContent = (s.total > 0 ? Math.round(s.active/s.total*100) : 0) + '% activity rate';
    if (subs[2]) subs[2].textContent = s.banned + ' banned';
    if (subs[3]) subs[3].textContent = s.onsale + ' currently on sale';
    if (subs[4]) subs[4].textContent = 'From active purchases';
}

/* ========================================================
   PLAYER ACTIONS
======================================================== */
async function loadPlayers(search = '') {
    const res = await apiPost('players', { search });
    if (!res.ok) { toast('err', res.message); return; }
    DB_PLAYERS = res.players || [];
    renderPlayers(DB_PLAYERS);
}

async function loadGamepasses(search = '') {
    const res = await apiPost('gamepasses', { search });
    if (!res.ok) { toast('err', res.message); return; }
    DB_GAMEPASSES = res.gamepasses || [];
    renderGP(DB_GAMEPASSES);
}

async function loadTransactions() {
    const res = await apiPost('transactions');
    if (!res.ok) return;
    DB_TRANSACTIONS = res.transactions || [];
    renderTx(DB_TRANSACTIONS);
    /* Re-render catalog actions once ownership data is available. */
    renderGP(DB_GAMEPASSES);
    renderPriceBars(DB_GAMEPASSES);
}

async function loadAudit() {
    const res = await apiPost('audit');
    if (!res.ok) return;
    DB_AUDIT = res.audit || [];
    renderAudit(DB_AUDIT);
}

async function loadStats() {
    const res = await apiPost('stats');
    if (res.ok) updateDashStats(res.stats);
}

function filterPlayers() {
    loadPlayers(document.getElementById('pl-search').value.trim());
}

function filterGP() {
    loadGamepasses(document.getElementById('gp-search').value.trim());
}

async function toggleBan(pid, uname, currentStat) {
    if (!canManageOperations()) { toast('err', 'Only staff/admin can update players.'); return; }
    const newStat = currentStat === 'active' ? 'banned' : 'active';
    const res = await apiPost('toggle_player_status', { pid, stat: newStat });
    if (!res.ok) { toast('err', res.message); return; }
    toast(newStat === 'banned' ? 'err' : 'ok',
        `${uname} has been ${newStat === 'banned' ? 'banned' : 'unbanned'}.`);
    loadPlayers(document.getElementById('pl-search').value.trim());
}

function openModal(id) {
    if (id === 'm-addaccount') initBirthdayDropdowns();

    const apDate = document.getElementById('ap-date');
    if (apDate) apDate.value = new Date().toISOString().split('T')[0];
    const aaBirthday = document.getElementById('aa-birthday');
    if (id === 'm-addaccount' && aaBirthday) {
        aaBirthday.max = new Date().toISOString().split('T')[0];
    }
    const eaBirthday = document.getElementById('ea-birthday');
    if (id === 'm-editaccount' && eaBirthday) {
        eaBirthday.max = new Date().toISOString().split('T')[0];
    }
    document.getElementById(id).classList.add('open');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('open');
}

async function addPlayer() {
    if (!canManageOperations()) { toast('err', 'Only staff/admin can add players.'); return; }
    const uname = document.getElementById('ap-name').value.trim();
    const jdate = document.getElementById('ap-date').value;
    const stat  = document.getElementById('ap-status').value;
    if (!uname) { toast('err', 'Username is required.'); return; }
    const res = await apiPost('add_player', { uname, jdate, stat });
    if (!res.ok) { toast('err', res.message); return; }
    toast('ok', `Player "${uname}" added successfully!`);
    document.getElementById('ap-name').value = '';
    closeModal('m-addplayer');
    loadPlayers();
    loadStats();
    loadAudit();
}

async function addGamepass() {
    if (!canManageOperations()) { toast('err', 'Only staff/admin can add passes.'); return; }
    const gname = document.getElementById('gp-name').value.trim();
    const descr = document.getElementById('gp-desc').value.trim();
    const benefit = document.getElementById('gp-benefit').value.trim();
    const price = document.getElementById('gp-price').value;
    const sale = document.getElementById('gp-sale').value;

    if (!gname) { toast('err', 'Pass name is required.'); return; }
    const res = await apiPost('add_gamepass', { gname, descr, benefit, price, sale });
    if (!res.ok) { toast('err', res.message); return; }

    toast('ok', res.message);
    ['gp-name', 'gp-desc', 'gp-benefit'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('gp-price').value = '0';
    document.getElementById('gp-sale').value = '1';
    closeModal('m-addpass');
    loadGamepasses(document.getElementById('gp-search').value.trim());
    loadStats();
    loadAudit();
}

function openEditGamepass(gpid) {
    if (!canManageOperations()) { toast('err', 'Only staff/admin can edit passes.'); return; }
    const pass = DB_GAMEPASSES.find(g => Number(g.gpid) === Number(gpid));
    if (!pass) return;

    document.getElementById('egp-id').value = pass.gpid;
    document.getElementById('egp-name').value = pass.gname || '';
    document.getElementById('egp-desc').value = pass.descr || '';
    document.getElementById('egp-benefit').value = pass.benefit || '';
    document.getElementById('egp-price').value = Number(pass.price) || 0;
    document.getElementById('egp-sale').value = Number(pass.sale) ? '1' : '0';
    openModal('m-editpass');
}

async function updateGamepass() {
    if (!canManageOperations()) { toast('err', 'Only staff/admin can update passes.'); return; }
    const gpid = document.getElementById('egp-id').value;
    const gname = document.getElementById('egp-name').value.trim();
    const descr = document.getElementById('egp-desc').value.trim();
    const benefit = document.getElementById('egp-benefit').value.trim();
    const price = document.getElementById('egp-price').value;
    const sale = document.getElementById('egp-sale').value;

    if (!gname) { toast('err', 'Pass name is required.'); return; }
    const res = await apiPost('update_gamepass', { gpid, gname, descr, benefit, price, sale });
    if (!res.ok) { toast('err', res.message); return; }

    toast('ok', res.message);
    closeModal('m-editpass');
    loadGamepasses(document.getElementById('gp-search').value.trim());
    loadStats();
    loadAudit();
}

async function deleteGamepass(gpid, gname) {
    if (!canManageOperations()) { toast('err', 'Only staff/admin can delete passes.'); return; }
    if (!confirm(`Delete game pass "${gname}"? This cannot be undone.`)) return;
    const res = await apiPost('delete_gamepass', { gpid });
    if (!res.ok) { toast('err', res.message); return; }

    toast('ok', res.message);
    loadGamepasses(document.getElementById('gp-search').value.trim());
    loadStats();
    loadAudit();
}

async function buyGamepass(gpid, gname) {
    if ((CURRENT_USER?.role || '') !== 'user') {
        toast('err', 'Only user accounts can buy game passes.');
        return;
    }

    const res = await apiPost('buy_gamepass', { gpid });
    if (!res.ok) {
        toast('err', res.message);
        return;
    }

    toast('ok', res.message || `Purchased "${gname}".`);
    await Promise.all([
        loadTransactions(),
        loadGamepasses(document.getElementById('gp-search').value.trim()),
        loadStats(),
        loadAudit()
    ]);
}

function printReceipt(gpid, gname) {
    if ((CURRENT_USER?.role || '') !== 'user') {
        toast('err', 'Receipt printing is available for user purchases only.');
        return;
    }

    const tx = DB_TRANSACTIONS.find(r =>
        r.uname === CURRENT_USER.username &&
        Number(r.gpid) === Number(gpid) &&
        Number(r.act) === 1
    );
    if (!tx) {
        toast('err', 'No active purchase found for this game pass.');
        return;
    }

    const gp = DB_GAMEPASSES.find(g => Number(g.gpid) === Number(gpid));
    const priceLabel = Number(gp?.price) ? `R$ ${gp.price}` : 'Free';
    const receiptNo = `RCPT-${String(gpid).padStart(4, '0')}-${Date.now().toString().slice(-6)}`;
    const when = new Date().toLocaleString();

    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><title>Purchase Receipt</title>
    <style>
        body{font-family:Arial,sans-serif;padding:26px;color:#111}
        .wrap{max-width:560px;margin:0 auto;border:1px solid #ddd;border-radius:8px;padding:20px}
        h1{font-size:20px;margin:0 0 8px}
        .muted{color:#666;font-size:12px;margin-bottom:14px}
        table{width:100%;border-collapse:collapse}
        td{padding:8px 0;border-bottom:1px dashed #ddd;font-size:13px}
        td:first-child{color:#555;width:42%}
        .total{font-weight:700;font-size:15px}
    </style></head><body>
      <div class="wrap">
        <h1>RBXGPM Purchase Receipt</h1>
        <div class="muted">Receipt #${receiptNo}</div>
        <table>
          <tr><td>Buyer</td><td><b>${esc(CURRENT_USER.username)}</b></td></tr>
          <tr><td>Game Pass</td><td><b>${esc(gname)}</b></td></tr>
          <tr><td>Source</td><td>${esc(tx.src || 'purchase')}</td></tr>
          <tr><td>Status</td><td>${Number(tx.act) === 1 ? 'Active' : 'Inactive'}</td></tr>
          <tr><td>Issued At</td><td>${when}</td></tr>
          <tr><td class="total">Amount</td><td class="total">${priceLabel}</td></tr>
        </table>
      </div>
    </body></html>`);
    w.document.close();
    w.print();
}

/* close modal on backdrop click */
document.querySelectorAll('.modal-bg').forEach(bg =>
    bg.addEventListener('click', e => { if (e.target === bg) bg.classList.remove('open'); })
);

/* ========================================================
   REPORT GENERATOR
======================================================== */
let currentReport = 'player-summary';

function pickReport(el, type) {
    document.querySelectorAll('.rtype').forEach(r => r.classList.remove('sel'));
    el.classList.add('sel');
    currentReport = type;
    document.getElementById('rpt-out').style.display = 'none';
}

function genReport() {
    const out   = document.getElementById('rpt-out');
    const body  = document.getElementById('rpt-body');
    const title = document.getElementById('rpt-title');
    const ts    = document.getElementById('rpt-ts');

    out.style.display = 'block';
    ts.textContent    = 'Generated: ' + new Date().toLocaleString();

    switch (currentReport) {
        case 'player-summary':
            title.textContent = 'Player Summary Report';
            body.innerHTML = `<table>
                <thead><tr><th>PID</th><th>Username</th><th>Join Date</th><th>Status</th><th>Passes</th></tr></thead>
                <tbody>${DB_PLAYERS.map(p => `<tr>
                    <td>${esc(p.pid)}</td><td><b>${esc(p.uname)}</b></td><td>${esc(p.jdate)}</td>
                    <td>${actBadge(p.stat === 'active' ? 1 : 0, p.stat)}</td>
                    <td>${esc(p.pass_count ?? 0)}</td>
                </tr>`).join('')}</tbody>
            </table>`;
            break;

        case 'revenue': {
            title.textContent = 'Revenue Report';
            const rev = DB_TRANSACTIONS
                .filter(r => r.src === 'purchase' && Number(r.act) === 1)
                .reduce((s, r) => s + (Number(DB_GAMEPASSES.find(g => g.gname === r.gname)?.price) || 0), 0);
            body.innerHTML = `
                <div style="padding:16px 16px 0;">
                    <div class="alert alert-ok">
                        <i class="fa-solid fa-coins"></i>
                        <span>Total Revenue from Active Purchases: <b>R$ ${rev}</b></span>
                    </div>
                </div>
                <table>
                    <thead><tr><th>GPID</th><th>Name</th><th>Price (R$)</th><th>Benefit</th><th>For Sale</th></tr></thead>
                    <tbody>${DB_GAMEPASSES.map(g => `<tr>
                        <td>${esc(g.gpid)}</td><td><b>${esc(g.gname)}</b></td>
                        <td style="font-weight:800;color:var(--yellow);">${Number(g.price) ? 'R$ ' + g.price : 'Free'}</td>
                        <td>${esc(g.benefit)}</td>
                        <td><span class="badge ${Number(g.sale) ? 'b-on' : 'b-off'}">${Number(g.sale) ? 'On Sale' : 'Off Sale'}</span></td>
                    </tr>`).join('')}</tbody>
                </table>`;
            break;
        }

        case 'ownership':
            title.textContent = 'Pass Ownership Report';
            body.innerHTML = `<table>
                <thead><tr><th>Player</th><th>Game Pass</th><th>Source</th><th>Status</th></tr></thead>
                <tbody>${DB_TRANSACTIONS.map(r => `<tr>
                    <td><b>${esc(r.uname)}</b></td>
                    <td><span class="ptag"><i class="fa-solid fa-ticket"></i>${esc(r.gname)}</span></td>
                    <td>${srcBadge(r.src)}</td>
                    <td>${actBadge(Number(r.act))}</td>
                </tr>`).join('')}</tbody>
            </table>`;
            break;

        case 'audit':
            title.textContent = 'Audit Log Report';
            body.innerHTML = `<table>
                <thead><tr>
                    <th>ID</th><th>Module</th><th>Action</th><th>Actor</th><th>Target</th><th>Details</th><th>Timestamp</th>
                </tr></thead>
                <tbody>${DB_AUDIT.map(a => `<tr>
                    <td>${esc(a.id)}</td>
                    <td>${esc(a.module || 'system')}</td>
                    <td>${actionBadge(a.action)}</td>
                    <td><b>${esc(a.actor || '-')}</b></td>
                    <td>${esc(a.target || '-')}</td>
                    <td>${esc(a.details || '-')}</td>
                    <td style="font-size:.76rem;">${esc(a.ts)}</td>
                </tr>`).join('')}</tbody>
            </table>`;
            break;
    }

    toast('ok', 'Report generated successfully!');
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function printReport() {
    const content = document.getElementById('rpt-body').innerHTML;
    if (!content) { toast('err', 'Generate a report first.'); return; }
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><title>RBXGPM Report &mdash; ${
        document.getElementById('rpt-title').textContent
    }</title>
    <style>
        body { font-family:Arial,sans-serif; padding:28px; color:#111; }
        h1   { font-size:18px; margin-bottom:4px; }
        p    { font-size:11px; color:#666; margin-bottom:16px; }
        table{ width:100%; border-collapse:collapse; font-size:12px; }
        th   { background:#f5f5f5; padding:8px 10px; border:1px solid #ddd;
               text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:.5px; }
        td   { padding:7px 10px; border:1px solid #eee; }
        tr:nth-child(even) td { background:#fafafa; }
        .badge { padding:2px 8px; border-radius:10px; font-size:10px; font-weight:700; display:inline-block; }
        .b-active  { background:#dcfce7; color:#16a34a; }
        .b-banned  { background:#fee2e2; color:#dc2626; }
        .b-insert  { background:#dcfce7; color:#16a34a; }
        .b-update  { background:#dbeafe; color:#2563eb; }
        .b-delete  { background:#fee2e2; color:#dc2626; }
        .b-purchase{ background:#dbeafe; color:#2563eb; }
        .b-gift    { background:#dcfce7; color:#16a34a; }
        .b-promo   { background:#ede9fe; color:#7c3aed; }
        .b-admin   { background:#fee2e2; color:#dc2626; }
        .b-on      { background:#dbeafe; color:#2563eb; }
        .b-off     { background:#fef9c3; color:#ca8a04; }
        .ptag      { font-size:11px; background:#f0f0f0; padding:2px 7px; border-radius:4px; display:inline-block; }
        .alert-ok  { background:#dcfce7; border:1px solid #86efac; padding:10px 14px;
                     border-radius:6px; font-size:12px; margin-bottom:14px; color:#166534; }
    </style></head><body>
    <h1>RBXGPM &mdash; ${document.getElementById('rpt-title').textContent}</h1>
    <p>${document.getElementById('rpt-ts').textContent}</p>
    ${content}
    </body></html>`);
    w.document.close();
    w.print();
}

/* ========================================================
   TOAST NOTIFICATIONS
======================================================== */
function toast(type, msg) {
    const icons = { ok: 'fa-circle-check', err: 'fa-circle-exclamation', info: 'fa-circle-info' };
    const el    = document.createElement('div');
    el.className = `toast t-${type}`;
    el.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${msg}</span>`;
    document.getElementById('toast-box').appendChild(el);
    setTimeout(() => el.remove(), 3800);
}

/* ========================================================
   PHP + MYSQL BACKEND
======================================================== */
const API_CANDIDATES = (() => {
    const set = new Set([
        new URL('api.php', window.location.href).href,
        `${window.location.protocol}//127.0.0.1:8000/api.php`,
        `${window.location.protocol}//localhost:8000/api.php`,
        `${window.location.protocol}//127.0.0.1/EDP/api.php`,
        `${window.location.protocol}//localhost/EDP/api.php`,
    ]);
    return Array.from(set);
})();
let API_URL = null;
let API_DETECTION_PROMISE = null;

async function resolveApiUrl() {
    if (API_URL) return API_URL;
    if (API_DETECTION_PROMISE) return API_DETECTION_PROMISE;

    API_DETECTION_PROMISE = (async () => {
        for (const candidate of API_CANDIDATES) {
            try {
                const probeBody = new URLSearchParams({ action: 'session' });
                const res = await fetch(candidate, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    credentials: 'include',
                    body: probeBody
                });
                const text = await res.text();
                const parsed = JSON.parse(text);
                if (parsed && typeof parsed === 'object' && Object.prototype.hasOwnProperty.call(parsed, 'ok')) {
                    API_URL = candidate;
                    return candidate;
                }
            } catch (error) {
                /* try next candidate */
            }
        }
        API_URL = new URL('api.php', window.location.href).href;
        return API_URL;
    })();

    return API_DETECTION_PROMISE;
}
let ACCOUNT_ROWS = [];
let CURRENT_USER = null;

function roleLabel(role) {
    if (role === 'admin') return 'Super Administrator';
    if (role === 'staff') return 'Staff';
    return 'User';
}

function roleBadge(role) {
    const map = {
        admin: ['b-delete',  'fa-shield-halved', 'Admin'],
        staff: ['b-promo',   'fa-user-gear',     'Staff'],
        user:  ['b-unknown', 'fa-user',          'User'],
    };
    const [cls, icon, label] = map[role] || map.user;
    return `<span class="badge ${cls}"><i class="fa-solid ${icon}" style="margin-right:4px;font-size:.7rem;"></i>${label}</span>`;
}

function showLoggedInUser(user) {
    CURRENT_USER = user || null;
    if (!CURRENT_USER?.username) return;

    document.getElementById('sb-uname').textContent = CURRENT_USER.username;
    document.getElementById('sb-av').textContent = CURRENT_USER.username[0].toUpperCase();
    document.querySelector('.sb-urole').textContent = roleLabel(CURRENT_USER.role);
    applyRoleUI(CURRENT_USER.role);
    go('s-app');
    renderAll();

    if (CURRENT_USER.role === 'user') {
        toast('info', 'User mode: you can buy on-sale game passes from the catalog.');
    }
}

const esc = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const jsString = value => String(value ?? '')
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'")
    .replaceAll('\r', '\\r')
    .replaceAll('\n', '\\n')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

async function apiPost(action, data = {}) {
    if (window.location.protocol === 'file:') {
        return {
            ok: false,
            message: 'Please open this app through a PHP server, for example http://127.0.0.1:8000/lumbis-activity-4.html. Opening the HTML file directly cannot save accounts to MySQL.',
        };
    }

    const activeApiUrl = await resolveApiUrl();
    const body = new URLSearchParams({ action });
    Object.entries(data).forEach(([key, value]) => body.append(key, value ?? ''));

    let response;
    try {
        response = await fetch(activeApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            credentials: 'include',
            body
        });
    } catch (error) {
        return {
            ok: false,
            message: `Cannot reach API (${activeApiUrl}). Run this through Apache/XAMPP and make sure api.php is accessible.`,
        };
    }

    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch (error) {
        return {
            ok: false,
            message: text.trim() || `api.php did not return valid JSON from ${activeApiUrl}. Please open this through XAMPP/Apache.`,
        };
    }
}

async function doLogin() {
    const user = document.getElementById('l-user').value.trim();
    const pass = document.getElementById('l-pass').value;
    const btn  = document.getElementById('l-btn');
    const err  = document.getElementById('login-err');

    if (!user || !pass) {
        err.querySelector('span').textContent = 'Username and password are required.';
        err.style.display = 'flex';
        return;
    }

    btn.innerHTML = '<span class="spin"></span> Logging in&hellip;';
    btn.disabled  = true;

    try {
        const res = await apiPost('login', { username: user, password: pass });
        if (!res.ok) {
            err.querySelector('span').textContent = res.message || 'Invalid username or password.';
            err.style.display = 'flex';
            return;
        }

        err.style.display = 'none';
        showLoggedInUser(res.user);
        toast('ok', `Welcome back, ${res.user.username}!`);
    } catch (error) {
        err.querySelector('span').textContent = 'Unable to connect to api.php.';
        err.style.display = 'flex';
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Log In';
        btn.disabled  = false;
    }
}

async function doLogout() {
    await apiPost('logout');
    CURRENT_USER = null;
    go('s-login');
    document.getElementById('l-user').value = '';
    document.getElementById('l-pass').value = '';
    toast('info', 'You have been logged out.');
}

async function doSignup() {
    const month   = document.getElementById('su-month').value;
    const day     = document.getElementById('su-day').value;
    const year    = document.getElementById('su-year').value;
    const uname   = document.getElementById('su-user').value.trim();
    const pass    = document.getElementById('su-pass').value;
    const confirm = document.getElementById('su-confirm').value;
    const gender  = document.querySelector('#s-signup .gender-btn.picked')?.dataset.value || '';
    const btn     = document.getElementById('su-btn');

    if (!month || !day || !year) { toast('err', 'Please enter your birthday.'); return; }
    if (!uname) { toast('err', 'Username is required.'); return; }
    if (!/^[a-zA-Z0-9_]{3,50}$/.test(uname)) {
        toast('err', 'Username must be 3-50 characters (letters, numbers, underscores only).');
        return;
    }
    if (pass.length < 8) { toast('err', 'Password must be at least 8 characters.'); return; }
    if (pass !== confirm) { toast('err', 'Passwords do not match.'); return; }

    btn.innerHTML = '<span class="spin"></span> Creating account&hellip;';
    btn.disabled  = true;

    try {
        const res = await apiPost('signup', {
            username: uname,
            password: pass,
            confirm_password: confirm,
            birthday: `${year}-${month}-${day}`,
            gender
        });

        if (!res.ok) {
            toast('err', res.message);
            return;
        }

        toast('ok', res.message);
        document.getElementById('su-month').value = '';
        document.getElementById('su-day').value = '';
        document.getElementById('su-year').value = '';
        document.getElementById('su-user').value = '';
        document.getElementById('su-pass').value = '';
        document.getElementById('su-confirm').value = '';
        document.getElementById('su-str-bar').style.width = '0';
        document.getElementById('su-str-label').textContent = 'Strength: \u2014';
        document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('picked'));
        if (res.user?.username) {
            showLoggedInUser(res.user);
        } else {
            document.getElementById('l-user').value = uname;
            go('s-login');
        }
    } catch (error) {
        toast('err', 'Unable to connect to api.php.');
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Sign Up';
        btn.disabled  = false;
    }
}

async function recLookup() {
    const uname = document.getElementById('r-ident').value.trim();
    const pass = document.getElementById('r-pass').value;
    const confirm = document.getElementById('r-confirm').value;
    const result = document.getElementById('rec-result');
    const err = document.getElementById('rec-err');
    result.style.display = 'none';
    err.style.display = 'none';

    if (!uname) { toast('err', 'Please enter your username.'); return; }
    if (pass.length < 8) { toast('err', 'New password must be at least 8 characters.'); return; }
    if (pass !== confirm) { toast('err', 'Passwords do not match.'); return; }

    try {
        const res = await apiPost('recover', {
            username: uname,
            password: pass,
            confirm_password: confirm
        });

        if (!res.ok) {
            document.getElementById('rec-err-msg').textContent = res.message;
            err.style.display = 'flex';
            return;
        }

        document.getElementById('rec-msg').textContent = res.message;
        result.style.display = 'flex';
        document.getElementById('r-pass').value = '';
        document.getElementById('r-confirm').value = '';
    } catch (error) {
        document.getElementById('rec-err-msg').textContent = 'Unable to connect to api.php.';
        err.style.display = 'flex';
    }
}

function applyRoleUI(role) {
    const isAdmin = role === 'admin';
    const isStaff = role === 'staff';

    const hidden = isAdmin
        ? []
        : isStaff
            ? ['p-accounts']
            : ['p-accounts', 'p-players', 'p-audit', 'p-reports'];

    hidden.forEach(pid => {
        const nav = document.querySelector(`.sb-item[onclick*="${pid}"]`);
        if (nav) nav.style.display = 'none';
    });
    if (!hidden.length) {
        document.querySelectorAll('.sb-item').forEach(nav => {
            nav.style.display = '';
        });
    } else if (isStaff) {
        document.querySelectorAll('.sb-item').forEach(nav => {
            const onclick = nav.getAttribute('onclick') || '';
            if (!onclick.includes('p-accounts')) nav.style.display = '';
        });
    }

    /* Operations-only action buttons (staff/admin: player + catalog management). */
    document.querySelectorAll('.admin-action').forEach(el => {
        el.style.display = canManageOperations() ? '' : 'none';
    });

    /* If current role is on a restricted page, redirect to dashboard. */
    const restricted = hidden;
    const activePage = document.querySelector('.page.active');
    if (activePage && restricted.some(pid => activePage.id === pid)) {
        const dashNav = document.querySelector('.sb-item[onclick*="p-dash"]');
        if (dashNav) showPage('p-dash', dashNav);
    }
}

async function renderAll() {
    updateDate();
    await loadGamepasses();
    const tasks = [loadStats(), loadTransactions()];
    if (canManageOperations()) {
        tasks.push(loadPlayers(), loadAudit());
    }
    if (canManageAdminAccounts()) {
        tasks.push(loadAccounts());
    }
    await Promise.all(tasks);
}

function canManageAdminAccounts() {
    return CURRENT_USER?.role === 'admin';
}

function canManageOperations() {
    return ['admin', 'staff'].includes(CURRENT_USER?.role || '');
}

async function loadAccounts(search = '') {
    if (!canManageAdminAccounts()) return;

    const res = await apiPost('accounts', { search });
    if (!res.ok) {
        toast('err', res.message);
        return;
    }

    ACCOUNT_ROWS = res.accounts || [];
    renderAccounts(ACCOUNT_ROWS);
}

function renderAccounts(data) {
    const tb = document.getElementById('tb-accounts');
    if (!tb) return;
    const isAdmin = canManageAdminAccounts();
    const addButton = document.getElementById('acc-add-btn');
    if (addButton) addButton.style.display = isAdmin ? 'inline-flex' : 'none';

    if (!data.length) {
        tb.innerHTML = '<tr><td colspan="7"><div class="empty"><i class="fa-solid fa-user-slash"></i><p>No accounts found.</p></div></td></tr>';
        return;
    }

    tb.innerHTML = data.map(a => {
        const nextStatus = a.status === 'active' ? 'inactive' : 'active';
        const isSelf = Number(a.uid) === Number(CURRENT_USER?.uid);
        const isMainAdmin = a.username === 'admin';
        const manageButtons = isAdmin
            ? `
                <button class="btn btn-ghost" onclick="openEditAccount(${Number(a.uid)})" style="padding:5px 11px;font-size:.75rem;">
                    <i class="fa-solid fa-pen"></i> Edit
                </button>
                <button class="btn btn-ghost" onclick="setAccountStatus(${Number(a.uid)}, '${nextStatus}')" style="padding:5px 11px;font-size:.75rem;" ${(isSelf || isMainAdmin) && nextStatus === 'inactive' ? 'disabled' : ''}>
                    <i class="fa-solid fa-${nextStatus === 'active' ? 'user-check' : 'user-slash'}"></i>
                    ${nextStatus === 'active' ? 'Set Active' : 'Set Inactive'}
                </button>
                <button class="btn btn-ghost" onclick="deleteAccount(${Number(a.uid)}, '${jsString(a.username)}')" style="padding:5px 11px;font-size:.75rem;color:var(--red);" ${isSelf || isMainAdmin ? 'disabled' : ''}>
                    <i class="fa-solid fa-trash"></i> Delete
                </button>
            `
            : `<span style="color:var(--text-3);font-size:.76rem;"><i class="fa-solid fa-eye"></i> View only</span>`;
        return `<tr>
            <td style="color:var(--text-3);font-size:.78rem;">${esc(a.uid)}</td>
            <td><b>${esc(a.username)}</b>${isSelf ? ' <span class="badge b-on" style="font-size:.65rem;padding:1px 6px;">You</span>' : ''}</td>
            <td>
                <b>${esc(a.full_name || '—')}</b><br>
                <span style="color:var(--text-3);font-size:.76rem;">${esc(a.email || '—')}</span>
            </td>
            <td>${roleBadge(a.role)}</td>
            <td>${actBadge(a.status === 'active' ? 1 : 0, a.status)}</td>
            <td style="color:var(--text-3);font-size:.76rem;">${esc(a.created_at?.slice(0,10) ?? '—')}</td>
            <td style="display:flex;gap:4px;flex-wrap:wrap;">${manageButtons}</td>
        </tr>`;
    }).join('');
}

function filterAccounts() {
    loadAccounts(document.getElementById('acc-search').value.trim());
}

async function addAccount() {
    if (!canManageAdminAccounts()) { toast('err', 'Only admin can add accounts.'); return; }

    const username = document.getElementById('aa-user').value.trim();
    const pass = document.getElementById('aa-pass').value;
    const confirm = document.getElementById('aa-confirm').value;

    if (!username) { toast('err', 'Username is required.'); return; }
    if (!/^[a-zA-Z0-9_]{3,50}$/.test(username)) {
        toast('err', 'Username must be 3-50 characters (letters, numbers, underscores only).');
        return;
    }
    if (pass.length < 8) { toast('err', 'Password must be at least 8 characters.'); return; }
    if (pass !== confirm) { toast('err', 'Passwords do not match.'); return; }

    const data = {
        username,
        full_name: document.getElementById('aa-name').value.trim(),
        email: document.getElementById('aa-email').value.trim(),
        birthday: document.getElementById('aa-birthday').value,
        gender: document.querySelector('#m-addaccount .gender-btn.picked')?.dataset.value || '',
        role: document.getElementById('aa-role')?.value || 'user',
        status: 'active',
        password: pass,
        confirm_password: confirm
    };

    try {
        const res = await apiPost('add_account', data);
        if (!res.ok) { toast('err', res.message); return; }

        toast('ok', res.message);
        ['aa-user','aa-name','aa-email','aa-birthday','aa-pass','aa-confirm'].forEach(id => document.getElementById(id).value = '');
        if (document.getElementById('aa-role')) document.getElementById('aa-role').value = 'user';
        document.querySelectorAll('#m-addaccount .gender-btn').forEach(b => b.classList.remove('picked'));
        closeModal('m-addaccount');
        loadAccounts(document.getElementById('acc-search').value.trim());
        loadAudit();
    } catch (error) {
        toast('err', 'Unable to connect to api.php.');
    }
}

function openEditAccount(uid) {
    if (!canManageAdminAccounts()) { toast('err', 'Only admin can edit accounts.'); return; }
    const account = ACCOUNT_ROWS.find(a => Number(a.uid) === Number(uid));
    if (!account) return;

    document.getElementById('ea-uid').value = account.uid;
    document.getElementById('ea-user').value = account.username || '';
    document.getElementById('ea-name').value = account.full_name || '';
    document.getElementById('ea-email').value = account.email || '';
    document.getElementById('ea-birthday').value = account.birthday || '';
    document.getElementById('ea-gender').value = account.gender || '';
    document.getElementById('ea-role').value = account.role || 'user';
    document.getElementById('ea-status').value = account.status || 'active';
    document.getElementById('ea-pass').value = '';
    document.getElementById('ea-confirm').value = '';

    const isMainAdmin = account.username === 'admin';
    const roleSelect = document.getElementById('ea-role');
    const adminOption = roleSelect.querySelector('option[value="admin"]');
    if (adminOption) {
        adminOption.hidden = !isMainAdmin;
        adminOption.disabled = !isMainAdmin;
    }
    document.getElementById('ea-user').disabled = isMainAdmin;
    roleSelect.disabled = isMainAdmin;
    document.getElementById('ea-status').disabled = isMainAdmin;

    openModal('m-editaccount');
}

async function updateAccount() {
    if (!canManageAdminAccounts()) { toast('err', 'Only admin can update accounts.'); return; }
    const data = {
        uid: document.getElementById('ea-uid').value,
        username: document.getElementById('ea-user').value.trim(),
        full_name: document.getElementById('ea-name').value.trim(),
        email: document.getElementById('ea-email').value.trim(),
        birthday: document.getElementById('ea-birthday').value,
        gender: document.getElementById('ea-gender').value,
        role: document.getElementById('ea-role').value,
        status: document.getElementById('ea-status').value,
        password: document.getElementById('ea-pass').value,
        confirm_password: document.getElementById('ea-confirm').value
    };

    const res = await apiPost('update_account', data);
    if (!res.ok) { toast('err', res.message); return; }

    toast('ok', res.message);
    closeModal('m-editaccount');
    loadAccounts(document.getElementById('acc-search').value.trim());
    loadAudit();
}

async function setAccountStatus(uid, status) {
    if (!canManageAdminAccounts()) { toast('err', 'Only admin can update account status.'); return; }
    const res = await apiPost('set_status', { uid, status });
    if (!res.ok) { toast('err', res.message); return; }

    toast('ok', res.message);
    loadAccounts(document.getElementById('acc-search').value.trim());
    loadAudit();
}

async function deleteAccount(uid, username) {
    if (!canManageAdminAccounts()) { toast('err', 'Only admin can delete accounts.'); return; }
    if (!confirm(`Delete account "${username}"? This cannot be undone.`)) return;

    const res = await apiPost('delete_account', { uid });
    if (!res.ok) { toast('err', res.message); return; }

    toast('ok', res.message);
    loadAccounts(document.getElementById('acc-search').value.trim());
    loadAudit();
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await apiPost('session');
        if (res.ok && res.logged_in && res.user?.username) {
            showLoggedInUser(res.user);
        }
    } catch (error) {
        /* The login screen will show the API error when the user tries to log in. */
    }
});

/* ========================================================
   INIT
======================================================== */
/* Animated background tiles on every auth screen */
document.querySelectorAll('.auth-tiles').forEach(container => {
    for (let i = 0; i < 50; i++) {
        const d       = document.createElement('div');
        d.className   = 'auth-tile';
        container.appendChild(d);
    }
});

/* Populate birthday dropdowns */
initBirthdayDropdowns();