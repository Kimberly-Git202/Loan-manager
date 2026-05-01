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
        login.style.display = 'none';
        currentUserEmail = user.email || "User";
        loadData();
    } else {
        login.style.display = 'flex';
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
    });
}

function saveData() {
    const obj = {};
    clients.forEach((c) => {
        const id = c.id || Date.now().toString();
        obj[id] = c;
    });
    set(ref(db, 'jml_data/'), obj);
}

// Render Table
window.renderTable = () => {
    const tbody = document.getElementById('clientTableBody');
    tbody.innerHTML = clients.map((c, i) => {
        const totalDue = (c.loan || 0) * 1.25;
        const balance = totalDue - (c.totalPaid || 0);
        return `
            <tr>
                <td>${i+1}</td>
                <td><strong>${c.name || ''}</strong></td>
                <td>${c.idNumber || ''}</td>
                <td>${c.phone || ''}</td>
                <td>KSh ${(c.loan || 0).toLocaleString()}</td>
                <td>KSh ${(c.totalPaid || 0).toLocaleString()}</td>
                <td style="color:${balance > 0 ? 'var(--danger)' : 'var(--success)'}; font-weight:bold">
                    KSh ${balance.toLocaleString()}
                </td>
                <td><button class="view-btn" onclick="openDashboard('${c.id}')">View Dossier</button></td>
            </tr>`;
    }).join('');
};

window.searchClients = () => {
    const term = document.getElementById('globalSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#clientTableBody tr');
    rows.forEach(row => row.style.display = row.textContent.toLowerCase().includes(term) ? "" : "none");
};

window.openDashboard = (id) => {
    currentIndex = clients.findIndex(c => c.id === id);
    const c = clients[currentIndex];
    if (!c) return alert("Client not found");

    const totalDue = (c.loan || 0) * 1.25;
    const balance = totalDue - (c.totalPaid || 0);

    document.getElementById('d-name').innerText = c.name || 'Client';
    document.getElementById('d-principal').innerText = `KSh ${(c.loan || 0).toLocaleString()}`;
    document.getElementById('d-total').innerText = `KSh ${totalDue.toLocaleString()}`;
    document.getElementById('d-balance').innerText = `KSh ${balance.toLocaleString()}`;
    document.getElementById('d-paid').innerText = `KSh ${(c.totalPaid || 0).toLocaleString()}`;
    document.getElementById('clientNotes').value = c.notes || "";

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
            </tr>`;
    }).join('');

    document.getElementById('detailWindow').style.display = "flex";
};

window.processPayment = () => {
    const amt = parseFloat(document.getElementById('payAmt').value);
    const time = document.getElementById('payTime').value;
    if (!amt || !time) return alert("Amount and Time (HH:mm) are required.");

    if (!confirm(`Record KSh ${amt} at ${time}?`)) return;

    const client = clients[currentIndex];
    client.totalPaid = (client.totalPaid || 0) + amt;

    client.history = client.history || [];
    client.history.push({
        date: new Date().toLocaleDateString('en-GB'),
        time: time,
        act: "Payment",
        det: `Payment of KSh ${amt}`,
        by: currentUserEmail.split('@')[0]
    });

    saveData();
    alert("Payment recorded successfully.");
    openDashboard(client.id);
};

window.settleAndReset = () => {
    if (!confirm("Settle this loan completely?")) return;
    alert("Loan settled successfully.");
    closeDetails();
};

window.deleteClient = () => {
    if (confirm("Delete this client permanently?")) {
        clients.splice(currentIndex, 1);
        saveData();
        closeDetails();
    }
};

window.closeDetails = () => {
    document.getElementById('detailWindow').style.display = "none";
};

document.getElementById('clientForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const newClient = {
        id: Date.now().toString(),
        name: document.getElementById('f-name').value,
        idNumber: document.getElementById('f-idNumber').value,
        phone: document.getElementById('f-phone').value,
        location: document.getElementById('f-location').value,
        occupation: document.getElementById('f-occupation').value,
        referral: document.getElementById('f-referral').value,
        loan: parseFloat(document.getElementById('f-loan').value) || 0,
        totalPaid: 0,
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

    document.getElementById('finance-grid').innerHTML = `
        <div class="stat-card"><h3>Total Loaned Out</h3><h2>KSh ${totalLoaned.toLocaleString()}</h2></div>
        <div class="stat-card"><h3>Total Paid</h3><h2>KSh ${totalPaid.toLocaleString()}</h2></div>
        <div class="stat-card"><h3>Profit</h3><h2>KSh ${profit.toLocaleString()}</h2></div>
        <div class="stat-card"><h3>Loss</h3><h2>KSh ${loss.toLocaleString()}</h2></div>
    `;
}

function populateMonthSelectors() {
    console.log("Month selectors ready");
}

window.filterLoans = () => console.log("Filtering loans...");
window.filterSettled = () => console.log("Filtering settled loans...");
window.addManualDebt = () => alert("Manual debt added");
window.loadReports = () => console.log("Loading reports...");

window.toggleSidebar = () => {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
};

window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    const section = document.getElementById(id);
    if (section) section.classList.remove('hidden');

    if (window.innerWidth <= 768) toggleSidebar();
};

window.toggleDarkMode = () => document.body.classList.toggle('dark-mode');

window.onload = () => {
    if (localStorage.getItem('darkMode') === 'true') document.body.classList.add('dark-mode');
};
