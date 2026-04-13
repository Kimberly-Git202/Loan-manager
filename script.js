
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
    updateFinancialSummary();
    if (currentIndex !== null) openDashboard(currentIndex);
});

function saveData() { set(ref(db, 'jml_data/'), clients); }

window.toggleSidebar = function() { document.getElementById('sidebar').classList.toggle('minimized'); };

window.showSection = function(id) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
};

window.toggleDarkMode = function() {
    const body = document.body;
    body.classList.toggle('dark-mode');
    body.classList.toggle('light-mode');
};

// --- CALCULATIONS ---
function updateFinancialSummary() {
    let grandOut = 0;
    let grandPaid = 0;
    let grandToday = 0;
    const todayStr = new Date().toLocaleDateString('en-GB');

    clients.forEach(c => {
        const totalInt = c.loan * 1.25;
        const totalPaid = totalInt - c.balance;
        grandOut += c.balance;
        grandPaid += totalPaid;

        (c.history || []).forEach(h => {
            if (h.date === todayStr && h.act === "Payment") {
                grandToday += h.amt || 0;
            }
        });
    });

    document.getElementById('grand-total-out').innerText = `KSh ${grandOut.toLocaleString()}`;
    document.getElementById('grand-total-paid').innerText = `KSh ${grandPaid.toLocaleString()}`;
    document.getElementById('grand-total-today').innerText = `KSh ${grandToday.toLocaleString()}`;
    document.getElementById('summary-today').innerText = `KSh ${grandToday.toLocaleString()}`;
}

// --- ADD CLIENT ---
document.getElementById('clientForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const principal = parseFloat(document.getElementById('f-loan').value);
    const totalWithInterest = principal * 1.25;

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
        totalWithInt: totalWithInterest,
        balance: totalWithInterest,
        status: "Active",
        history: [{ 
            date: new Date().toLocaleDateString('en-GB'), 
            time: new Date().toLocaleTimeString('en-GB', {hour: '2-digit', minute:'2-digit'}),
            act: "Loan Started", 
            det: `Principal KSh ${principal.toLocaleString()} (Total Due: ${totalWithInterest.toLocaleString()})`, 
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
            <td><strong>${c.name}</strong></td>
            <td>${c.phone}</td>
            <td>KSh ${c.balance.toLocaleString()}</td>
            <td><button class="view-btn" onclick="openDashboard(${i})">View</button></td>
        </tr>
    `).join('');
}

// --- DASHBOARD ---
window.openDashboard = function(index) {
    currentIndex = index;
    const c = clients[index];
    const totalInt = c.loan * 1.25;
    const totalPaid = totalInt - c.balance;

    document.getElementById('d-name').innerText = c.name;
    document.getElementById('d-status').value = c.status;
    document.getElementById('d-occ').innerText = c.occ;
    document.getElementById('d-idnum').innerText = c.idNum;
    document.getElementById('d-addr').innerText = c.addr;
    document.getElementById('d-phone').innerText = c.phone;
    document.getElementById('d-ref').innerText = c.ref;
    document.getElementById('d-start').value = c.startDate || "";
    document.getElementById('d-end').value = c.endDate || "";
    
    document.getElementById('d-principal').innerText = `KSh ${c.loan.toLocaleString()}`;
    document.getElementById('d-total-int').innerText = `KSh ${totalInt.toLocaleString()}`;
    document.getElementById('d-bal-input').value = c.balance;
    document.getElementById('d-total-paid').innerText = `KSh ${totalPaid.toLocaleString()}`;

    renderActivity(c.history || []);
    document.getElementById('detailWindow').classList.remove('hidden');
};

function renderActivity(history) {
    const tbody = document.getElementById('activityTableBody');
    if (!tbody) return;
    tbody.innerHTML = history.slice().reverse().map(h => {
        const isLate = h.time && h.time > "18:00" ? 'style="color: #ef4444; font-weight: bold;"' : '';
        return `<tr>
            <td>${h.date}</td>
            <td ${isLate}>${h.time || "---"}</td>
            <td>${h.act}</td>
            <td>${h.det}</td>
            <td>${h.by}</td>
        </tr>`;
    }).join('');
}

window.updatePayment = function() {
    const amt = parseFloat(document.getElementById('dailyPay').value);
    const time = document.getElementById('payTime').value;
    if (amt > 0) {
        clients[currentIndex].balance -= amt;
        clients[currentIndex].history.push({
            date: new Date().toLocaleDateString('en-GB'),
            time: time,
            act: "Payment",
            amt: amt,
            det: `Paid KSh ${amt.toLocaleString()}`,
            by: "Admin"
        });
        document.getElementById('dailyPay').value = "";
        saveData();
    }
};

window.saveManualBalance = function() {
    const newVal = parseFloat(document.getElementById('d-bal-input').value);
    clients[currentIndex].history.push({
        date: new Date().toLocaleDateString('en-GB'),
        time: new Date().toLocaleTimeString('en-GB', {hour: '2-digit', minute:'2-digit'}),
        act: "Correction",
        det: `Adjusted to KSh ${newVal.toLocaleString()}`,
        by: "Admin"
    });
    clients[currentIndex].balance = newVal;
    saveData();
};

window.updateClientField = function(field, val) { clients[currentIndex][field] = val; saveData(); };
window.closeDetails = function() { currentIndex = null; document.getElementById('detailWindow').classList.add('hidden'); };
window.deleteClient = function(index) { if(confirm("Delete permanently?")) { clients.splice(index, 1); saveData(); closeDetails(); } };

window.searchClients = function() {
    const term = document.getElementById('globalSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#clientTableBody tr');
    rows.forEach(row => { row.style.display = row.cells[1].innerText.toLowerCase().includes(term) ? "" : "none"; });
};

