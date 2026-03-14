import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getAuth, signInWithCustomToken, signOut, onAuthStateChanged, updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    getFirestore, doc, setDoc, getDoc,
    collection, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyA9rO5HkGJytgMTGrPu0rAWkUCAxqScB_0",
    authDomain: "distiplina-d5db3.firebaseapp.com",
    projectId: "distiplina-d5db3",
    storageBucket: "distiplina-d5db3.firebasestorage.app",
    messagingSenderId: "981915948879",
    appId: "1:981915948879:web:1ff690539b1a8df2c5173a"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
window._db = db;

// Bot server URL — bot.js ishga tushgan server IP si
const CF_BASE = 'https://dazzling-grace-production-9e1b.up.railway.app';

/* ─── THEME ─────────────────────────────────────── */
function applyThemeUI(isLight) {
    ['theme-toggle', 'm-theme-toggle'].forEach(id => {
        document.getElementById(id)?.classList.toggle('on', isLight);
    });
    ['theme-icon', 'm-theme-icon'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = isLight ? '☀️' : '🌙';
    });
    ['theme-label', 'm-theme-label'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = isLight ? 'Light Mode' : 'Dark Mode';
    });
}
if (localStorage.getItem('theme') === 'light') {
    document.body.classList.add('light');
    applyThemeUI(true);
}
window.toggleTheme = () => {
    const isLight = document.body.classList.toggle('light');
    applyThemeUI(isLight);
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
};

/* ─── AUTH STATE ─────────────────────────────────── */
onAuthStateChanged(auth, async (user) => {
    if (user) {
        window._user = user;
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app').classList.add('visible');

        // User ma'lumotlarini Firestore dan olish (tg avatar, ism)
        try {
            const userSnap = await getDoc(doc(db, 'users', user.uid));
            if (userSnap.exists()) {
                const userData = userSnap.data();
                const name = userData.name || user.displayName || 'Foydalanuvchi';
                const phone = userData.phone || '';
                const photoUrl = userData.tgPhotoUrl || '';

                setAvatars(name, photoUrl);
                document.getElementById('dd-name').textContent = name;
                document.getElementById('dd-email').textContent = phone;
                document.getElementById('drawer-name').textContent = name;
                document.getElementById('drawer-email').textContent = phone;
            } else {
                const name = user.displayName || 'Foydalanuvchi';
                setAvatars(name, '');
                document.getElementById('dd-name').textContent = name;
                document.getElementById('dd-email').textContent = '';
                document.getElementById('drawer-name').textContent = name;
                document.getElementById('drawer-email').textContent = '';
            }
        } catch (e) {
            const name = user.displayName || 'U';
            setAvatars(name, '');
        }

        await renderCalendar();
        loadStats();
    } else {
        window._user = null;
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('app').classList.remove('visible');
        showOtpForm(false);
        hideErr();
    }
});

// Avatar o'rnatish — rasm bo'lsa rasm, bo'lmasa harf
function setAvatars(name, photoUrl) {
    const letter = (name || 'U').charAt(0).toUpperCase();
    const ids = [
        { img: 'nav-avatar-img', letter: 'nav-avatar-letter' },
        { img: 'dd-avatar-img', letter: 'dd-avatar-letter' },
        { img: 'drawer-avatar-img', letter: 'drawer-avatar-letter' },
    ];
    ids.forEach(({ img, letter: letterId }) => {
        const imgEl = document.getElementById(img);
        const letterEl = document.getElementById(letterId);
        if (photoUrl && imgEl) {
            imgEl.src = photoUrl;
            imgEl.style.display = 'block';
            if (letterEl) letterEl.style.display = 'none';
        } else {
            if (imgEl) imgEl.style.display = 'none';
            if (letterEl) { letterEl.style.display = 'inline'; letterEl.textContent = letter; }
        }
    });

    // Mobile bottom tab avatar
    const mobileImg = document.getElementById('mobile-avatar-img');
    const mobileFallback = document.getElementById('mobile-avatar-fallback');
    if (photoUrl && mobileImg) {
        mobileImg.src = photoUrl;
        mobileImg.style.display = 'inline-block';
        if (mobileFallback) mobileFallback.style.display = 'none';
    } else {
        if (mobileImg) mobileImg.style.display = 'none';
        if (mobileFallback) mobileFallback.style.display = 'inline';
    }
}

/* ─── OTP TIMER ──────────────────────────────────── */
let otpTimerInterval = null;
let otpSeconds = 120;
let pendingPhone = '';

function startOtpTimer() {
    otpSeconds = 120;
    clearOtpTimer();
    updateTimerDisplay();
    otpTimerInterval = setInterval(() => {
        otpSeconds--;
        updateTimerDisplay();
        if (otpSeconds <= 0) {
            clearOtpTimer();
            document.getElementById('otp-resend-btn').disabled = false;
            document.getElementById('otp-timer').textContent = 'Kod muddati tugadi';
        }
    }, 1000);
}
function clearOtpTimer() {
    if (otpTimerInterval) { clearInterval(otpTimerInterval); otpTimerInterval = null; }
}
function updateTimerDisplay() {
    const m = Math.floor(otpSeconds / 60);
    const s = otpSeconds % 60;
    document.getElementById('otp-timer').textContent = `Yangi kod ${m}:${String(s).padStart(2, '0')} dan keyin`;
    document.getElementById('otp-resend-btn').disabled = otpSeconds > 0;
}

function showOtpForm(show, phone = '') {
    document.getElementById('otp-section').style.display = show ? 'block' : 'none';
    document.getElementById('phone-form').style.display = show ? 'none' : 'block';
    if (show) {
        document.getElementById('otp-phone-display').textContent = phone;
        document.getElementById('otp-code').value = '';
        startOtpTimer();
        setTimeout(() => document.getElementById('otp-code').focus(), 100);
    } else {
        clearOtpTimer();
    }
}

/* ─── AUTH FUNCTIONS ─────────────────────────────── */
window.doLoginPhone = async () => {
    const raw = document.getElementById('login-phone').value.trim();
    const phone = normalizePhone(raw);
    if (!phone) { showErr('Telefon raqamni to\'g\'ri kiriting'); return; }
    hideErr();
    setBtnLoading('login-phone-btn', true);
    try {
        await sendOtp(phone);
        pendingPhone = phone;
        showOtpForm(true, phone);
    } catch (e) {
        showErr(friendlyError(e.message));
    } finally {
        setBtnLoading('login-phone-btn', false);
    }
};

window.doVerifyOtp = async () => {
    const code = document.getElementById('otp-code').value.trim();
    if (code.length !== 6) { showErr('6 xonali kodni kiriting'); return; }
    hideErr();
    setBtnLoading('otp-verify-btn', true);
    try {
        const res = await fetch(`${CF_BASE}/verifyOtp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: pendingPhone, code })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.message || 'Xatolik');
        await signInWithCustomToken(auth, data.token);
        clearOtpTimer();
    } catch (e) {
        showErr(friendlyError(e.message));
    } finally {
        setBtnLoading('otp-verify-btn', false);
    }
};

window.doResendOtp = async () => {
    hideErr();
    document.getElementById('otp-resend-btn').disabled = true;
    try {
        await sendOtp(pendingPhone);
        startOtpTimer();
        showToast('✅ Yangi kod yuborildi!', 'success');
    } catch (e) {
        showErr(friendlyError(e.message));
        document.getElementById('otp-resend-btn').disabled = false;
    }
};

window.cancelOtp = () => {
    showOtpForm(false);
    pendingPhone = '';
    hideErr();
};

async function sendOtp(phone) {
    const res = await fetch(`${CF_BASE}/sendOtp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.message || 'Kod yuborishda xatolik');
    return data;
}

function normalizePhone(raw) {
    let p = raw.trim();
    // Agar + bilan boshlansa — to'g'ridan-to'g'ri
    if (p.startsWith('+')) {
        const digits = p.replace(/\D/g, '');
        return digits.length >= 7 && digits.length <= 15 ? '+' + digits : '';
    }
    // Faqat raqamlar
    const digits = p.replace(/\D/g, '');
    if (digits.length >= 7 && digits.length <= 15) return '+' + digits;
    return '';
}

window.doLogout = async () => {
    closeProfile();
    document.getElementById('nav-dropdown').classList.remove('open');
    await signOut(auth);
};

function friendlyError(msg) {
    const map = {
        'no-chat-id': 'Bu raqam Telegram bot bilan bog\'lanmagan.\n@panjiyevdevbot ga /start bosing',
        'user-not-found': 'Bu telefon raqami topilmadi',
        'invalid-code': 'Noto\'g\'ri kod',
        'code-expired': 'Kod muddati o\'tdi. Yangi kod oling',
        'too-many-requests': 'Iltimos, 1 daqiqa kuting',
    };
    for (const [k, v] of Object.entries(map)) {
        if (msg.includes(k)) return v;
    }
    return msg || 'Noma\'lum xatolik';
}

function showErr(msg) {
    const e = document.getElementById('auth-err');
    e.textContent = msg; e.style.display = 'block';
}
function hideErr() { document.getElementById('auth-err').style.display = 'none'; }

function setBtnLoading(id, loading) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.disabled = loading;
    btn.dataset.orig = btn.dataset.orig || btn.textContent;
    btn.textContent = loading ? 'Yuklanmoqda...' : btn.dataset.orig;
}

/* ─── CALENDAR ───────────────────────────────────── */
let calYear, calMonth;
const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];

function pad(n) { return String(n).padStart(2, '0'); }
function mkDs(y, m, d) { return `${y}-${pad(m)}-${pad(d)}`; }
function addDays(ds, n) { const d = new Date(ds); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0]; }
function getTodayStr() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function getYesterdayStr() { const d = new Date(); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

window.changeMonth = (dir) => {
    calMonth += dir;
    if (calMonth > 12) { calMonth = 1; calYear++; }
    if (calMonth < 1) { calMonth = 12; calYear--; }
    renderCalendar();
};

async function renderCalendar() {
    const now = new Date();
    if (!calYear) { calYear = now.getFullYear(); calMonth = now.getMonth() + 1; }
    document.getElementById('cal-month-label').textContent = `${MONTHS[calMonth - 1]} ${calYear}`;

    const today = getTodayStr(), yest = getYesterdayStr();
    const uid = window._user.uid;
    const monthKey = `${calYear}-${pad(calMonth)}`;
    const saved = {};

    try {
        const snap = await getDocs(query(
            collection(db, 'entries'),
            where('uid', '==', uid),
            where('month', '==', monthKey)
        ));
        snap.forEach(d => { saved[d.id.split('_')[1]] = true; });
    } catch (e) { }

    const grid = document.getElementById('cal-grid');
    grid.innerHTML = '';
    ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'].forEach(h => {
        const el = document.createElement('div'); el.className = 'cal-day-header'; el.textContent = h; grid.appendChild(el);
    });

    const firstDay = new Date(calYear, calMonth - 1, 1).getDay();
    const emptyStart = firstDay === 0 ? 6 : firstDay - 1;
    const daysCount = new Date(calYear, calMonth, 0).getDate();

    for (let i = 0; i < emptyStart; i++) {
        const e = document.createElement('div'); e.className = 'cal-cell empty'; grid.appendChild(e);
    }
    for (let d = 1; d <= daysCount; d++) {
        const ds = mkDs(calYear, calMonth, d);
        const cell = document.createElement('div'); cell.className = 'cal-cell';
        const numEl = document.createElement('div'); numEl.className = 'day-num'; numEl.textContent = d;
        cell.appendChild(numEl);

        if (ds === today) {
            cell.classList.add('today');
            const lbl = document.createElement('div'); lbl.className = 'cell-label'; lbl.textContent = 'Bugun'; cell.appendChild(lbl);
            cell.onclick = () => openModal(ds, 'today');
        } else if (ds === yest) {
            cell.classList.add('yesterday');
            const lbl = document.createElement('div'); lbl.className = 'cell-label'; lbl.textContent = 'Kecha'; cell.appendChild(lbl);
            cell.onclick = () => openModal(ds, 'yesterday');
        } else {
            cell.classList.add('future');
        }
        if (saved[ds]) {
            cell.classList.add('has-data');
            const dot = document.createElement('div'); dot.className = 'dot'; cell.appendChild(dot);
        }
        grid.appendChild(cell);
    }
}

/* ─── MODAL ──────────────────────────────────────── */
let currentDate = null;

window.openModal = async (ds, mode) => {
    currentDate = ds;
    const [y, m, d] = ds.split('-');
    document.getElementById('modal-date-title').textContent = `${d} ${MONTHS[parseInt(m) - 1]} ${y}`;
    document.getElementById('modal-date-sub').textContent = mode === 'today' ? '📝 Bugungi yozuvlar' : '✏️ Kechagi yozuvlar (tahrirlash mumkin)';

    let subjects = [];
    try {
        const snap = await getDoc(doc(db, 'entries', `${window._user.uid}_${ds}`));
        if (snap.exists()) subjects = snap.data().subjects || [];
    } catch (e) { }

    renderModalBody(subjects);
    document.getElementById('modal-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
};

function renderModalBody(subjects) {
    const body = document.getElementById('modal-body-content');
    body.innerHTML = '';
    const list = document.createElement('div'); list.className = 'subjects-list'; list.id = 'subjects-list';
    subjects.forEach(s => addSubjectCard(list, s));
    body.appendChild(list);
    const addBtn = document.createElement('button');
    addBtn.className = 'add-subject-btn';
    addBtn.innerHTML = "+ Yangi fan / yo'nalish qo'shish";
    addBtn.onclick = () => addSubjectCard(document.getElementById('subjects-list'), { subject: '', notes: '' });
    body.appendChild(addBtn);
    const footer = document.createElement('div'); footer.className = 'modal-footer';
    footer.innerHTML = `<button class="btn-secondary" onclick="closeModal()">Bekor qilish</button><button class="btn-save" onclick="saveEntry()">💾 Saqlash</button>`;
    body.appendChild(footer);
}

function addSubjectCard(list, data) {
    const card = document.createElement('div'); card.className = 'subject-card';
    const num = list.querySelectorAll('.subject-card').length + 1;
    card.innerHTML = `
    <div class="subject-card-header">
      <span class="subject-num">FAN #${num}</span>
      <button class="remove-subject" onclick="this.closest('.subject-card').remove()">✕</button>
    </div>
    <div class="inp-row">
      <div>
        <label class="inp-label">Yo'nalish / Fan nomi</label>
        <input class="mini-inp subject-name" placeholder="Masalan: Python, Ingliz tili..." value="${esc(data.subject || '')}">
      </div>
      <div>
        <label class="inp-label">Bugun nimalar o'rgandim</label>
        <textarea class="mini-inp textarea subject-notes" placeholder="Masalan: if, for, while...">${esc(data.notes || '')}</textarea>
      </div>
    </div>`;
    list.appendChild(card);
}

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

window.closeModal = () => { document.getElementById('modal-overlay').classList.remove('open'); document.body.style.overflow = ''; };
window.closeModalOnBg = (e) => { if (e.target === document.getElementById('modal-overlay')) closeModal(); };

window.saveEntry = async () => {
    const cards = document.querySelectorAll('#subjects-list .subject-card');
    const subjects = [];
    cards.forEach(c => {
        const name = c.querySelector('.subject-name').value.trim();
        const notes = c.querySelector('.subject-notes').value.trim();
        if (name) subjects.push({ subject: name, notes });
    });
    if (!subjects.length) { showToast('Kamida 1 ta fan kiriting!', 'error'); return; }
    const uid = window._user.uid;
    const [y, m] = currentDate.split('-');
    try {
        await setDoc(doc(db, 'entries', `${uid}_${currentDate}`), {
            uid, date: currentDate, month: `${y}-${m}`, subjects,
            updatedAt: new Date().toISOString(),
            reminderDate: addDays(currentDate, 3),
            reminderStatus: 'pending'
        });
        showToast('✅ Saqlandi!', 'success');
        closeModal();
        await renderCalendar();
        if (document.getElementById('page-stats').classList.contains('active')) loadStats();
    } catch (e) { showToast('Xatolik: ' + e.message, 'error'); }
};

/* ─── STATS ──────────────────────────────────────── */
async function loadStats() {
    if (!window._user) return;
    const snap = await getDocs(query(collection(db, 'entries'), where('uid', '==', window._user.uid)));
    let total = 0, confirmed = 0, notConfirmed = 0, partial = 0;
    const subjectMap = {}, incomplete = [];

    snap.forEach(d => {
        const data = d.data(); total++;
        const st = data.reminderStatus || 'pending';
        if (st === 'mastered') confirmed++;
        else if (st === 'not_learned') notConfirmed++;
        else if (st === 'partial') partial++;
        (data.subjects || []).forEach(s => {
            if (!subjectMap[s.subject]) subjectMap[s.subject] = { name: s.subject, entries: [], status: st };
            subjectMap[s.subject].entries.push({ date: data.date, notes: s.notes, status: st });
            if (st !== 'mastered') incomplete.push({ subject: s.subject, notes: s.notes, date: data.date, status: st });
        });
    });

    document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card"><div class="stat-card-label">Jami yozuv kunlari</div><div class="stat-card-val purple">${total}</div></div>
    <div class="stat-card"><div class="stat-card-label">Mukammal o'rganildi</div><div class="stat-card-val green">${confirmed}</div></div>
    <div class="stat-card"><div class="stat-card-label">Chala o'rganildi</div><div class="stat-card-val yellow">${partial}</div></div>
    <div class="stat-card"><div class="stat-card-label">O'rganilmadi</div><div class="stat-card-val red">${notConfirmed}</div></div>`;

    const tbody = document.getElementById('stats-table');
    tbody.innerHTML = '';
    Object.values(subjectMap).forEach(s => {
        const last = s.entries.sort((a, b) => b.date.localeCompare(a.date))[0];
        const st = last.status;
        const badge = st === 'mastered' ? '<span class="badge badge-green">✅ Mukammal</span>' : st === 'partial' ? '<span class="badge badge-yellow">⚠️ Chala</span>' : st === 'not_learned' ? '<span class="badge badge-red">❌ O\'rganilmadi</span>' : '<span class="badge badge-purple">⏳ Jarayonda</span>';
        tbody.innerHTML += `<tr><td><strong>${esc(s.name)}</strong></td><td style="color:var(--text2)">${last.date}</td><td>${badge}</td><td style="color:var(--text2);font-size:13px">${st === 'mastered' ? '—' : '📅 ' + addDays(last.date, 3)}</td></tr>`;
    });

    const il = document.getElementById('incomplete-list');
    il.innerHTML = '';
    if (!incomplete.length) {
        il.innerHTML = "<div style=\"color:var(--text2);font-size:14px;padding:20px 0\">Hammasi mukammal o'rganilgan! 🎉</div>";
        return;
    }
    incomplete.slice(0, 20).forEach(item => {
        const color = item.status === 'not_learned' ? 'var(--danger)' : 'var(--warn)';
        const icon = item.status === 'not_learned' ? '❌' : '⚠️';
        il.innerHTML += `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:16px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><strong style="color:${color}">${icon} ${esc(item.subject)}</strong><span style="font-size:12px;color:var(--text3)">${item.date}</span></div><div style="font-size:13px;color:var(--text2);line-height:1.5">${esc(item.notes).substring(0, 120)}${item.notes.length > 120 ? '...' : ''}</div></div>`;
    });
}

/* ─── UI HELPERS ─────────────────────────────────── */
window.showPage = (page) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.bottom-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');
    const idx = { calendar: 0, stats: 1 }[page];
    document.querySelectorAll('.nav-tab')[idx]?.classList.add('active');
    document.getElementById(`btab-${page}`)?.classList.add('active');
    if (page === 'stats') loadStats();
};

window.toggleDropdown = () => { document.getElementById('nav-dropdown').classList.toggle('open'); };
document.addEventListener('click', e => {
    if (!e.target.closest('.nav-avatar-wrap')) document.getElementById('nav-dropdown').classList.remove('open');
});

window.openProfile = () => {
    document.getElementById('drawer-overlay').classList.add('open');
    document.getElementById('profile-drawer').classList.add('open');
    document.body.style.overflow = 'hidden';
};
window.closeProfile = () => {
    document.getElementById('drawer-overlay').classList.remove('open');
    document.getElementById('profile-drawer').classList.remove('open');
    document.body.style.overflow = '';
};

window.addEventListener('resize', () => {
    if (window.innerWidth >= 641) {
        document.body.style.overflow = '';
        document.getElementById('nav-dropdown').classList.remove('open');
    }
});

function showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    t.textContent = msg; t.className = `toast ${type} show`;
    setTimeout(() => t.classList.remove('show'), 3000);
}