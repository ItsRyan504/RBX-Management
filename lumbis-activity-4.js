'use strict';

/* ========================================================
   DATA  (mirrors the SQL dump)
======================================================== */
const PLAYERS = [
    { pid:1,  uname:'FreeSkin',     jdate:'2025-01-01', stat:'active' },
    { pid:2,  uname:'MoonByte',     jdate:'2025-01-02', stat:'active' },
    { pid:3,  uname:'PixelNova',    jdate:'2025-01-03', stat:'active' },
    { pid:4,  uname:'RbxRanger',    jdate:'2025-01-04', stat:'active' },
    { pid:5,  uname:'KaitoDev',     jdate:'2025-01-05', stat:'active' },
    { pid:6,  uname:'LavaLynx',     jdate:'2025-01-06', stat:'active' },
    { pid:7,  uname:'NeonWarden',   jdate:'2025-01-07', stat:'active' },
    { pid:8,  uname:'SushiSamurai', jdate:'2025-01-08', stat:'active' },
    { pid:9,  uname:'CloudCrate',   jdate:'2025-01-09', stat:'banned'  },
    { pid:10, uname:'AstraPanda',   jdate:'2025-01-10', stat:'active'  },
];

const GAMEPASSES = [
    { gpid:1,  gname:'vip',         descr:'VIP tag',           price:199, sale:1, benefit:'VIP Tag' },
    { gpid:2,  gname:'x2coins',     descr:'Double coins',      price:299, sale:1, benefit:'Coin Multiplier x2' },
    { gpid:3,  gname:'x2xp',        descr:'Double XP',         price:249, sale:1, benefit:'XP Multiplier x2' },
    { gpid:4,  gname:'invplus',     descr:'+50 inventory slots',price:149, sale:1, benefit:'+50 Inventory Slots' },
    { gpid:5,  gname:'speed',       descr:'+10% walk speed',   price:179, sale:1, benefit:'+10% Speed Bonus' },
    { gpid:6,  gname:'petslot',     descr:'+1 pet equip slot', price:129, sale:1, benefit:'+1 Pet Slot' },
    { gpid:7,  gname:'autocollect', descr:'Auto pick-up items',price:399, sale:1, benefit:'Auto Collect' },
    { gpid:8,  gname:'teleport',    descr:'Teleport menu',     price:99,  sale:1, benefit:'Teleport Menu' },
    { gpid:9,  gname:'goldname',    descr:'Gold name color',   price:59,  sale:1, benefit:'Gold Name Color' },
    { gpid:10, gname:'giftpack',    descr:'Admin starter pack',price:0,   sale:0, benefit:'Bundle PackA' },
];

const PG = [   /* player_gamepasses */
    { pid:1,  gpid:1,  src:'purchase', act:1 },
    { pid:2,  gpid:2,  src:'purchase', act:1 },
    { pid:3,  gpid:3,  src:'gift',     act:1 },
    { pid:4,  gpid:4,  src:'purchase', act:1 },
    { pid:5,  gpid:5,  src:'purchase', act:1 },
    { pid:6,  gpid:6,  src:'promo',    act:1 },
    { pid:7,  gpid:7,  src:'purchase', act:1 },
    { pid:8,  gpid:8,  src:'purchase', act:1 },
    { pid:9,  gpid:9,  src:'purchase', act:0 },
    { pid:10, gpid:10, src:'admin',    act:1 },
];

const AUDIT = [
    { id:1, action:'INSERT', pid:1, gpid:4, o_src:null,       n_src:'purchase', o_act:null, n_act:1,    ts:'2026-03-11 13:29:05' },
    { id:2, action:'UPDATE', pid:1, gpid:4, o_src:'purchase', n_src:'purchase', o_act:1,    n_act:0,    ts:'2026-03-11 13:30:42' },
    { id:3, action:'UPDATE', pid:1, gpid:4, o_src:'purchase', n_src:'gifting',  o_act:0,    n_act:0,    ts:'2026-03-11 13:31:26' },
    { id:4, action:'DELETE', pid:1, gpid:4, o_src:'gifting',  n_src:null,       o_act:0,    n_act:null, ts:'2026-03-11 13:32:13' },
];

/* ========================================================
   ACCOUNTS STORE
   Default admin accounts + any newly registered users
======================================================== */
const ACCOUNTS = {
    admin: 'admin123',
    root:  'root',
};

/* ========================================================
   HELPERS
======================================================== */
const pname  = pid  => PLAYERS.find(p => p.pid  === pid)?.uname  || `PID ${pid}`;
const gpname = gpid => GAMEPASSES.find(g => g.gpid === gpid)?.gname || `GP ${gpid}`;
const pcount = pid  => PG.filter(x => x.pid === pid && x.act === 1).length;

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
}

/* ========================================================
   AUTH — LOGIN
======================================================== */
function doLogin() {
    const user = document.getElementById('l-user').value.trim();
    const pass = document.getElementById('l-pass').value;
    const btn  = document.getElementById('l-btn');
    const err  = document.getElementById('login-err');

    if (!user || !pass) {
        err.style.display = 'flex';
        return;
    }

    btn.innerHTML = '<span class="spin"></span> Logging in&hellip;';
    btn.disabled  = true;

    setTimeout(() => {
        btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Log In';
        btn.disabled  = false;

        if (ACCOUNTS[user] && ACCOUNTS[user] === pass) {
            err.style.display = 'none';
            document.getElementById('sb-uname').textContent = user;
            document.getElementById('sb-av').textContent    = user[0].toUpperCase();
            go('s-app');
            renderAll();
            toast('ok', `Welcome back, ${user}!`);
        } else {
            err.style.display = 'flex';
        }
    }, 900);
}

function doLogout() {
    go('s-login');
    document.getElementById('l-user').value = '';
    document.getElementById('l-pass').value = '';
    toast('info', 'You have been logged out.');
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
    const mSel = document.getElementById('su-month');
    months.forEach((m, i) => {
        const o = document.createElement('option');
        o.value       = String(i + 1).padStart(2, '0');
        o.textContent = m;
        mSel.appendChild(o);
    });

    const dSel = document.getElementById('su-day');
    for (let d = 1; d <= 31; d++) {
        const o = document.createElement('option');
        o.value       = String(d).padStart(2, '0');
        o.textContent = d;
        dSel.appendChild(o);
    }

    const ySel    = document.getElementById('su-year');
    const curYear = new Date().getFullYear();
    for (let y = curYear; y >= 1900; y--) {
        const o = document.createElement('option');
        o.value       = y;
        o.textContent = y;
        ySel.appendChild(o);
    }
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
    document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('picked'));
    el.classList.add('picked');
}

function doSignup() {
    const month   = document.getElementById('su-month').value;
    const day     = document.getElementById('su-day').value;
    const year    = document.getElementById('su-year').value;
    const uname   = document.getElementById('su-user').value.trim();
    const pass    = document.getElementById('su-pass').value;
    const confirm = document.getElementById('su-confirm').value;
    const terms   = document.getElementById('su-terms').checked;
    const btn     = document.getElementById('su-btn');

    if (!month || !day || !year) {
        toast('err', 'Please enter your birthday.');
        return;
    }
    if (!uname) {
        toast('err', 'Username is required.');
        return;
    }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(uname)) {
        toast('err', 'Username must be 3–20 characters (letters, numbers, underscores only).');
        return;
    }
    if (ACCOUNTS[uname]) {
        toast('err', 'That username is already taken. Please choose another.');
        return;
    }
    if (pass.length < 8) {
        toast('err', 'Password must be at least 8 characters.');
        return;
    }
    if (pass !== confirm) {
        toast('err', 'Passwords do not match.');
        return;
    }
    if (!terms) {
        toast('err', 'You must agree to the Terms of Use to sign up.');
        return;
    }

    btn.innerHTML = '<span class="spin"></span> Creating account&hellip;';
    btn.disabled  = true;

    setTimeout(() => {
        btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Sign Up';
        btn.disabled  = false;

        /* Register the new account */
        ACCOUNTS[uname] = pass;

        toast('ok', `Account created! Welcome, ${uname}. You can now log in.`);

        /* Pre-fill the login username for convenience */
        document.getElementById('l-user').value = uname;

        /* Reset sign-up form */
        document.getElementById('su-month').value   = '';
        document.getElementById('su-day').value     = '';
        document.getElementById('su-year').value    = '';
        document.getElementById('su-user').value    = '';
        document.getElementById('su-pass').value    = '';
        document.getElementById('su-confirm').value = '';
        document.getElementById('su-terms').checked = false;
        document.getElementById('su-str-bar').style.width       = '0';
        document.getElementById('su-str-label').textContent     = 'Strength: \u2014';
        document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('picked'));

        go('s-login');
    }, 1000);
}

/* ========================================================
   AUTH — PASSWORD RECOVERY
======================================================== */
function recStep1(resend) {
    const v = document.getElementById('r-ident').value.trim();
    if (!v) { toast('err', 'Please enter your username or email.'); return; }

    const masked = v.includes('@')
        ? v.replace(/(?<=.{2}).(?=.*@)/g, '*')
        : v[0] + '***' + v.slice(-1);
    document.getElementById('r-masked').textContent = masked;

    if (!resend) {
        document.getElementById('rs1').style.display = 'none';
        document.getElementById('rs2').style.display = 'block';
        stepDone('sp1', 'sl1', 'sp2');
    }
    toast('info', resend ? 'Code resent! Hint: 123456' : 'Code sent! Hint: 123456');
}

function recStep2() {
    const code = document.getElementById('r-code').value.trim();
    if (code !== '123456') { toast('err', 'Wrong code. Hint: 123456'); return; }
    document.getElementById('rs2').style.display = 'none';
    document.getElementById('rs3').style.display = 'block';
    stepDone('sp2', 'sl2', 'sp3');
}

function recStep3() {
    const p1 = document.getElementById('r-np').value;
    const p2 = document.getElementById('r-cp').value;
    if (p1.length < 8) { toast('err', 'Password must be at least 8 characters.'); return; }
    if (p1 !== p2)     { toast('err', 'Passwords do not match.'); return; }
    toast('ok', 'Password reset successfully! You can now log in.');
    setTimeout(() => { go('s-login'); resetRec(); }, 1600);
}

function stepDone(curId, lineId, nextId) {
    const cur  = document.getElementById(curId);
    const line = document.getElementById(lineId);
    const next = document.getElementById(nextId);
    cur.classList.replace('active', 'done');
    cur.innerHTML = '<i class="fa-solid fa-check" style="font-size:.58rem;"></i>';
    line.classList.add('done');
    next.classList.add('active');
}

function resetRec() {
    ['rs1', 'rs2', 'rs3'].forEach((id, i) => {
        document.getElementById(id).style.display = i === 0 ? 'block' : 'none';
    });
    ['sp1', 'sp2', 'sp3'].forEach((id, i) => {
        const el = document.getElementById(id);
        el.className  = 'step-pill' + (i === 0 ? ' active' : '');
        el.textContent = i + 1;
    });
    ['sl1', 'sl2'].forEach(id => document.getElementById(id).classList.remove('done'));
    document.getElementById('r-ident').value = '';
    document.getElementById('r-code').value  = '';
    document.getElementById('r-np').value    = '';
    document.getElementById('r-cp').value    = '';
    document.getElementById('str-bar').style.width       = '0';
    document.getElementById('str-label').textContent     = 'Strength: \u2014';
}

/* recovery password strength meter */
function chkStrength() {
    const v = document.getElementById('r-np').value;
    let s = 0;
    if (v.length >= 8)          s++;
    if (/[A-Z]/.test(v))        s++;
    if (/[0-9]/.test(v))        s++;
    if (/[^a-zA-Z0-9]/.test(v)) s++;
    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
    const colors = ['', '#e03c31', '#facc15', '#00a2ff', '#22c55e'];
    const pcts   = ['0%', '25%', '50%', '75%', '100%'];
    document.getElementById('str-label').textContent = `Strength: ${labels[s] || '\u2014'}`;
    const bar = document.getElementById('str-bar');
    bar.style.width      = pcts[s];
    bar.style.background = colors[s] || 'transparent';
}

/* ========================================================
   APP NAVIGATION
======================================================== */
const PAGE_TITLES = {
    'p-dash':       'Dashboard',
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
}

/* ========================================================
   RENDER
======================================================== */
function renderAll() {
    updateDate();
    renderTx();
    renderPriceBars();
    renderPlayers(PLAYERS);
    renderGP(GAMEPASSES);
    renderAudit();
}

function updateDate() {
    document.getElementById('tb-date').textContent =
        new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderTx() {
    document.getElementById('tb-tx').innerHTML = PG.map(r => `
        <tr>
            <td><b>${pname(r.pid)}</b></td>
            <td><span class="ptag"><i class="fa-solid fa-ticket"></i>${gpname(r.gpid)}</span></td>
            <td>${srcBadge(r.src)}</td>
            <td>${actBadge(r.act)}</td>
        </tr>`).join('');
}

function renderPriceBars() {
    const max = Math.max(...GAMEPASSES.map(g => g.price));
    document.getElementById('price-bars').innerHTML = GAMEPASSES.map(g => {
        const pct = max > 0 ? Math.round(g.price / max * 100) : 4;
        return `<div class="bar-item">
            <div class="bar-name">${g.gname}</div>
            <div class="bar-track">
                <div class="bar-fill" style="width:${pct}%"></div>
            </div>
            <div class="bar-val">${g.price ? 'R$' + g.price : 'Free'}</div>
        </div>`;
    }).join('');
}

function renderPlayers(data) {
    const tb = document.getElementById('tb-players');
    if (!data.length) {
        tb.innerHTML = '<tr><td colspan="6"><div class="empty"><i class="fa-solid fa-users-slash"></i><p>No players found.</p></div></td></tr>';
        return;
    }
    tb.innerHTML = data.map(p => `
        <tr>
            <td style="color:var(--text-3);font-size:.78rem;">${p.pid}</td>
            <td><b>${p.uname}</b></td>
            <td style="color:var(--text-2);">${p.jdate}</td>
            <td>${actBadge(p.stat === 'active' ? 1 : 0, p.stat)}</td>
            <td><span class="ptag"><i class="fa-solid fa-ticket"></i>${pcount(p.pid)} pass${pcount(p.pid) !== 1 ? 'es' : ''}</span></td>
            <td>
                <button class="btn btn-ghost" onclick="toggleBan(${p.pid})"
                        style="padding:5px 11px;font-size:.75rem;">
                    <i class="fa-solid fa-${p.stat === 'active' ? 'ban' : 'rotate-left'}"></i>
                    ${p.stat === 'active' ? 'Ban' : 'Unban'}
                </button>
            </td>
        </tr>`).join('');
}

function renderGP(data) {
    const tb = document.getElementById('tb-gp');
    if (!data.length) {
        tb.innerHTML = '<tr><td colspan="6"><div class="empty"><i class="fa-solid fa-ticket"></i><p>No passes found.</p></div></td></tr>';
        return;
    }
    tb.innerHTML = data.map(g => `
        <tr>
            <td style="color:var(--text-3);font-size:.78rem;">${g.gpid}</td>
            <td><b>${g.gname}</b></td>
            <td style="color:var(--text-2);">${g.descr}</td>
            <td style="font-weight:800;color:var(--yellow);">${g.price ? 'R$ ' + g.price : '<span style="color:var(--green);">Free</span>'}</td>
            <td><span class="ptag">${g.benefit}</span></td>
            <td><span class="badge ${g.sale ? 'b-on' : 'b-off'}"><span class="badge-dot"></span>${g.sale ? 'On Sale' : 'Off Sale'}</span></td>
        </tr>`).join('');
}

function renderAudit() {
    document.getElementById('tb-audit').innerHTML = AUDIT.map(a => `
        <tr>
            <td style="color:var(--text-3);font-size:.78rem;">${a.id}</td>
            <td>${actionBadge(a.action)}</td>
            <td><b>${pname(a.pid)}</b></td>
            <td><span class="ptag"><i class="fa-solid fa-ticket"></i>${gpname(a.gpid)}</span></td>
            <td style="color:var(--text-2);">${a.o_src ?? '&mdash;'}</td>
            <td style="color:var(--text-2);">${a.n_src ?? '&mdash;'}</td>
            <td>${a.o_act != null ? actBadge(a.o_act) : '&mdash;'}</td>
            <td>${a.n_act != null ? actBadge(a.n_act) : '&mdash;'}</td>
            <td style="color:var(--text-3);font-size:.76rem;">${a.ts}</td>
        </tr>`).join('');
}

/* ========================================================
   PLAYER ACTIONS
======================================================== */
function filterPlayers() {
    const q = document.getElementById('pl-search').value.toLowerCase();
    renderPlayers(PLAYERS.filter(p =>
        p.uname.toLowerCase().includes(q) || p.stat.includes(q)
    ));
}

function filterGP() {
    const q = document.getElementById('gp-search').value.toLowerCase();
    renderGP(GAMEPASSES.filter(g =>
        g.gname.toLowerCase().includes(q) ||
        g.descr.toLowerCase().includes(q) ||
        g.benefit.toLowerCase().includes(q)
    ));
}

function toggleBan(pid) {
    const p = PLAYERS.find(x => x.pid === pid);
    if (!p) return;
    p.stat = p.stat === 'active' ? 'banned' : 'active';
    renderPlayers(PLAYERS);
    toast(p.stat === 'banned' ? 'err' : 'ok',
        `${p.uname} has been ${p.stat === 'banned' ? 'banned' : 'unbanned'}.`);
}

function openModal(id) {
    document.getElementById('ap-date').value = new Date().toISOString().split('T')[0];
    document.getElementById(id).classList.add('open');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('open');
}

function addPlayer() {
    const name = document.getElementById('ap-name').value.trim();
    const date = document.getElementById('ap-date').value;
    const stat = document.getElementById('ap-status').value;
    if (!name) { toast('err', 'Username is required.'); return; }
    const newPid = Math.max(...PLAYERS.map(p => p.pid)) + 1;
    PLAYERS.push({ pid: newPid, uname: name, jdate: date, stat });
    renderPlayers(PLAYERS);
    closeModal('m-addplayer');
    toast('ok', `Player "${name}" added successfully!`);
    document.getElementById('ap-name').value = '';
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
                <thead><tr><th>PID</th><th>Username</th><th>Join Date</th><th>Status</th><th>Owned Passes</th></tr></thead>
                <tbody>${PLAYERS.map(p => `<tr>
                    <td>${p.pid}</td><td><b>${p.uname}</b></td><td>${p.jdate}</td>
                    <td>${actBadge(p.stat === 'active' ? 1 : 0, p.stat)}</td>
                    <td>${pcount(p.pid)}</td>
                </tr>`).join('')}</tbody>
            </table>`;
            break;

        case 'revenue': {
            title.textContent = 'Revenue Report';
            const rev = PG
                .filter(r => r.src === 'purchase' && r.act === 1)
                .reduce((s, r) => s + (GAMEPASSES.find(g => g.gpid === r.gpid)?.price || 0), 0);
            body.innerHTML = `
                <div style="padding:16px 16px 0;">
                    <div class="alert alert-ok">
                        <i class="fa-solid fa-coins"></i>
                        <span>Total Revenue from Active Purchases: <b>R$ ${rev}</b></span>
                    </div>
                </div>
                <table>
                    <thead><tr><th>GPID</th><th>Name</th><th>Price (R$)</th><th>Benefit</th><th>For Sale</th></tr></thead>
                    <tbody>${GAMEPASSES.map(g => `<tr>
                        <td>${g.gpid}</td><td><b>${g.gname}</b></td>
                        <td style="font-weight:800;color:var(--yellow);">${g.price ? 'R$ ' + g.price : 'Free'}</td>
                        <td>${g.benefit}</td>
                        <td><span class="badge ${g.sale ? 'b-on' : 'b-off'}">${g.sale ? 'On Sale' : 'Off Sale'}</span></td>
                    </tr>`).join('')}</tbody>
                </table>`;
            break;
        }

        case 'ownership':
            title.textContent = 'Pass Ownership Report';
            body.innerHTML = `<table>
                <thead><tr><th>Player</th><th>Game Pass</th><th>Source</th><th>Status</th></tr></thead>
                <tbody>${PG.map(r => `<tr>
                    <td><b>${pname(r.pid)}</b></td>
                    <td><span class="ptag"><i class="fa-solid fa-ticket"></i>${gpname(r.gpid)}</span></td>
                    <td>${srcBadge(r.src)}</td>
                    <td>${actBadge(r.act)}</td>
                </tr>`).join('')}</tbody>
            </table>`;
            break;

        case 'audit':
            title.textContent = 'Audit Log Report';
            body.innerHTML = `<table>
                <thead><tr>
                    <th>ID</th><th>Action</th><th>Player</th><th>Pass</th>
                    <th>Old Src</th><th>New Src</th><th>Old Act</th><th>New Act</th><th>Timestamp</th>
                </tr></thead>
                <tbody>${AUDIT.map(a => `<tr>
                    <td>${a.id}</td>
                    <td>${actionBadge(a.action)}</td>
                    <td><b>${pname(a.pid)}</b></td>
                    <td>${gpname(a.gpid)}</td>
                    <td>${a.o_src ?? '&mdash;'}</td><td>${a.n_src ?? '&mdash;'}</td>
                    <td>${a.o_act != null ? a.o_act : '&mdash;'}</td>
                    <td>${a.n_act != null ? a.n_act : '&mdash;'}</td>
                    <td style="font-size:.76rem;">${a.ts}</td>
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
