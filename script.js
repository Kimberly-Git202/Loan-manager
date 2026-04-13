
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAEMpC9oczMDYybbkZirDkY9a25d8ZqjJw",
  authDomain: "jml-loans-560d8.firebaseapp.com",
  projectId: "jml-loans-560d8",
  storageBucket: "jml-loans-560d8.firebasestorage.app",
  databaseURL: "https://jml-loans-560d8-default-rtdb.europe-west1.firebasedatabase.app", 
  appId: "1:425047270355:web:6ccd08365ca1cde7354526"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

let clients = [];
let currentIndex = null;

// Auth Check
onAuthStateChanged(auth, (user) => {
    const overlay = document.getElementById('login-overlay');
    if (user) { overlay.classList.add('hidden'); loadData(); }
    else { overlay.classList.remove('hidden'); }
});

window.handleLogin = () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, email, pass).catch(e => alert(e.message));
};

window.handleLogout = () => signOut(auth);

// Dark Mode Fixed
window.toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
};

if(localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');

// Core Functions
function loadData() {
    onValue(ref(db, 'jml_data/'), (snap) => {
        clients = snap.val() || [];
        renderTable();
        updateFinancials();
        if(currentIndex !== null) openDashboard(currentIndex);
    });
}

function saveData() { set(ref(db, 'jml_data/'), clients); }

window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('minimized');

window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if(window.innerWidth < 768) toggleSidebar();
};

function updateFinancials() {
    let totalOut = 0, totalPaid = 0, todayRev = 0;
    const today = new Date().toLocaleDateString('en-GB');

    clients.forEach(c => {
        totalOut += parseFloat(c.balance || 0);
        const totalInt = (c.loan || 0) * 1.25;
        totalPaid += (totalInt - c.balance);

        (c.history || []).forEach(h => {
            if(h.date === today && h.act === "Payment") todayRev += parseFloat(h.amt || 0);
        });
    });

    document.getElementById('grand-total-out').innerText = `KSh ${totalOut.toLocaleString()}`;
    document.getElementById('grand-total-paid').innerText = `KSh ${totalPaid.toLocaleString()}`;
    document.getElementById('summary-today').innerText = `KSh ${todayRev.toLocaleString()}`;
}

// Client Handling
document.getElementById('clientForm').onsubmit = (e) => {
    e.preventDefault();
    const principal = parseFloat(document.getElementById('f-loan').value);
    const newClient = {
        name: document.getElementById('f-name').value,
        phone: document.getElementById('f-phone').value,
        loan: principal,
        balance: principal * 1.25,
        history: [{
            date: new Date().toLocaleDateString('en-GB'),
            time: new Date().toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'}),
            act: "Loan Started",
            det: `Approved KSh ${(principal * 1.25).toLocaleString()}`,
            by: "Admin"
        }]
    };
    clients.push(newClient);
    saveData();
    showSection('list-sec');
    e.target.reset();
};

window.renderTable = () => {
    const tbody = document.getElementById('clientTableBody');
    tbody.innerHTML = clients.map((c, i) => `
        <tr>
            <td>${i+1}</td>
            <td><strong>${c.name}</strong></td>
            <td>${c.phone}</td>
            <td style="color:var(--accent); font-weight:bold">KSh ${c.balance.toLocaleString()}</td>
            <td><button onclick="openDashboard(${i})" class="btn-primary" style="padding:5px 10px">View</button></td>
        </tr>
    `).join('');
};

window.openDashboard = (i) => {
    currentIndex = i;
    const c = clients[i];
    const totalInt = c.loan * 1.25;
    
    document.getElementById('d-name').innerText = c.name;
    document.getElementById('d-principal').innerText = `KSh ${c.loan.toLocaleString()}`;
    document.getElementById('d-total-int').innerText = `KSh ${totalInt.toLocaleString()}`;
    document.getElementById('d-bal-input').value = c.balance;
    document.getElementById('d-total-paid').innerText = `KSh ${(totalInt - c.balance).toLocaleString()}`;
    
    // Toggle Reactivation Logic
    if(c.balance <= 0) {
        document.getElementById('payment-input-area').classList.add('hidden');
        document.getElementById('reactivate-area').classList.remove('hidden');
        document.getElementById('settle-btn').classList.add('hidden');
    } else {
        document.getElementById('payment-input-area').classList.remove('hidden');
        document.getElementById('reactivate-area').classList.add('hidden');
        document.getElementById('settle-btn').classList.remove('hidden');
    }

    renderActivity(c.history || []);
    document.getElementById('detailWindow').classList.remove('hidden');
};

function renderActivity(history) {
    const tbody = document.getElementById('activityTableBody');
    tbody.innerHTML = history.slice().reverse().map(h => {
        const isLate = h.time > "18:00";
        return `<tr>
            <td>${h.date}</td>
            <td style="color:${isLate ? 'red':'inherit'}; font-weight:${isLate ? 'bold':'normal'}">${h.time}</td>
            <td>${h.det || h.act}</td>
            <td>${h.by}</td>
        </tr>`;
    }).join('');
}

window.updatePayment = () => {
    const amt = parseFloat(document.getElementById('dailyPay').value);
    const time = document.getElementById('payTime').value;
    if(!amt) return;

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
};

window.reactivateLoan = () => {
    const newAmt = parseFloat(document.getElementById('new-loan-amt').value);
    if(!newAmt) return;

    clients[currentIndex].loan = newAmt;
    clients[currentIndex].balance = newAmt * 1.25;
    clients[currentIndex].history.push({
        date: new Date().toLocaleDateString('en-GB'),
        time: new Date().toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'}),
        act: "New Loan",
        det: `Started New Loan: KSh ${(newAmt * 1.25).toLocaleString()}`,
        by: "Admin"
    });
    saveData();
    document.getElementById('new-loan-amt').value = "";
};

window.markAsCleared = () => {
    if(confirm("Mark loan as fully settled?")) {
        clients[currentIndex].balance = 0;
        clients[currentIndex].history.push({
            date: new Date().toLocaleDateString('en-GB'),
            time: new Date().toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'}),
            act: "Settled",
            det: "Account cleared",
            by: "Admin"
        });
        saveData();
    }
};

window.saveManualBalance = () => {
    clients[currentIndex].balance = parseFloat(document.getElementById('d-bal-input').value);
    saveData();
};

window.deleteClient = () => {
    if(confirm("Permanently delete client?")) {
        clients.splice(currentIndex, 1);
        saveData();
        closeDetails();
    }
};

window.closeDetails = () => {
    currentIndex = null;
    document.getElementById('detailWindow').classList.add('hidden');
};

window.searchClients = () => {
    const term = document.getElementById('globalSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#clientTableBody tr');
    rows.forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(term) ? "" : "none";
    });
};


