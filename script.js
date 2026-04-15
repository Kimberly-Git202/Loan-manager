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

// --- AUTH & ACCESS CONTROL ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const staffRef = ref(db, `jml_users/${user.uid}`);
        const snap = await get(staffRef);
        let userData = snap.val();
        
        // Auto-create profile if missing
        if (!userData) {
            userData = { email: user.email, role: 'staff', disabled: false };
            await set(staffRef, userData);
        }

        if (userData.disabled) {
            alert("Access Denied by Admin.");
            handleLogout();
            return;
        }

        currentUser = user;
        isAdmin = userData.role === 'admin';
        document.getElementById('user-display').innerText = user.email.split('@')[0];
        document.getElementById('login-overlay').classList.add('hidden');
        if (isAdmin) document.getElementById('admin-nav').classList.remove('hidden');
        loadData();
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
    }
});

window.handleLogin = () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, e, p).catch(err => alert("Login Failed: " + err.message));
};

window.handleLogout = () => signOut(auth);

window.togglePasswordVisibility = () => {
    const pInput = document.getElementById('login-password');
    const pIcon = document.getElementById('togglePassword');
    if (pInput.type === "password") {
        pInput.type = "text";
        pIcon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        pInput.type = "password";
        pIcon.classList.replace('fa-eye-slash', 'fa-eye');
    }
};

// --- DATA HANDLING ---
function loadData() {
    const dataPath = isAdmin ? 'jml_data/' : `jml_data/${currentUser.uid}`;
    onValue(ref(db, dataPath), (snap) => {
        const raw = snap.val() || {};
        clients = isAdmin ? Object.values(raw).flatMap(u => Object.values(u)) : Object.values(raw);
        renderTable();
        updateFinancials();
        renderSettled();
        renderLoansGiven();
    });
    
    onValue(ref(db, 'jml_debts'), (snap) => renderDebts(snap.val()));
    onValue(ref(db, 'jml_finance/grand_total'), (snap) => {
        document.getElementById('grand-total-val').value = snap.val() || 0;
    });

    if (isAdmin) {
        onValue(ref(db, 'jml_users'), (snap) => renderAdminPanel(snap.val()));
    }
}

function saveData() {
    // Only save to the logged-in user's path to ensure separation
    set(ref(db, `jml_data/${currentUser.uid}`), clients);
}

// --- UTILITIES ---
function formatDate(dateStr) {
    if (!dateStr) return "---";
    const d = new Date(dateStr);
    const day = d.getDate();
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const suffix = (day % 10 == 1 && day != 11) ? 'st' : (day % 10 == 2 && day != 12) ? 'nd' : (day % 10 == 3 && day != 13) ? 'rd' : 'th';
    return `${day}${suffix} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// --- MAIN FEATURES ---
window.renderTable = () => {
    const tbody = document.getElementById('clientTableBody');
    tbody.innerHTML = clients.filter(c => !c.settled).map((c, i) => `
        <tr class="${c.isNewLoan ? 'reloan-highlight' : ''}">
            <td>${i+1}</td>
            <td><strong>${c.name}</strong></td>
            <td>${c.idNumber}</td>
            <td>KSh ${c.totalPaid.toLocaleString()}</td>
            <td style="color:var(--accent); font-weight:bold">KSh ${c.balance.toLocaleString()}</td>
            <td><button class="view-btn" onclick="openDashboard(${i})">Open</button></td>
        </tr>
    `).join('');
};

window.openDashboard = (i) => {
    currentIndex = i;
    const c = clients[i];
    document.getElementById('d-name').innerText = c.name;
    document.getElementById('d-meta').innerHTML = `
        ID: ${c.idNumber} | Referral: ${c.referral || 'None'}<br>
        Period: ${formatDate(c.startDate)} - ${formatDate(c.endDate)}
    `;
    document.getElementById('d-principal').innerText = `KSh ${c.principal.toLocaleString()}`;
    document.getElementById('d-balance').innerText = `KSh ${c.balance.toLocaleString()}`;
    document.getElementById('d-notes').value = c.notes || "";
    
    document.getElementById('historyBody').innerHTML = (c.history || []).map((h, hi) => `
        <tr class="${h.act === 'SKIPPED' ? 'skipped-day' : ''}">
            <td>${h.date}</td>
            <td class="${parseInt(h.time.split(':')[0]) >= 18 ? 'time-late' : ''}">${h.time}</td>
            <td contenteditable="true" onblur="editHistory(${hi}, this.innerText)">${h.amt}</td>
            <td>${h.by}</td>
        </tr>
    `).join('');
    document.getElementById('detailWindow').classList.remove('hidden');
};

window.processPayment = () => {
    const amt = parseFloat(document.getElementById('payAmt').value);
    const time = document.getElementById('payTime').value;
    const client = clients[currentIndex];
    const today = new Date().toLocaleDateString('en-GB');

    if (isNaN(amt)) return;

    if (!client.history) client.history = [];
    
    // Check for skipped days
    if (client.history.length > 0) {
        const lastDate = client.history[client.history.length-1].date;
        if (lastDate !== today) {
            client.history.push({ date: lastDate, time: "00:00", amt: 0, by: "System", act: "SKIPPED" });
        }
    }

    client.balance -= amt;
    client.totalPaid += amt;
    client.history.push({
        date: today, time: time, amt: amt, by: currentUser.email.split('@')[0], act: "PAYMENT"
    });
    
    saveData();
    document.getElementById('payAmt').value = "";
    openDashboard(currentIndex);
};

window.editHistory = (historyIndex, newVal) => {
    const val = parseFloat(newVal);
    if (isNaN(val)) return;
    
    const client = clients[currentIndex];
    const oldAmt = client.history[historyIndex].amt;
    const diff = oldAmt - val;
    
    client.history[historyIndex].amt = val;
    client.balance += diff;
    client.totalPaid -= diff;
    saveData();
};

window.saveNotes = () => {
    clients[currentIndex].notes = document.getElementById('d-notes').value;
    saveData();
};

window.settleAndReset = () => {
    if(!confirm("Settle this loan?")) return;
    const c = clients[currentIndex];
    c.settled = true;
    c.settledDate = new Date().toLocaleDateString('en-GB');
    
    // Create new loan entry
    const newLoan = JSON.parse(JSON.stringify(c)); // Copy
    newLoan.settled = false;
    newLoan.history = [];
    newLoan.totalPaid = 0;
    newLoan.isNewLoan = true; // For highlighting
    clients.push(newLoan);
    
    saveData();
    closeDetails();
};

window.deleteClient = () => {
    if(confirm("Delete this client permanently?")) {
        clients.splice(currentIndex, 1);
        saveData();
        closeDetails();
    }
};

window.addDebt = () => {
    const d = document.getElementById('debt-date').value;
    const desc = document.getElementById('debt-desc').value;
    const amt = document.getElementById('debt-amt').value;
    if(!d || !amt) return;
    const newDebtRef = ref(db, `jml_debts/${Date.now()}`);
    set(newDebtRef, { date: d, desc, amt, by: currentUser.email });
};

function renderDebts(data) {
    const list = document.getElementById('debtList');
    list.innerHTML = "";
    if(!data) return;
    Object.values(data).forEach(d => {
        list.innerHTML += `<div class="stat-card" style="padding:10px; margin-bottom:5px;">
            <small>${d.date}</small> <br> <strong>${d.desc}</strong>: KSh ${d.amt}
        </div>`;
    });
}

// Sidebar logic
window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if(event) event.currentTarget.classList.add('active');
};

window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('minimized');
window.closeDetails = () => document.getElementById('detailWindow').classList.add('hidden');

// Initialize logic
document.getElementById('clientForm').addEventListener('submit', (e) => {
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
        startDate: document.getElementById('f-start').value || null,
        endDate: document.getElementById('f-end').value || null,
        history: [],
        settled: false,
        notes: ""
    });
    saveData();
    showSection('list-sec');
    e.target.reset();
});

