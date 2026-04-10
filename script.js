import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";

// Your Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyAEMpC9oczMDYybbkZirDkY9a25d8ZqjJw",
  authDomain: "jml-loans-560d8.firebaseapp.com",
  projectId: "jml-loans-560d8",
  storageBucket: "jml-loans-560d8.firebasestorage.app",
  databaseURL: "https://jml-loans-560d8-default-rtdb.firebaseio.com",
  messagingSenderId: "425047270355",
  appId: "1:425047270355:web:6ccd08365ca1cde7354526",
  measurementId: "G-9YEWM3SW1P"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let clients = [];
let currentIndex = null;

// --- CLOUD DATA SYNC ---
// This replaces your window.onload and localStorage.getItem
onValue(ref(db, 'jml_data/'), (snapshot) => {
    clients = snapshot.val() || [];
    renderTable();
    // If the dashboard is open, refresh the data inside it too
    if (currentIndex !== null) openDashboard(currentIndex);
});

function saveData() { 
    // This replaces localStorage.setItem
    set(ref(db, 'jml_data/'), clients); 
}

// --- UI CONTROLS ---
window.toggleSidebar = function() { 
    document.getElementById('sidebar').classList.toggle('minimized'); 
};

window.showSection = function(id) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
};

// --- ADD CLIENT ---
document.getElementById('clientForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const loan = parseFloat(document.getElementById('f-loan').value);
    const newClient = {
        name: document.getElementById('f-name').value,
        occ: document.getElementById('f-occ').value,
        idNum: document.getElementById('f-id').value,
        ref: document.getElementById('f-ref').value,
        phone: document.getElementById('f-phone').value,
        addr: document.getElementById('f-addr').value,
        loan: loan,
        balance: loan,
        status: "Active",
        notes: "",
        history: [{ 
            date: new Date().toLocaleDateString('en-GB'), 
            act: "Loan Started", 
            det: `Ksh ${loan} Approved`, 
            by: "Admin" 
        }]
    };
    clients.push(newClient);
    saveData();
    showSection('list-sec');
    this.reset();
});

// --- RENDER TABLE ---
function renderTable() {
    const tbody = document.getElementById('clientTableBody');
    if (!tbody) return;
    tbody.innerHTML = clients.map((c, i) => `
        <tr>
            <td>${i + 1}</td>
            <td>${c.name}</td>
            <td>${c.phone}</td>
            <td>Ksh ${c.balance.toLocaleString()}</td>
            <td><span class="tag">${c.status}</span></td>
            <td><button class="view-btn" onclick="openDashboard(${i})">View Dashboard</button></td>
        </tr>
    `).join('');
}

// --- DASHBOARD LOGIC ---
window.openDashboard = function(index) {
    currentIndex = index;
    const c = clients[index];
    
    document.getElementById('d-name').innerText = c.name;
    document.getElementById('d-status-select').value = c.status;
    document.getElementById('e-occ').value = c.occ;
    document.getElementById('e-idnum').value = c.idNum;
    document.getElementById('e-ref').value = c.ref;
    document.getElementById('e-phone').value = c.phone;
    document.getElementById('e-addr').value = c.addr;
    document.getElementById('d-loan').innerText = `Ksh ${c.loan.toLocaleString()}`;
    document.getElementById('d-bal-input').value = c.balance;
    document.getElementById('d-notes').value = c.notes;
    
    renderActivity(c.history || []);
    document.getElementById('detailWindow').classList.remove('hidden');
};

function renderActivity(history) {
    const tbody = document.getElementById('activityTableBody');
    if (!tbody) return;
    tbody.innerHTML = history.slice().reverse().map(h => `
        <tr>
            <td>${h.date}</td>
            <td>${h.act}</td>
            <td>${h.det}</td>
            <td>${h.by}</td>
        </tr>
    `).join('');
}

// --- SAVE ACTIONS ---
window.saveAllChanges = function() {
    const c = clients[currentIndex];
    c.occ = document.getElementById('e-occ').value;
    c.idNum = document.getElementById('e-idnum').value;
    c.ref = document.getElementById('e-ref').value;
    c.phone = document.getElementById('e-phone').value;
    c.addr = document.getElementById('e-addr').value;
    c.balance = parseFloat(document.getElementById('d-bal-input').value);
    c.notes = document.getElementById('d-notes').value;
    c.status = document.getElementById('d-status-select').value;
    
    saveData();
    alert("Saved to Cloud Successfully!");
};

window.recordPayment = function() {
    const amt = parseFloat(document.getElementById('dailyPay').value);
    if (amt > 0) {
        clients[currentIndex].balance -= amt;
        clients[currentIndex].history.push({
            date: new Date().toLocaleDateString('en-GB'),
            act: "Payment",
            det: `Paid Ksh ${amt}`,
            by: "Admin"
        });
        document.getElementById('dailyPay').value = "";
        saveData();
    }
};

window.clearLoan = function() {
    if(confirm("Mark this loan as fully cleared?")) {
        clients[currentIndex].balance = 0;
        clients[currentIndex].status = "Cleared";
        clients[currentIndex].history.push({
            date: new Date().toLocaleDateString('en-GB'),
            act: "Loan Cleared",
            det: "All balances settled",
            by: "Admin"
        });
        saveData();
    }
};

window.closeDetails = function() { 
    currentIndex = null;
    document.getElementById('detailWindow').classList.add('hidden'); 
};

// Global search (if you have the search input)
window.searchClients = function() {
    const term = document.getElementById('globalSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#clientTableBody tr');
    rows.forEach(row => {
        const name = row.cells[1].innerText.toLowerCase();
        row.style.display = name.includes(term) ? "" : "none";
    });
};
