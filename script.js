// script.js
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
        const data = snap.val();
        clients = data ? Object.entries(data).map(([id, value]) => ({id, ...value})) : [];
        renderTable();
        updateFinancials();
        populateMonthSelectors();
        renderDebts();
    });
}

function saveData() {
    const obj = {};
    clients.forEach((c) => {
        const id = c.id || Date.now().toString();
        c.id = id;
        obj[id] = c;
    });
    set(ref(db, 'jml_data/'), obj);
}

// Render Table
window.renderTable = () => {
    const tbody = document.getElementById('clientTableBody');
    if (!tbody) return;

    tbody.innerHTML = clients.map((c, i) => {
        const totalDue = (c.loan || 0) * 1.25;
        const balance = totalDue - (c.totalPaid || 0);
        return `
            <tr>
                <td>${i + 1}</td>
                <td><strong>${c.name || ''}</strong></td>
                <td>${c.idNumber || ''}</td>
                <td>${c.phone || ''}</td>
                <td>KSh ${(c.loan || 0).toLocaleString()}</td>
                <td>KSh ${(c.totalPaid || 0).toLocaleString()}</td>
                <td style="color:${balance > 0 ? 'var(--danger)' : 'var(--success)'}; font-weight:bold">
                    KSh ${balance.toLocaleString()}
                </td>
                <td>
                    <button class="view-btn" onclick="openDashboard('${c.id}')">View</button>
                </td>
            </tr>`;
    }).join('');
};

window.searchClients = () => {
    const term = document.getElementById('globalSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#clientTableBody tr');
    rows.forEach(row => row.style.display = row.textContent.toLowerCase().includes(term) ? "" : "none");
};

window.openDashboard = (id) => {
    const i = clients.findIndex(c => c.id === id);
    const c = clients[i];
    if (!c) return alert("Client not found");

    currentIndex = i;

    const totalDue = (c.loan || 0) * 1.25;
    const balance = totalDue - (c.totalPaid || 0);

    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    };

    set('d-name', c.name || '');
    set('d-phone', c.phone || '');
    set('d-location', c.location || '');
    set('d-occupation', c.occupation || '');
    set('d-referral', c.referral || '');
    set('d-start', c.startDate || '');
    set('d-end', c.endDate || '');
    set('d-principal', `KSh ${(c.loan || 0).toLocaleString()}`);
    set('d-total', `KSh ${totalDue.toLocaleString()}`);
    set('d-balance', `KSh ${balance.toLocaleString()}`);
    set('d-paid', `KSh ${(c.totalPaid || 0).toLocaleString()}`);

    const historyBody = document.getElementById('historyBody');
    if (historyBody) {
        historyBody.innerHTML = (c.history || []).slice().reverse().map(h => `
            <tr class="${h.act === "New Loan" ? 'highlight-new' : ''}">
                <td>${h.date}</td>
                <td>${h.time || ''}</td>
                <td>${h.det || h.act}</td>
                <td>${h.by || ''}</td>
            </tr>
        `).join('');
    }

    const modal = document.getElementById('detailWindow');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = "flex";
    }
};

window.processPayment = () => {
    const amt = parseFloat(document.getElementById('payAmt').value);
    const time = document.getElementById('payTime').value;
    if (!amt || !time) return alert("Amount and Time required");

    const c = clients[currentIndex];
    c.totalPaid = (c.totalPaid || 0) + amt;

    c.history = c.history || [];
    c.history.push({
        date: new Date().toLocaleDateString('en-GB'),
        time: time,
        act: "Payment",
        det: `Payment of KSh ${amt}`,
        by: currentUserEmail.split('@')[0]
    });

    saveData();
    alert("Payment recorded successfully.");
    openDashboard(c.id);
};

window.settleAndReset = () => {
    if (!confirm("Settle this loan completely?")) return;
    const c = clients[currentIndex];
    c.balance = 0;
    c.history.push({
        date: new Date().toLocaleDateString('en-GB'),
        time: new Date().toLocaleTimeString(),
        act: "Settlement",
        det: "Loan Fully Settled",
        by: "System"
    });
    saveData();
    alert("Loan settled successfully.");
    openDashboard(c.id);
};

window.deleteClient = () => {
    if (confirm("Delete this client permanently?")) {
        clients.splice(currentIndex, 1);
        saveData();
        closeDetails();
    }
};

window.closeDetails = () => {
    const modal = document.getElementById('detailWindow');
    modal.classList.add('hidden');
    modal.style.display = "none";
};

document.getElementById('clientForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const loan = parseFloat(document.getElementById('f-loan').value) || 0;

    const newClient = {
        id: Date.now().toString(),
        name: document.getElementById('f-name').value,
        idNumber: document.getElementById('f-idNumber').value,
        phone: document.getElementById('f-phone').value,
        location: document.getElementById('f-location').value,
        occupation: document.getElementById('f-occupation').value,
        referral: document.getElementById('f-referral').value,
        loan: loan,
        totalPaid: 0,
        balance: loan * 1.25,
        startDate: document.getElementById('f-start').value,
        endDate: document.getElementById('f-end').value,
        history: [{
            date: new Date().toLocaleDateString('en-GB'),
            time: new Date().toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'}),
            act: "New Loan",
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

function updateFinancials() {
    let totalLoaned = 0;
    let totalPaid = 0;
    clients.forEach(c => {
        totalLoaned += c.loan || 0;
        totalPaid += c.totalPaid || 0;
    });
    const profit = totalPaid * 0.25;
    const loss = (totalLoaned * 1.25) - totalPaid;

    const grid = document.getElementById('finance-grid');
    if (grid) {
        grid.innerHTML = `
            <div class="stat-card"><h3>Total Loaned Out</h3><h2>KSh ${totalLoaned.toLocaleString()}</h2></div>
            <div class="stat-card"><h3>Total Paid</h3><h2>KSh ${totalPaid.toLocaleString()}</h2></div>
            <div class="stat-card"><h3>Profit</h3><h2>KSh ${profit.toLocaleString()}</h2></div>
            <div class="stat-card"><h3>Loss</h3><h2>KSh ${loss.toLocaleString()}</h2></div>
        `;
    }
}

function populateMonthSelectors() {
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const currentYear = new Date().getFullYear();

    // All month selects
    document.querySelectorAll('#loan-month, #settled-month').forEach(sel => {
        sel.innerHTML = '<option value="">Select Month</option>';
        months.forEach((m, i) => sel.innerHTML += `<option value="\( {i+1}"> \){m}</option>`);
    });

    // All year selects
    document.querySelectorAll('#loan-year, #settled-year').forEach(sel => {
        sel.innerHTML = '<option value="">Select Year</option>';
        for (let y = currentYear - 5; y <= currentYear + 2; y++) {
            sel.innerHTML += `<option value="\( {y}"> \){y}</option>`;
        }
    });
}

window.toggleSidebar = () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('overlay').classList.toggle('show');
};

window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    const section = document.getElementById(id);
    if (section) section.classList.remove('hidden');

    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
    }
};

window.toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
};

window.onload = () => {
    if (localStorage.getItem('darkMode') === 'true') document.body.classList.add('dark-mode');
    populateMonthSelectors();
};
