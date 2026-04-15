import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, onValue, update, get, remove } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAEMpC9oczMDYybbkZirDkY9a25d8ZqjJw",
  authDomain: "jml-loans-560d8.firebaseapp.com",
  projectId: "jml-loans-560d8",
  storageBucket: "jml-loans-560d8.firebasestorage.app",
  databaseURL: "https://jml-loans-560d8-default-rtdb.europe-west1.firebasedatabase.app", 
  messagingSenderId: "425047270355",
  appId: "1:425047270355:web:6ccd08365ca1cde7354526"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

let clients = [];
let currentUser = null;
let currentIndex = null;
let isAdmin = false;

// --- AUTH ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const staffRef = ref(db, `jml_users/${user.uid}`);
        const snap = await get(staffRef);
        let userData = snap.val();
        
        if (!userData) {
            userData = { email: user.email, role: 'staff', disabled: false };
            await set(staffRef, userData);
        }
        if (userData.disabled) {
            alert("Access Denied.");
            signOut(auth);
            return;
        }

        currentUser = user;
        isAdmin = userData.role === 'admin';
        document.getElementById('user-display').innerText = user.email;
        document.getElementById('login-overlay').classList.add('hidden');
        if (isAdmin) document.getElementById('admin-nav').classList.remove('hidden');
        loadData();
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
    }
});

// --- CORE FUNCTIONS ---
function loadData() {
    const dataPath = isAdmin ? 'jml_data/' : `jml_data/${currentUser.uid}`;
    onValue(ref(db, dataPath), (snap) => {
        const raw = snap.val() || {};
        clients = isAdmin ? Object.values(raw).flatMap(u => Object.values(u)) : Object.values(raw);
        renderTable();
        updateFinancials();
        renderSettled();
    });
    
    onValue(ref(db, 'jml_debts'), (snap) => renderDebts(snap.val()));
    onValue(ref(db, 'jml_finance/grand_total'), (snap) => {
        document.getElementById('grand-total-val').value = snap.val() || 0;
    });
}

function saveData() {
    set(ref(db, `jml_data/${currentUser.uid}`), clients);
}

function updateFinancials() {
    let out = 0, paid = 0, today = 0;
    const now = new Date().toLocaleDateString('en-GB');
    
    clients.forEach(c => {
        out += (c.balance || 0);
        paid += (c.totalPaid || 0);
        (c.history || []).forEach(h => {
            if(h.date === now) today += (h.amt || 0);
        });
    });

    document.getElementById('total-out').innerText = `KSh ${out.toLocaleString()}`;
    document.getElementById('total-paid').innerText = `KSh ${paid.toLocaleString()}`;
    document.getElementById('total-today').innerText = `KSh ${today.toLocaleString()}`;
    document.getElementById('top-today').innerText = `KSh ${today.toLocaleString()}`;
}

// --- UI RENDERING ---
function renderTable() {
    const term = document.getElementById('globalSearch').value.toLowerCase();
    const tbody = document.getElementById('clientTableBody');
    tbody.innerHTML = clients.filter(c => !c.settled).map((c, i) => {
        if(c.name.toLowerCase().includes(term) || c.idNumber.includes(term)) {
            return `<tr>
                <td>${i+1}</td>
                <td><strong>${c.name}</strong></td>
                <td>${c.idNumber}</td>
                <td>KSh ${c.totalPaid.toLocaleString()}</td>
                <td style="color:var(--accent); font-weight:bold">KSh ${c.balance.toLocaleString()}</td>
                <td><button class="view-btn" data-index="${i}">Open</button></td>
            </tr>`;
        }
    }).join('');
    
    // Attach listeners to buttons
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.onclick = () => openDashboard(btn.dataset.index);
    });
}

function openDashboard(i) {
    currentIndex = i;
    const c = clients[i];
    document.getElementById('d-name').innerText = c.name;
    document.getElementById('d-meta').innerText = `ID: ${c.idNumber} | Ref: ${c.referral || 'None'}`;
    document.getElementById('d-principal').innerText = c.principal.toLocaleString();
    document.getElementById('d-balance').innerText = c.balance.toLocaleString();
    document.getElementById('d-notes').value = c.notes || "";
    
    document.getElementById('historyBody').innerHTML = (c.history || []).map(h => `
        <tr class="${h.act === 'SKIPPED' ? 'skipped-day' : ''}">
            <td>${h.date}</td>
            <td>${h.time}</td>
            <td>${h.amt}</td>
            <td>${h.by}</td>
        </tr>
    `).join('');
    document.getElementById('detailWindow').classList.remove('hidden');
}

// --- EVENT HANDLERS (EXPOSED TO WINDOW) ---
window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.remove('hidden');
};

document.getElementById('loginBtn').onclick = () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, e, p).catch(err => alert(err.message));
};

document.getElementById('logoutBtn').onclick = () => signOut(auth);

document.getElementById('togglePassword').onclick = () => {
    const p = document.getElementById('login-password');
    p.type = p.type === "password" ? "text" : "password";
};

document.getElementById('recordPayBtn').onclick = () => {
    const amt = parseFloat(document.getElementById('payAmt').value);
    const time = document.getElementById('payTime').value;
    if(!amt) return;

    const c = clients[currentIndex];
    if(!c.history) c.history = [];
    
    c.balance -= amt;
    c.totalPaid += amt;
    c.history.push({
        date: new Date().toLocaleDateString('en-GB'),
        time: time,
        amt: amt,
        by: currentUser.email.split('@')[0],
        act: "PAYMENT"
    });
    
    saveData();
    openDashboard(currentIndex);
    document.getElementById('payAmt').value = "";
};

document.getElementById('settleBtn').onclick = () => {
    if(!confirm("Settle and issue new loan?")) return;
    const c = clients[currentIndex];
    c.settled = true;
    
    // Push a fresh clone for re-loan
    const fresh = {...c, balance: c.principal * 1.25, totalPaid: 0, history: [], settled: false};
    clients.push(fresh);
    saveData();
    document.getElementById('detailWindow').classList.add('hidden');
};

document.getElementById('clientForm').onsubmit = (e) => {
    e.preventDefault();
    const loan = parseFloat(document.getElementById('f-loan').value);
    clients.push({
        name: document.getElementById('f-name').value,
        idNumber: document.getElementById('f-id').value,
        phone: document.getElementById('f-phone').value,
        referral: document.getElementById('f-ref').value,
        principal: loan,
        balance: loan * 1.25,
        totalPaid: 0,
        startDate: document.getElementById('f-start').value,
        endDate: document.getElementById('f-end').value,
        history: [],
        settled: false
    });
    saveData();
    e.target.reset();
    showSection('list-sec');
};

document.getElementById('globalSearch').oninput = renderTable;
document.getElementById('closeDetail').onclick = () => document.getElementById('detailWindow').classList.add('hidden');
document.getElementById('menuToggle').onclick = () => document.getElementById('sidebar').classList.toggle('minimized');
document.getElementById('darkModeBtn').onclick = () => document.body.classList.toggle('dark-mode');


