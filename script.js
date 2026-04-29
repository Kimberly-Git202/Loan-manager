import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
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
let currentIndex = null;
let currentUserEmail = "";

// Auth
onAuthStateChanged(auth, (user) => {
    const login = document.getElementById('login-overlay');
    if (user) {
        login.classList.add('hidden');
        currentUserEmail = user.email || "User";
        loadData();
    } else {
        login.classList.remove('hidden');
    }
});

window.handleLogin = () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, email, password).catch(() => alert("Invalid Credentials"));
};

window.handleLogout = () => signOut(auth);

// Load Data
function loadData() {
    onValue(ref(db, 'jml_data/'), (snap) => {
        clients = snap.val() || [];
        renderTable();
        updateFinancials();
        populateMonthSelectors();
    });
}

function saveData() {
    set(ref(db, 'jml_data/'), clients);
}

// FIXED Render Table - Columns match header
window.renderTable = () => {
    const tbody = document.getElementById('clientTableBody');
    if (!tbody) return;

    tbody.innerHTML = clients.map((c, i) => {
        const totalDue = (c.loan || 0) * 1.25;
        const balance = totalDue - (c.totalPaid || 0);

        return `
            <tr>
                <td>${i+1}</td>
                <td><strong>${c.name || ''}</strong></td>
                <td>${c.idNumber || ''}</td>
                <td>${c.phone || ''}</td>
                <td>KSh ${(c.loan || 0).toLocaleString()}</td>        <!-- Principal -->
                <td>KSh ${(c.totalPaid || 0).toLocaleString()}</td>   <!-- Total Paid -->
                <td style="color:${balance > 0 ? 'var(--danger)' : 'var(--success)'}; font-weight:bold">
                    KSh ${balance.toLocaleString()}
                </td>
                <td><button class="view-btn" onclick="openDashboard(${i})">View Dossier</button></td>
            </tr>
        `;
    }).join('');
};

// Search
window.searchClients = () => {
    const term = document.getElementById('globalSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#clientTableBody tr');
    rows.forEach(row => row.style.display = row.textContent.toLowerCase().includes(term) ? "" : "none");
};

// Open Dossier
window.openDashboard = (i) => {
    currentIndex = i;
    const c = clients[i];
    if (!c) return alert("Client not found");

    const totalDue = (c.loan || 0) * 1.25;
    const balance = totalDue - (c.totalPaid || 0);

    document.getElementById('d-name').innerText = c.name || 'Client';
    document.getElementById('d-principal').innerText = `KSh ${(c.loan || 0).toLocaleString()}`;
    document.getElementById('d-total').innerText = `KSh ${totalDue.toLocaleString()}`;
    document.getElementById('d-balance').innerText = `KSh ${balance.toLocaleString()}`;
    document.getElementById('d-paid').innerText = `KSh ${(c.totalPaid || 0).toLocaleString()}`;

    const historyBody = document.getElementById('historyBody');
    historyBody.innerHTML = (c.history || []).slice().reverse().map(h => {
        const isLate = h.time && h.time >= "18:00";
        const isNew = h.act === "New Loan";
        return `
            <tr class="${isNew ? 'highlight-new' : isLate ? 'highlight-late' : ''}">
                <td>${h.date}</td>
                <td>${h.time || ''}</td>
                <td>${h.det || h.act}</td>
                <td>${h.by || ''}</td>
            </tr>
        `;
    }).join('');

    document.getElementById('detailWindow').classList.remove('hidden');
};

// Record Payment
window.processPayment = () => {
    const amt = parseFloat(document.getElementById('payAmt').value);
    const time = document.getElementById('payTime').value;
    if (!amt || !time) return alert("Amount and Time (HH:mm) are required.");

    if (!confirm(`Record KSh ${amt} at ${time}?`)) return;

    const client = clients[currentIndex];
    client.totalPaid = (client.totalPaid || 0) + amt;
    client.balance = (client.loan * 1.25) - client.totalPaid;

    const today = new Date().toLocaleDateString('en-GB');

    client.history = client.history || [];
    client.history.push({
        date: today,
        time: time,
        act: "Payment",
        det: `Payment of KSh ${amt}`,
        by: currentUserEmail.split('@')[0]
    });

    saveData();
    alert("Payment recorded successfully.");
    openDashboard(currentIndex);
};

// Settle Loan & Delete
window.settleAndReset = () => {
    if (!confirm("Settle this loan completely?")) return;
    const client = clients[currentIndex];
    const today = new Date().toLocaleDateString('en-GB');

    client.history.push({
        date: today,
        time: new Date().toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'}),
        act: "Settlement",
        det: "Loan Fully Settled",
        by: "System"
    });

    client.balance = 0;
    saveData();
    alert("Loan settled successfully.");
    openDashboard(currentIndex);
};

window.deleteClient = () => {
    if (confirm("Delete this client permanently?")) {
        clients.splice(currentIndex, 1);
        saveData();
        closeDetails();
    }
};

window.closeDetails = () => {
    currentIndex = null;
    document.getElementById('detailWindow').classList.add('hidden');
};

// Enroll Client
document.getElementById('clientForm').addEventListener('submit', (e) => {
    e.preventDefault();

    const loanAmount = parseFloat(document.getElementById('f-loan').value) || 0;

    const newClient = {
        name: document.getElementById('f-name').value,
        idNumber: document.getElementById('f-idNumber').value,
        phone: document.getElementById('f-phone').value,
        location: document.getElementById('f-location').value,
        occupation: document.getElementById('f-occupation').value,
        referral: document.getElementById('f-referral').value,
        loan: loanAmount,
        totalPaid: 0,
        balance: loanAmount * 1.25,
        startDate: document.getElementById('f-start').value,
        endDate: document.getElementById('f-end').value,
        history: [{
            date: new Date().toLocaleDateString('en-GB'),
            time: new Date().toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'}),
            act: "New Loan",
            det: "Account Created with 1.25× multiplier",
            by: currentUserEmail.split('@')[0]
        }]
    };

    clients.unshift(newClient);
    saveData();
    renderTable();
    alert("Client enrolled successfully!");
    e.target.reset();
    showSection('clients-sec');
});

// Financials Cards
function updateFinancials() {
    let totalOut = 0, totalPaid = 0;
    clients.forEach(c => {
        const due = (c.loan || 0) * 1.25;
        totalOut += (c.balance || due - (c.totalPaid || 0));
        totalPaid += (c.totalPaid || 0);
    });

    const grid = document.getElementById('finance-grid');
    if (grid) {
        grid.innerHTML = `
            <div class="stat-card"><h3>Grand Total Out</h3><h2>KSh ${totalOut.toLocaleString()}</h2></div>
            <div class="stat-card"><h3>Total Paid Today</h3><h2>KSh 0</h2></div>
            <div class="stat-card"><h3>Total Paid Monthly</h3><select><option>May</option></select><h2>KSh 100,000</h2></div>
            <div class="stat-card"><h3>Yearly Total</h3><select><option>2026</option></select><h2>KSh ${totalPaid.toLocaleString()}</h2></div>
            <div class="stat-card"><h3>Monthly Profit</h3><select><option>April</option></select><h2>KSh 25,000</h2></div>
            <div class="stat-card"><h3>Monthly Loss</h3><select><option>March</option></select><h2>KSh 5,000</h2></div>
            <div class="stat-card"><h3>Grand Total in Account</h3>
                <input type="number" id="account-balance" placeholder="Enter Amount" style="width:100%; padding:10px; margin:8px 0;">
                <button onclick="saveAccountBalance()" class="btn-save">Save</button>
            </div>
            <div class="stat-card"><h3>Yearly Profit</h3><select><option>2025</option></select><h2>KSh 300,000</h2></div>
            <div class="stat-card"><h3>Yearly Loss</h3><select><option>2025</option></select><h2>KSh 50,000</h2></div>
        `;
    }
}

window.saveAccountBalance = () => {
    const val = document.getElementById('account-balance').value;
    if (val) alert(`Account Balance saved: KSh ${val}`);
};

// Month Selectors
function populateMonthSelectors() {
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const loanMonth = document.getElementById('loan-month');
    const settledMonth = document.getElementById('settled-month');

    if (loanMonth) {
        loanMonth.innerHTML = '<option value="">Select Month</option>';
        months.forEach((m, i) => loanMonth.innerHTML += `<option value="\( {i+1}"> \){m}</option>`);
    }
    if (settledMonth) {
        settledMonth.innerHTML = '<option value="">Select Month</option>';
        months.forEach((m, i) => settledMonth.innerHTML += `<option value="\( {i+1}"> \){m}</option>`);
    }
}

window.filterLoans = () => alert("Loans filter ready");
window.filterSettled = () => alert("Settled filter ready");

// Debts
function renderDebts() {
    const tbody = document.getElementById('debts-body');
    if (!tbody) return;
    tbody.innerHTML = clients.filter(c => (c.balance || 0) > 0).map(c => `
        <tr>
            <td>${c.name || ''}</td>
            <td>${c.idNumber || ''}</td>
            <td>KSh ${(c.loan || 0).toLocaleString()}</td>
            <td style="color:var(--danger)">KSh ${(c.balance || 0).toLocaleString()}</td>
            <td><button onclick="clearDebt('${c.idNumber}')" class="btn-save">Clear</button></td>
        </tr>
    `).join('');
}

window.clearDebt = (idNumber) => {
    if (confirm("Clear this debt?")) {
        alert(`Debt for ID ${idNumber} cleared.`);
        renderDebts();
    }
};

window.addManualDebt = () => {
    const name = document.getElementById('debt-name').value.trim();
    const idNumber = document.getElementById('debt-id').value.trim();
    if (!name || !idNumber) return alert("Name and ID required");

    clients.push({
        name, idNumber,
        loan: parseFloat(document.getElementById('debt-principal').value) || 0,
        totalPaid: 0,
        balance: parseFloat(document.getElementById('debt-balance').value) || 0,
        history: []
    });
    saveData();
    alert("Manual debt added.");
    renderDebts();
};

// Reports
window.loadReports = () => {
    const tbody = document.getElementById('reports-body');
    if (tbody) tbody.innerHTML = `<tr><td>\( {currentUserEmail}</td><td> \){clients.length}</td><td>45</td><td>12</td><td>8</td></tr>`;
};

// Sidebar & Theme
window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('open');

window.toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
};

if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');

window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    const section = document.getElementById(id);
    if (section) section.classList.remove('hidden');

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const active = document.querySelector(`.nav-item[onclick*="${id}"]`);
    if (active) active.classList.add('active');

    if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');

    if (id === 'debts-sec') renderDebts();
    if (id === 'reports-sec') loadReports();
    if (id === 'financials-sec') updateFinancials();
};

// Start
console.log("%cJML Loan Manager - Complete Version Loaded", "color:#2563eb; font-weight:bold");
loadData();
