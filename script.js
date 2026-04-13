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

// Initial Load
onValue(ref(db, 'jml_data/'), (snapshot) => {
    clients = snapshot.val() || [];
    renderTable();
    updateFinanceSummary();
    if (currentIndex !== null) openDashboard(currentIndex);
});

function saveData() { set(ref(db, 'jml_data/'), clients); }

window.toggleSidebar = function() { document.getElementById('sidebar').classList.toggle('minimized'); };
window.toggleDarkMode = function() { document.body.classList.toggle('dark-mode'); };

window.showSection = function(id) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    // Target active nav based on click context
};

function updateFinanceSummary() {
    let out = 0, paid = 0, today = 0;
    const todayStr = new Date().toLocaleDateString('en-GB');

    clients.forEach(c => {
        const totalWithInt = (c.loan || 0) * 1.25;
        out += (c.balance || 0);
        paid += (totalWithInt - (c.balance || 0));
        
        (c.history || []).forEach(h => {
            if (h.date === todayStr && h.act === "Payment") today += (h.amt || 0);
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
            time: new Date().toLocaleTimeString('en-GB', {hour: '2-digit', minute:'2-digit'}),
            act: "Loan Started", 
            det: `Approved KSh ${totalDue.toLocaleString()}`, 
            by: "Admin" 
        }]
    };
    clients.push(newClient);
    saveData();
    showSection('list-sec');
    this.reset();
});

window.renderTable = function() {
    const tbody = document.getElementById('clientTableBody');
    tbody.innerHTML = clients.map((c, i) => `
        <tr>
            <td>${i+1}</td>
            <td><strong>${c.name}</strong></td>
            <td>${c.phone}</td>
            <td>KSh ${c.balance.toLocaleString()}</td>
            <td style="text-align:center;"><button class="view-btn" onclick="openDashboard(${i})">View</button></td>
        </tr>
    `).join('');
};

window.openDashboard = function(index) {
    currentIndex = index;
    const c = clients[index];
    const totalInt = (c.loan || 0) * 1.25;

    document.getElementById('d-name').innerText = c.name;
    document.getElementById('d-principal').innerText = `KSh ${(c.loan || 0).toLocaleString()}`;
    document.getElementById('d-total-int').innerText = `KSh ${totalInt.toLocaleString()}`;
    document.getElementById('d-bal-input').value = c.balance;
    document.getElementById('d-total-paid').innerText = `KSh ${(totalInt - c.balance).toLocaleString()}`;
    document.getElementById('d-start').value = c.startDate || "";
    document.getElementById('d-end').value = c.endDate || "";
    
    renderActivity(c.history || []);
    document.getElementById('detailWindow').classList.remove('hidden');
};

function renderActivity(history) {
    const tbody = document.getElementById('activityTableBody');
    tbody.innerHTML = history.slice().reverse().map(h => {
        const isLate = h.time && h.time > "18:00";
        const timeStyle = isLate ? 'style="color: #ef4444; font-weight: bold;"' : '';
        
        return `
            <tr>
                <td>${h.date}</td>
                <td ${timeStyle}>${h.time || "---"}</td>
                <td>${h.det}</td>
                <td style="font-weight:600; color:var(--primary);">${h.by}</td>
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
        saveData();
        document.getElementById('dailyPay').value = "";
    } else {
        alert("Please enter a valid amount.");
    }
};

window.saveManualBalance = function() {
    clients[currentIndex].balance = parseFloat(document.getElementById('d-bal-input').value);
    saveData();
};

window.updateClientField = function(f, v) { clients[currentIndex][f] = v; saveData(); };
window.closeDetails = function() { currentIndex = null; document.getElementById('detailWindow').classList.add('hidden'); };
window.deleteClient = function(i) { if(confirm("Delete Profile?")) { clients.splice(i, 1); saveData(); closeDetails(); }};
window.markAsCleared = function() { if(confirm("Settle Loan?")) { clients[currentIndex].balance = 0; clients[currentIndex].status = "Cleared"; saveData(); }};
window.searchClients = function() {
    const term = document.getElementById('globalSearch').value.toLowerCase();
    document.querySelectorAll('#clientTableBody tr').forEach(row => {
        row.style.display = row.cells[1].innerText.toLowerCase().includes(term) ? "" : "none";
    });
};
