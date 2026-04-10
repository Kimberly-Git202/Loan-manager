import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAEMpC9oczMDYybbkZirDkY9a25d8ZqjJw",
  authDomain: "jml-loans-560d8.firebaseapp.com",
  projectId: "jml-loans-560d8",
  storageBucket: "jml-loans-560d8.firebasestorage.app",
  databaseURL: "https://jml-loans-560d8-default-rtdb.europe-west1.firebasedatabase.app", 
  messagingSenderId: "425047270355",
  appId: "1:425047270355:web:6ccd08365ca1cde7354526",
  measurementId: "G-9YEWM3SW1P"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let clients = [];
let currentIndex = null;

// --- SYNC FROM CLOUD ---
onValue(ref(db, 'jml_data/'), (snapshot) => {
    clients = snapshot.val() || [];
    renderTable();
    calculateTotalOutstanding();
    if (currentIndex !== null) openDashboard(currentIndex);
});

function saveData() { 
    set(ref(db, 'jml_data/'), clients); 
}

// --- UI CONTROLS ---
window.toggleSidebar = function() { 
    document.getElementById('sidebar').classList.toggle('minimized'); 
};

window.showSection = function(id) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
};

// --- SEARCH FUNCTION ---
window.searchClients = function() {
    const term = document.getElementById('globalSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#clientTableBody tr');
    rows.forEach(row => {
        const name = row.cells[1] ? row.cells[1].innerText.toLowerCase() : "";
        row.style.display = name.includes(term) ? "" : "none";
    });
};

// --- ADD CLIENT ---
document.getElementById('clientForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const loan = parseFloat(document.getElementById('f-loan').value);
    const newClient = {
        name: document.getElementById('f-name').value,
        occ: document.getElementById('f-occ').value || "---",
        idNum: document.getElementById('f-id').value || "---",
        ref: document.getElementById('f-ref').value || "---",
        phone: document.getElementById('f-phone').value || "---",
        addr: document.getElementById('f-addr').value || "---",
        period: document.getElementById('f-period').value || "---",
        loan: loan,
        balance: loan,
        status: "Active",
        notes: "",
        history: [{ 
            date: new Date().toLocaleDateString('en-GB'), 
            act: "Loan Started", 
            det: `Ksh ${loan.toLocaleString()} Approved`, 
            by: "Admin" 
        }]
    };
    clients.push(newClient);
    saveData();
    showSection('list-sec');
    this.reset();
});

// --- TOTAL CALCULATION ---
function calculateTotalOutstanding() {
    const total = clients.reduce((sum, c) => sum + (parseFloat(c.balance) || 0), 0);
    document.getElementById('total-outstanding').innerText = `KSh ${total.toLocaleString()}`;
}

// --- RENDER TABLE ---
function renderTable() {
    const tbody = document.getElementById('clientTableBody');
    if (!tbody) return;
    tbody.innerHTML = clients.map((c, i) => `
        <tr>
            <td>${i + 1}</td>
            <td><strong>${c.name}</strong></td>
            <td>${c.phone}</td>
            <td>Ksh ${c.balance.toLocaleString()}</td>
            <td><button class="view-btn" onclick="openDashboard(${i})">View</button></td>
        </tr>
    `).join('');
}

// --- DASHBOARD ---
window.openDashboard = function(index) {
    currentIndex = index;
    const c = clients[index];
    document.getElementById('d-name').innerText = c.name;
    document.getElementById('d-status').value = c.status;
    document.getElementById('d-occ').innerText = c.occ;
    document.getElementById('d-idnum').innerText = c.idNum;
    document.getElementById('d-phone').innerText = c.phone;
    document.getElementById('d-addr').innerText = c.addr;
    document.getElementById('d-ref').innerText = c.ref;
    document.getElementById('d-loan').innerText = `Ksh ${c.loan.toLocaleString()}`;
    document.getElementById('d-bal-input').value = c.balance;
    document.getElementById('d-notes').value = c.notes || "";
    renderActivity(c.history || []);
    document.getElementById('detailWindow').classList.remove('hidden');
};

function renderActivity(history) {
    const tbody = document.getElementById('activityTableBody');
    if (!tbody) return;
    tbody.innerHTML = history.slice().reverse().map(h => `
        <tr><td>${h.date}</td><td>${h.act}</td><td>${h.det}</td><td>${h.by}</td></tr>
    `).join('');
}

window.updateClientField = function(field, value) {
    if (currentIndex === null) return;
    clients[currentIndex][field] = value;
    saveData();
};

window.saveManualBalance = function() {
    const newVal = parseFloat(document.getElementById('d-bal-input').value);
    clients[currentIndex].history.push({
        date: new Date().toLocaleDateString('en-GB'),
        act: "Correction",
        det: `Manual adjust to Ksh ${newVal.toLocaleString()}`,
        by: "Admin"
    });
    clients[currentIndex].balance = newVal;
    saveData();
};

window.updatePayment = function() {
    const amt = parseFloat(document.getElementById('dailyPay').value);
    if (amt > 0) {
        clients[currentIndex].balance -= amt;
        clients[currentIndex].history.push({
            date: new Date().toLocaleDateString('en-GB'),
            act: "Payment",
            det: `Paid Ksh ${amt.toLocaleString()}`,
            by: "Admin"
        });
        document.getElementById('dailyPay').value = "";
        saveData();
    }
};

window.markAsCleared = function() {
    if(confirm("Close this loan as settled?")) {
        clients[currentIndex].balance = 0;
        clients[currentIndex].status = "Cleared";
        clients[currentIndex].history.push({
            date: new Date().toLocaleDateString('en-GB'),
            act: "Loan Settled",
            det: "Account cleared",
            by: "Admin"
        });
        saveData();
    }
};

window.closeDetails = function() { 
    currentIndex = null;
    document.getElementById('detailWindow').classList.add('hidden'); 
};



