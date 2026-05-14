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
let DB_REFUND_REQUESTS = [];

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
    'p-dash':         'Dashboard',
    'p-accounts':     'Accounts',
    'p-players':      'Players',
    'p-gamepasses':   'Game Passes',
    'p-transactions': 'Transactions',
    'p-audit':        'Audit Log',
    'p-reports':      'Report Generator',
    'p-about':        'About',
};

function showPage(pid, navEl) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.sb-item').forEach(n => n.classList.remove('active'));
    document.getElementById(pid).classList.add('active');
    navEl.classList.add('active');
    document.getElementById('tb-title').textContent = PAGE_TITLES[pid] || '';
    if (pid === 'p-reports') loadTxs();
    if (pid === 'p-transactions') loadRefundRequests();
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
                        ${(() => {
                            const req = DB_REFUND_REQUESTS.find(r => Number(r.gpid) === Number(g.gpid));
                            if (!req) return `
                                <button class="btn btn-ghost" onclick="requestRefund(${Number(g.gpid)}, '${jsString(g.gname)}')" style="padding:5px 11px;font-size:.75rem;color:var(--red);">
                                    <i class="fa-solid fa-rotate-left"></i> Refund
                                </button>`;
                            if (req.status === 'pending') return `<span style="color:var(--yellow);font-size:.75rem;padding:5px 2px;"><i class="fa-solid fa-clock"></i> Refund Pending</span>`;
                            return `<span style="color:var(--text-3);font-size:.75rem;padding:5px 2px;"><i class="fa-solid fa-ban"></i> Refund Unavailable</span>`;
                        })()}
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

async function loadRefundRequests() {
    const res = await apiPost('refund_requests');
    if (!res.ok) return;
    DB_REFUND_REQUESTS = res.requests || [];
    if (canManageOperations()) {
        renderRefundRequests(DB_REFUND_REQUESTS);
        const badge = document.getElementById('tx-req-badge');
        if (badge) {
            const count = DB_REFUND_REQUESTS.length;
            badge.textContent = count;
            badge.style.display = count > 0 ? '' : 'none';
        }
    }
    renderGP(DB_GAMEPASSES);
}

function renderRefundRequests(data) {
    const tb   = document.getElementById('tb-refund-req');
    const chip = document.getElementById('refund-req-count');
    if (!tb) return;
    if (chip) chip.textContent = `${data.length} pending`;
    if (!data.length) {
        tb.innerHTML = '<tr><td colspan="5"><div class="empty"><i class="fa-solid fa-circle-check"></i><p>No pending refund requests.</p></div></td></tr>';
        return;
    }
    tb.innerHTML = data.map(r => `
        <tr>
            <td style="color:var(--text-3);font-size:.78rem;">${esc(r.id)}</td>
            <td><b>${esc(r.pname)}</b></td>
            <td><span class="ptag"><i class="fa-solid fa-ticket"></i>${esc(r.gname)}</span></td>
            <td style="color:var(--text-3);font-size:.76rem;">${esc(r.created_at)}</td>
            <td style="display:flex;gap:6px;">
                <button class="btn btn-green" onclick="resolveRefund(${Number(r.id)}, 'accept')" style="padding:5px 11px;font-size:.75rem;">
                    <i class="fa-solid fa-check"></i> Accept
                </button>
                <button class="btn btn-ghost" onclick="resolveRefund(${Number(r.id)}, 'cancel')" style="padding:5px 11px;font-size:.75rem;color:var(--red);">
                    <i class="fa-solid fa-xmark"></i> Cancel
                </button>
            </td>
        </tr>`).join('');
}

async function requestRefund(gpid, gname) {
    if (!confirm(`Request a refund for "${gname}"?\nStaff will review and approve or cancel your request.`)) return;
    const res = await apiPost('request_refund', { gpid });
    if (!res.ok) { toast('err', res.message); return; }
    toast('ok', res.message);
    await loadRefundRequests();
}

async function resolveRefund(id, resolution) {
    const label = resolution === 'accept' ? 'accept and process this refund' : 'cancel this refund request';
    if (!confirm(`Are you sure you want to ${label}?`)) return;
    const res = await apiPost('resolve_refund', { id, resolution });
    if (!res.ok) { toast('err', res.message); return; }
    toast('ok', res.message);
    await Promise.all([loadRefundRequests(), loadTxs(), loadTransactions(), loadStats()]);
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
   TRANSACTIONS — three primary transactions
======================================================== */
let DB_TX = [];

function txTypeMeta(type) {
    const meta = {
        purchase: { label: 'Purchase', icon: 'fa-cart-shopping', color: 'var(--blue)', badge: 'b-purchase' },
        gift:     { label: 'Gift',     icon: 'fa-gift',          color: 'var(--green)', badge: 'b-gift' },
        refund:   { label: 'Refund',   icon: 'fa-rotate-left',   color: 'var(--red)', badge: 'b-admin' },
    };
    return meta[type] || { label: type || '—', icon: 'fa-receipt', color: 'var(--text-2)', badge: 'b-unknown' };
}

function fmtMoney(n) {
    const v = Number(n) || 0;
    if (v === 0) return 'Free';
    return (v < 0 ? '-R$ ' : 'R$ ') + Math.abs(v);
}

function openTxModal(type) {
    const role = CURRENT_USER?.role || '';
    if ((type === 'gift' || type === 'refund') && !['admin', 'staff'].includes(role)) {
        toast('err', 'Only staff or admin can ' + (type === 'gift' ? 'gift passes' : 'issue refunds') + '.');
        return;
    }

    document.getElementById('tx-type').value = type;
    const meta = txTypeMeta(type);
    document.getElementById('tx-modal-title').innerHTML =
        `<i class="fa-solid ${meta.icon}" style="color:${meta.color};"></i> New ${meta.label}`;
    document.getElementById('tx-modal-sub').textContent = {
        purchase: 'Record a paid game pass purchase for a player. The amount is taken from the pass price.',
        gift:     'Grant a free game pass to a player. The pass will be marked as a gift.',
        refund:   'Deactivate a player\'s pass and record the refund. Amount is logged as a negative value.',
    }[type] || '';

    /* Populate player + pass selects from the data we already loaded. */
    const txPid = document.getElementById('tx-pid');
    const txGpid = document.getElementById('tx-gpid');
    const playerWrap = document.getElementById('tx-player-wrap');

    /* For a user-role buying for themselves, hide the player picker. */
    if (type === 'purchase' && role === 'user') {
        playerWrap.style.display = 'none';
    } else {
        playerWrap.style.display = '';
        txPid.innerHTML = '<option value="">— Select a player —</option>' +
            DB_PLAYERS
                .filter(p => p.stat === 'active' || type === 'refund')
                .map(p => `<option value="${Number(p.pid)}">${esc(p.uname)} (#${esc(p.pid)})</option>`)
                .join('');
    }

    /* Pass options: refund needs owned/active passes; purchase needs on-sale; gift any. */
    let passOptions;
    if (type === 'refund') {
        passOptions = DB_GAMEPASSES;
    } else if (type === 'purchase') {
        passOptions = DB_GAMEPASSES.filter(g => Number(g.sale) === 1);
    } else {
        passOptions = DB_GAMEPASSES;
    }
    txGpid.innerHTML = '<option value="">— Select a game pass —</option>' +
        passOptions.map(g => {
            const tag = Number(g.price) ? `R$ ${g.price}` : 'Free';
            return `<option value="${Number(g.gpid)}">${esc(g.gname)} — ${tag}</option>`;
        }).join('');

    document.getElementById('tx-notes').value = '';
    document.getElementById('tx-actor-name').textContent =
        (CURRENT_USER?.full_name || CURRENT_USER?.username || '—') + ' (' + roleLabel(CURRENT_USER?.role) + ')';
    document.getElementById('tx-actor-time').textContent = new Date().toLocaleString();

    const submit = document.getElementById('tx-submit');
    submit.className = 'btn ' + (type === 'gift' ? 'btn-green' : type === 'refund' ? 'btn-red' : 'btn-blue');
    submit.innerHTML = `<i class="fa-solid ${meta.icon}"></i> Save ${meta.label}`;

    openModal('m-tx');
}

async function submitTransaction() {
    const type  = document.getElementById('tx-type').value;
    const pid   = document.getElementById('tx-pid').value;
    const gpid  = document.getElementById('tx-gpid').value;
    const notes = document.getElementById('tx-notes').value.trim();

    if (!gpid) { toast('err', 'Please choose a game pass.'); return; }
    const role = CURRENT_USER?.role || '';
    const needsPlayer = !(type === 'purchase' && role === 'user');
    if (needsPlayer && !pid) { toast('err', 'Please choose a player.'); return; }

    const action = { purchase: 'tx_purchase', gift: 'tx_gift', refund: 'tx_refund' }[type];
    if (!action) { toast('err', 'Unknown transaction type.'); return; }

    const res = await apiPost(action, { gpid, pid: pid || 0, notes });
    if (!res.ok) { toast('err', res.message); return; }

    toast('ok', res.message || 'Transaction recorded.');
    closeModal('m-tx');

    await Promise.all([
        loadTxs(),
        loadGamepasses(document.getElementById('gp-search')?.value.trim() || ''),
        loadTransactions(),
        loadStats(),
    ]);
}

async function loadTxs() {
    const res = await apiPost('tx_list');
    if (!res.ok) { return; }
    DB_TX = res.transactions || [];
    renderTxRecent();
    /* Always reapply filters so the data grid is ready when the user opens Reports. */
    if (document.getElementById('rpt-grid')) applyReportFilters();
}

function renderTxRecent() {
    const tb = document.getElementById('tb-tx-recent');
    const chip = document.getElementById('tx-recent-count');
    if (!tb) return;

    const rows = DB_TX.slice(0, 10);
    if (chip) chip.textContent = `${DB_TX.length} record${DB_TX.length === 1 ? '' : 's'}`;

    if (!rows.length) {
        tb.innerHTML = '<tr><td colspan="7"><div class="empty"><i class="fa-solid fa-receipt"></i><p>No transactions recorded yet.</p></div></td></tr>';
        return;
    }

    tb.innerHTML = rows.map(t => {
        const m = txTypeMeta(t.ttype);
        return `<tr>
            <td style="color:var(--text-3);font-size:.78rem;">${esc(t.tid)}</td>
            <td><span class="badge ${m.badge}"><i class="fa-solid ${m.icon}" style="margin-right:4px;font-size:.7rem;"></i>${m.label}</span></td>
            <td><b>${esc(t.pname || '—')}</b></td>
            <td><span class="ptag"><i class="fa-solid fa-ticket"></i>${esc(t.gname || '—')}</span></td>
            <td style="font-weight:800;color:${Number(t.amount) < 0 ? 'var(--red)' : 'var(--yellow)'};">${fmtMoney(t.amount)}</td>
            <td>${esc(t.actor_username || '—')} <span style="color:var(--text-3);font-size:.7rem;">(${esc(t.actor_role)})</span></td>
            <td style="color:var(--text-3);font-size:.76rem;">${esc(t.created_at)}</td>
        </tr>`;
    }).join('');
}

/* ========================================================
   REPORT GENERATOR — Data Grid (sort + paginate + filter)
======================================================== */
const RPT_PAGE_SIZE = 10;
let RPT_FILTERED = [];
let RPT_SORT = { key: 'created_at', dir: 'desc' };
let RPT_PAGE = 1;

function applyReportFilters() {
    const type = document.getElementById('rpt-type').value;
    const from = document.getElementById('rpt-from').value;
    const to   = document.getElementById('rpt-to').value;

    RPT_FILTERED = DB_TX.filter(t => {
        if (type && t.ttype !== type) return false;
        const d = (t.created_at || '').slice(0, 10);
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
    });

    RPT_PAGE = 1;
    renderReportGrid();
}

function clearReportFilters() {
    document.getElementById('rpt-type').value = '';
    document.getElementById('rpt-from').value = '';
    document.getElementById('rpt-to').value = '';
    applyReportFilters();
}

function sortReportBy(key) {
    if (RPT_SORT.key === key) {
        RPT_SORT.dir = RPT_SORT.dir === 'asc' ? 'desc' : 'asc';
    } else {
        RPT_SORT = { key, dir: 'asc' };
    }
    renderReportGrid();
}

function sortedFilteredRows() {
    const rows = RPT_FILTERED.slice();
    const { key, dir } = RPT_SORT;
    const mult = dir === 'asc' ? 1 : -1;
    const numericKeys = new Set(['tid', 'amount']);
    rows.sort((a, b) => {
        let av = a[key], bv = b[key];
        if (numericKeys.has(key)) {
            av = Number(av) || 0; bv = Number(bv) || 0;
            return (av - bv) * mult;
        }
        av = String(av ?? '').toLowerCase();
        bv = String(bv ?? '').toLowerCase();
        if (av < bv) return -1 * mult;
        if (av > bv) return  1 * mult;
        return 0;
    });
    return rows;
}

function renderReportGrid() {
    const tb = document.getElementById('tb-rpt');
    const pager = document.getElementById('rpt-pager');
    const countChip = document.getElementById('rpt-count');
    const tsChip = document.getElementById('rpt-ts');
    if (!tb || !pager) return;

    const sorted = sortedFilteredRows();
    const total = sorted.length;
    const pages = Math.max(1, Math.ceil(total / RPT_PAGE_SIZE));
    if (RPT_PAGE > pages) RPT_PAGE = pages;
    const start = (RPT_PAGE - 1) * RPT_PAGE_SIZE;
    const slice = sorted.slice(start, start + RPT_PAGE_SIZE);

    if (countChip) countChip.textContent = `${total} row${total === 1 ? '' : 's'}`;
    if (tsChip) tsChip.textContent = 'Generated: ' + new Date().toLocaleString();

    /* Sort indicators */
    document.querySelectorAll('#rpt-grid th.sortable').forEach(th => {
        const key = th.getAttribute('data-key');
        const ic = th.querySelector('i');
        if (!ic) return;
        if (key === RPT_SORT.key) {
            ic.className = `fa-solid ${RPT_SORT.dir === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}`;
        } else {
            ic.className = 'fa-solid fa-sort';
        }
    });

    if (!slice.length) {
        tb.innerHTML = '<tr><td colspan="8"><div class="empty"><i class="fa-solid fa-receipt"></i><p>No transactions match the current filters.</p></div></td></tr>';
        pager.innerHTML = '';
        return;
    }

    tb.innerHTML = slice.map(t => {
        const m = txTypeMeta(t.ttype);
        return `<tr>
            <td style="color:var(--text-3);font-size:.78rem;">${esc(t.tid)}</td>
            <td><span class="badge ${m.badge}"><i class="fa-solid ${m.icon}" style="margin-right:4px;font-size:.7rem;"></i>${m.label}</span></td>
            <td><b>${esc(t.pname || '—')}</b></td>
            <td><span class="ptag"><i class="fa-solid fa-ticket"></i>${esc(t.gname || '—')}</span></td>
            <td style="font-weight:800;color:${Number(t.amount) < 0 ? 'var(--red)' : 'var(--yellow)'};">${fmtMoney(t.amount)}</td>
            <td>${esc(t.actor_username)} <span style="color:var(--text-3);font-size:.7rem;">(${esc(t.actor_role)})</span></td>
            <td style="color:var(--text-3);font-size:.76rem;">${esc(t.created_at)}</td>
            <td style="color:var(--text-2);max-width:260px;">${esc(t.notes || '—')}</td>
        </tr>`;
    }).join('');

    /* Pager */
    const pageBtn = (n, label, disabled, active) =>
        `<button class="dg-page ${active ? 'active' : ''}" ${disabled ? 'disabled' : ''} onclick="gotoReportPage(${n})">${label}</button>`;
    let html = '';
    html += pageBtn(Math.max(1, RPT_PAGE - 1), '<i class="fa-solid fa-chevron-left"></i>', RPT_PAGE <= 1, false);
    const windowSize = 5;
    let pStart = Math.max(1, RPT_PAGE - Math.floor(windowSize / 2));
    let pEnd = Math.min(pages, pStart + windowSize - 1);
    pStart = Math.max(1, pEnd - windowSize + 1);
    for (let p = pStart; p <= pEnd; p++) {
        html += pageBtn(p, String(p), false, p === RPT_PAGE);
    }
    html += pageBtn(Math.min(pages, RPT_PAGE + 1), '<i class="fa-solid fa-chevron-right"></i>', RPT_PAGE >= pages, false);
    html += `<span class="dg-info">Page ${RPT_PAGE} of ${pages} • ${total} record${total === 1 ? '' : 's'}</span>`;
    pager.innerHTML = html;
}

function gotoReportPage(n) {
    RPT_PAGE = n;
    renderReportGrid();
}

/* Wire up sortable headers once. */
document.addEventListener('click', e => {
    const th = e.target.closest('#rpt-grid th.sortable');
    if (!th) return;
    sortReportBy(th.getAttribute('data-key'));
});

/* ========================================================
   EXCEL EXPORT (ExcelJS + Chart.js embedded chart)
======================================================== */

/* Render a Chart.js chart in an off-screen canvas and return PNG bytes. */
async function renderChartImage(type, labels, data, title, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 480;
    /* Off-screen but in DOM (Chart.js needs a real canvas). */
    canvas.style.position = 'fixed';
    canvas.style.left = '-10000px';
    canvas.style.top = '-10000px';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    /* White background so the image looks right when embedded. */
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const chart = new Chart(ctx, {
        type,
        data: {
            labels,
            datasets: [{
                label: title,
                data,
                backgroundColor: type === 'pie'
                    ? ['#3b82f6', '#22c55e', '#e03c31', '#facc15', '#a78bfa', '#06b6d4', '#f97316', '#10b981']
                    : color,
                borderColor: color,
                borderWidth: 2,
                fill: type === 'line' ? false : true,
                tension: 0.25,
            }],
        },
        options: {
            responsive: false,
            animation: false,
            plugins: {
                legend: { display: true, position: 'bottom' },
                title:  { display: true, text: title, font: { size: 18, weight: 'bold' } },
            },
            scales: type === 'pie' ? {} : {
                x: { title: { display: true, text: 'Category' } },
                y: { title: { display: true, text: 'Value' }, beginAtZero: true },
            },
        },
    });

    /* Give Chart.js a tick to paint synchronously, then read pixels. */
    await new Promise(r => requestAnimationFrame(r));
    const dataUrl = canvas.toDataURL('image/png');
    chart.destroy();
    canvas.remove();

    /* Convert data URL -> base64 string (strip prefix). */
    return dataUrl.split(',')[1];
}

/* Build a simple base64-encoded PNG logo from a canvas (placeholder logo). */
function buildLogoPng() {
    const c = document.createElement('canvas');
    c.width = 240; c.height = 80;
    const ctx = c.getContext('2d');
    /* Dark roblox-ish background */
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, c.width, c.height);
    /* Red accent bar */
    ctx.fillStyle = '#e03c31';
    ctx.fillRect(0, 0, 6, c.height);
    /* Logo text */
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px Inter, Arial, sans-serif';
    ctx.fillText('RBX', 24, 50);
    ctx.fillStyle = '#e03c31';
    ctx.fillText('GPM', 92, 50);
    ctx.fillStyle = '#a8a8a8';
    ctx.font = '13px Inter, Arial, sans-serif';
    ctx.fillText('Game Pass Management System', 24, 70);
    return c.toDataURL('image/png').split(',')[1];
}

function reportConfigFor(type) {
    const configs = {
        purchase: {
            title:    'Purchase Transactions Report',
            filename: 'RBXGPM_Purchase_Report',
            color:    '4472C4',
            chartType:'bar',
            chartTitle:'Total Purchase Revenue by Game Pass (R$)',
        },
        gift: {
            title:    'Gift Transactions Report',
            filename: 'RBXGPM_Gift_Report',
            color:    '70AD47',
            chartType:'pie',
            chartTitle:'Gifts Distributed by Game Pass',
        },
        refund: {
            title:    'Refund Transactions Report',
            filename: 'RBXGPM_Refund_Report',
            color:    'C0504D',
            chartType:'line',
            chartTitle:'Refund Amounts by Game Pass (R$)',
        },
    };
    return configs[type];
}

async function exportExcel(type) {
    if (typeof ExcelJS === 'undefined') {
        toast('err', 'Excel library is still loading. Please try again in a moment.');
        return;
    }

    const cfg = reportConfigFor(type);
    if (!cfg) return;

    /* Filter to the requested transaction type within current filters. */
    const typeFilter = document.getElementById('rpt-type').value;
    const from = document.getElementById('rpt-from').value;
    const to   = document.getElementById('rpt-to').value;
    const rows = DB_TX.filter(t => {
        if (t.ttype !== type) return false;
        const d = (t.created_at || '').slice(0, 10);
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
    });

    if (!rows.length) {
        toast('err', `No ${type} transactions match the current filters.`);
        return;
    }
    /* Optional: if the user has the grid filter set to a different type, warn them. */
    if (typeFilter && typeFilter !== type) {
        toast('info', `Exporting ${type} report (grid filter "${typeFilter}" only affects the on-screen grid).`);
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = CURRENT_USER?.username || 'RBXGPM';
    workbook.created = new Date();

    /* ============== SHEET 1 — Report Data ============== */
    const ws = workbook.addWorksheet('Report Data');
    ws.properties.defaultRowHeight = 18;

    /* Embed logo image at top-left. */
    const logoId = workbook.addImage({ base64: buildLogoPng(), extension: 'png' });
    ws.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 200, height: 70 } });

    /* Reserve rows 1-4 for the header block (logo lives in rows 1-4). */
    ws.mergeCells('C1:H1');
    ws.getCell('C1').value = 'RBXGPM — Game Pass Management System';
    ws.getCell('C1').font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF111111' } };

    ws.mergeCells('C2:H2');
    ws.getCell('C2').value = cfg.title;
    ws.getCell('C2').font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FF' + cfg.color } };

    ws.mergeCells('C3:H3');
    ws.getCell('C3').value = 'Date Generated: ' + new Date().toLocaleString();
    ws.getCell('C3').font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF555555' } };

    ws.mergeCells('C4:H4');
    const filterDesc = [
        from ? `From ${from}` : null,
        to ? `To ${to}` : null,
    ].filter(Boolean).join(' • ') || 'All dates';
    ws.getCell('C4').value = `Filters: ${filterDesc}  •  Type: ${type}  •  Total Records: ${rows.length}`;
    ws.getCell('C4').font = { name: 'Arial', size: 10, color: { argb: 'FF555555' } };

    /* Spacer */
    ws.getRow(5).height = 8;

    /* Column headers (row 6). */
    const headerRowIdx = 6;
    const headers = ['#', 'Type', 'Player', 'Game Pass', 'Amount (R$)', 'Actor', 'Role', 'Date / Time', 'Notes'];
    const headerRow = ws.getRow(headerRowIdx);
    headers.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = h;
        cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + cfg.color } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            top:    { style: 'thin', color: { argb: 'FFCCCCCC' } },
            left:   { style: 'thin', color: { argb: 'FFCCCCCC' } },
            bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            right:  { style: 'thin', color: { argb: 'FFCCCCCC' } },
        };
    });
    headerRow.height = 22;

    /* Data rows. */
    rows.forEach((r, i) => {
        const row = ws.getRow(headerRowIdx + 1 + i);
        row.getCell(1).value = r.tid;
        row.getCell(2).value = txTypeMeta(r.ttype).label;
        row.getCell(3).value = r.pname || '';
        row.getCell(4).value = r.gname || '';
        row.getCell(5).value = Number(r.amount) || 0;
        row.getCell(5).numFmt = '#,##0;[Red]-#,##0';
        row.getCell(6).value = r.actor_username || '';
        row.getCell(7).value = r.actor_role || '';
        row.getCell(8).value = r.created_at || '';
        row.getCell(9).value = r.notes || '';
        for (let c = 1; c <= 9; c++) {
            const cell = row.getCell(c);
            cell.alignment = { vertical: 'middle', wrapText: true };
            cell.border = {
                top:    { style: 'thin', color: { argb: 'FFEEEEEE' } },
                left:   { style: 'thin', color: { argb: 'FFEEEEEE' } },
                bottom: { style: 'thin', color: { argb: 'FFEEEEEE' } },
                right:  { style: 'thin', color: { argb: 'FFEEEEEE' } },
            };
            if (i % 2 === 1) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F7F7' } };
            }
        }
    });

    /* Column widths */
    [6, 12, 18, 22, 14, 18, 12, 22, 36].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    /* Signature block. */
    const sigStart = headerRowIdx + 1 + rows.length + 2;
    const fullName = (CURRENT_USER?.full_name || CURRENT_USER?.username || '').trim();
    const roleStr  = roleLabel(CURRENT_USER?.role);

    ws.getRow(sigStart).height = 22;
    ws.mergeCells(`B${sigStart}:D${sigStart}`);
    ws.getCell(`B${sigStart}`).value = 'Prepared by: _________________________________';
    ws.getCell(`B${sigStart}`).font = { name: 'Arial', size: 11, bold: true };

    ws.mergeCells(`B${sigStart + 1}:D${sigStart + 1}`);
    ws.getCell(`B${sigStart + 1}`).value = fullName ? `${fullName}  (${roleStr})` : `${CURRENT_USER?.username || ''}  (${roleStr})`;
    ws.getCell(`B${sigStart + 1}`).font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF555555' } };

    ws.mergeCells(`B${sigStart + 2}:D${sigStart + 2}`);
    ws.getCell(`B${sigStart + 2}`).value = 'Signature: ____________________________________';
    ws.getCell(`B${sigStart + 2}`).font = { name: 'Arial', size: 10, color: { argb: 'FF555555' } };

    ws.mergeCells(`F${sigStart}:H${sigStart}`);
    ws.getCell(`F${sigStart}`).value = 'Date: ____________________';
    ws.getCell(`F${sigStart}`).font = { name: 'Arial', size: 10, color: { argb: 'FF555555' } };

    /* ============== SHEET 2 — Chart ============== */
    const ws2 = workbook.addWorksheet('Chart');
    ws2.getCell('A1').value = 'RBXGPM — ' + cfg.chartTitle;
    ws2.getCell('A1').font = { name: 'Arial', size: 14, bold: true };
    ws2.mergeCells('A1:H1');

    /* Aggregate amounts by game pass. */
    const agg = new Map();
    rows.forEach(r => {
        const key = r.gname || '—';
        agg.set(key, (agg.get(key) || 0) + Math.abs(Number(r.amount) || 0));
    });
    /* For "gift" the amount is 0 — count occurrences instead. */
    if (type === 'gift') {
        agg.clear();
        rows.forEach(r => {
            const key = r.gname || '—';
            agg.set(key, (agg.get(key) || 0) + 1);
        });
    }

    const labels = Array.from(agg.keys());
    const values = Array.from(agg.values());

    const chartB64 = await renderChartImage(cfg.chartType, labels, values, cfg.chartTitle, '#' + cfg.color);
    const chartImgId = workbook.addImage({ base64: chartB64, extension: 'png' });
    ws2.addImage(chartImgId, { tl: { col: 0, row: 2 }, ext: { width: 720, height: 384 } });

    /* Legend table on the right of the chart. */
    ws2.getCell('J3').value = 'Category';
    ws2.getCell('K3').value = type === 'gift' ? 'Gift Count' : 'Total (R$)';
    ['J3', 'K3'].forEach(c => {
        ws2.getCell(c).font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        ws2.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + cfg.color } };
    });
    labels.forEach((label, i) => {
        ws2.getCell(`J${4 + i}`).value = label;
        ws2.getCell(`K${4 + i}`).value = values[i];
        ws2.getCell(`K${4 + i}`).numFmt = '#,##0';
    });
    ws2.getColumn(10).width = 20;
    ws2.getColumn(11).width = 16;

    /* Save the file. */
    const buf = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const stamp = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${cfg.filename}_${stamp}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);

    toast('ok', `${cfg.title} exported (${rows.length} record${rows.length === 1 ? '' : 's'}).`);
}

async function exportExcelAll() {
    if (typeof ExcelJS === 'undefined') {
        toast('err', 'Excel library is still loading. Please try again in a moment.');
        return;
    }

    const from = document.getElementById('rpt-from').value;
    const to   = document.getElementById('rpt-to').value;
    const rows = DB_TX.filter(t => {
        const d = (t.created_at || '').slice(0, 10);
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
    });

    if (!rows.length) {
        toast('err', 'No transactions match the current date filters.');
        return;
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = CURRENT_USER?.username || 'RBXGPM';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('All Transactions');
    ws.properties.defaultRowHeight = 18;

    const logoId = workbook.addImage({ base64: buildLogoPng(), extension: 'png' });
    ws.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 200, height: 70 } });

    ws.mergeCells('C1:I1');
    ws.getCell('C1').value = 'RBXGPM — Game Pass Management System';
    ws.getCell('C1').font = { name: 'Arial', size: 16, bold: true };

    ws.mergeCells('C2:I2');
    ws.getCell('C2').value = 'All Transactions Report';
    ws.getCell('C2').font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FF4472C4' } };

    ws.mergeCells('C3:I3');
    ws.getCell('C3').value = 'Date Generated: ' + new Date().toLocaleString();
    ws.getCell('C3').font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF555555' } };

    ws.mergeCells('C4:I4');
    const filterDesc = [from ? `From ${from}` : null, to ? `To ${to}` : null].filter(Boolean).join(' • ') || 'All dates';
    ws.getCell('C4').value = `Filters: ${filterDesc}  •  Total Records: ${rows.length}`;
    ws.getCell('C4').font = { name: 'Arial', size: 10, color: { argb: 'FF555555' } };

    ws.getRow(5).height = 8;

    const headerRowIdx = 6;
    const headers = ['#', 'Type', 'Player', 'Game Pass', 'Amount (R$)', 'Actor', 'Role', 'Date / Time', 'Notes'];
    const headerRow = ws.getRow(headerRowIdx);
    headers.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = h;
        cell.font  = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
    headerRow.height = 22;

    const typeColors = { purchase: 'FF4472C4', gift: 'FF70AD47', refund: 'FFC0504D' };
    rows.forEach((r, i) => {
        const row = ws.getRow(headerRowIdx + 1 + i);
        row.getCell(1).value = r.tid;
        row.getCell(2).value = txTypeMeta(r.ttype).label;
        row.getCell(2).font  = { name: 'Arial', size: 10, bold: true, color: { argb: typeColors[r.ttype] || 'FF333333' } };
        row.getCell(3).value = r.pname || '';
        row.getCell(4).value = r.gname || '';
        row.getCell(5).value = Number(r.amount) || 0;
        row.getCell(5).numFmt = '#,##0;[Red]-#,##0';
        row.getCell(6).value = r.actor_username || '';
        row.getCell(7).value = r.actor_role || '';
        row.getCell(8).value = r.created_at || '';
        row.getCell(9).value = r.notes || '';
        for (let c = 1; c <= 9; c++) {
            const cell = row.getCell(c);
            cell.alignment = { vertical: 'middle', wrapText: true };
            cell.border = { top: { style: 'thin', color: { argb: 'FFEEEEEE' } }, left: { style: 'thin', color: { argb: 'FFEEEEEE' } }, bottom: { style: 'thin', color: { argb: 'FFEEEEEE' } }, right: { style: 'thin', color: { argb: 'FFEEEEEE' } } };
            if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F7F7' } };
        }
    });

    [6, 12, 18, 22, 14, 18, 12, 22, 36].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    /* Chart sheet — breakdown by type */
    const ws2 = workbook.addWorksheet('Summary');
    ws2.getCell('A1').value = 'RBXGPM — Transaction Breakdown by Type';
    ws2.getCell('A1').font = { name: 'Arial', size: 14, bold: true };
    ws2.mergeCells('A1:H1');

    const typeCounts = { purchase: 0, gift: 0, refund: 0 };
    rows.forEach(r => { if (typeCounts[r.ttype] !== undefined) typeCounts[r.ttype]++; });
    const chartB64 = await renderChartImage('pie', Object.keys(typeCounts), Object.values(typeCounts), 'Transactions by Type', '#4472C4');
    const chartImgId = workbook.addImage({ base64: chartB64, extension: 'png' });
    ws2.addImage(chartImgId, { tl: { col: 0, row: 2 }, ext: { width: 480, height: 320 } });

    ws2.getCell('J3').value = 'Type';      ws2.getCell('K3').value = 'Count';
    ['J3','K3'].forEach(c => { ws2.getCell(c).font = { bold: true, color: { argb: 'FFFFFFFF' } }; ws2.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }; });
    Object.entries(typeCounts).forEach(([type, count], i) => {
        ws2.getCell(`J${4 + i}`).value = type.charAt(0).toUpperCase() + type.slice(1);
        ws2.getCell(`K${4 + i}`).value = count;
    });
    ws2.getColumn(10).width = 16; ws2.getColumn(11).width = 10;

    const buf  = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const stamp = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `RBXGPM_All_Transactions_${stamp}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast('ok', `All Transactions Report exported (${rows.length} record${rows.length === 1 ? '' : 's'}).`);
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
            : ['p-accounts', 'p-players', 'p-transactions', 'p-audit'];

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
    const tasks = [loadStats(), loadTransactions(), loadTxs(), loadRefundRequests()];
    /* Players list is needed by the transaction modal selects for all signed-in users. */
    tasks.push(loadPlayers());
    if (canManageOperations()) {
        tasks.push(loadAudit());
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