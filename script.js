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

onValue(ref(db, 'jml_data/'), (snapshot) => {
    clients = snapshot.val() || [];
    renderTable();
    updateFinanceSummary();
    if (currentIndex !== null) openDashboard(currentIndex);
});

function saveData() { set(ref(db, 'jml_data/'), clients); }

window.showSection = function(id) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
};

window.toggleSidebar = function() { document.getElementById('sidebar').classList.toggle('minimized'); };
window.toggleDarkMode = function() { document.body.classList.toggle('dark-mode'); };

function updateFinanceSummary() {
    let out = 0, paid = 0, today = 0;
    const todayStr = new Date().toLocaleDateString('en-GB');
    clients.forEach(c => {
        const totalDue = (c.loan || 0) * 1.25;
        out += (c.balance || 0);
        paid += (totalDue - (c.balance || 0));
        (c.history || []).forEach(h => {
            if(h.date === todayStr && h.act === "Payment") today += (h.amt || 0);
        });
    });
    document.getElementById('grand-total-out').innerText = `KSh ${out.toLocaleString()}`;
    document.getElementById('grand-total-paid').innerText = `KSh ${paid.toLocaleString()}`;
    document.getElementById('grand-total-today').innerText = `KSh ${today.toLocaleString()}`;
    document.getElementById('summary-today').innerText = `KSh ${today.toLocaleString()}`;
}

document.getElementById('clientForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const principal = parseFloat(document.getElementById('f-loan').value);
    const totalDue = principal * 1.25;
    const newClient = {
        name: document.getElementById('f-name').value,
        phone: document.getElementById('f-phone').value || "---",
        idNum: document.getElementById('f-id').value || "---",
        addr: document.getElementById('f-location').value || "---",
        occ: document.getElementById('f-occupation').value || "---",
        ref: document.getElementById('f-Referral').value || "---",
        startDate: document.getElementById('f-start').value,
        endDate: document.getElementById('f-end').value,
        loan: principal,
        balance: totalDue,
        status: "Active",
        history: [{ 
            date: new Date().toLocaleDateString('en-GB'), 
            act: "Loan Started", 
            det: `KSh ${principal.toLocaleString()} Approved`, 
            by: "Admin" 
        }]
    };
    clients.push(newClient);
    saveData();
    showSection('list-sec');
    this.reset();
});

window.openDashboard = function(index) {
    currentIndex = index;
    const c = clients[index];
    const totalDue = c.loan * 1.25;
    document.getElementById('d-name').innerText = c.name;
    document.getElementById('d-principal').innerText = `KSh ${c.loan.toLocaleString()}`;
    document.getElementById('d-total-int').innerText = `KSh ${totalDue.toLocaleString()}`;
    document.getElementById('d-bal-input').value = c.balance;
    document.getElementById('d-total-paid').innerText = `KSh ${(totalDue - c.balance).toLocaleString()}`;
    document.getElementById('d-start').value = c.startDate || "";
    document.getElementById('d-end').value = c.endDate || "";
    renderHistory(c.history || []);
    document.getElementById('detailWindow').classList.remove('hidden');
};

function renderHistory(history) {
    const tbody = document.getElementById('activityTableBody');
    tbody.innerHTML = history.slice().reverse().map(h => `
        <tr>
            <td>${h.date}</td>
            <td>${h.act}</td>
            <td>${h.det}</td>
            <td>${h.by || "Admin"}</td>
        </tr>
    `).join('');
}

window.updatePayment = function() {
    const amt = parseFloat(document.getElementById('dailyPay').value);
    if (amt > 0) {
        clients[currentIndex].balance -= amt;
        clients[currentIndex].history.push({
            date: new Date().toLocaleDateString('en-GB'),
            act: "Payment",
            amt: amt,
            det: `Paid KSh ${amt.toLocaleString()}`,
            by: "Admin"
        });
        saveData();
        document.getElementById('dailyPay').value = "";
    }
};

window.saveManualBalance = function() {
    clients[currentIndex].balance = parseFloat(document.getElementById('d-bal-input').value);
    saveData();
};

window.renderTable = function() {
    document.getElementById('clientTableBody').innerHTML = clients.map((c, i) => `
        <tr><td>${i+1}</td><td><strong>${c.name}</strong></td><td>${c.phone}</td>
        <td>KSh ${c.balance.toLocaleString()}</td>
        <td><button onclick="openDashboard(${i})" class="view-btn">View</button></td></tr>
    `).join('');
};

window.updateClientField = function(f, v) { clients[currentIndex][f] = v; saveData(); };
window.closeDetails = function() { currentIndex = null; document.getElementById('detailWindow').classList.add('hidden'); };
window.deleteClient = function(i) { if(confirm("Delete Client Profile?")) { clients.splice(i, 1); saveData(); closeDetails(); }};
window.markAsCleared = function() { clients[currentIndex].balance = 0; clients[currentIndex].status = "Cleared"; saveData(); };
window.searchClients = function() {
    const term = document.getElementById('globalSearch').value.toLowerCase();
    document.querySelectorAll('#clientTableBody tr').forEach(row => {
        row.style.display = row.cells[1].innerText.toLowerCase().includes(term) ? "" : "none";
    });
};

