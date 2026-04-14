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

// Auth Listener
onAuthStateChanged(auth, (user) => {
    const login = document.getElementById('login-overlay');
    if (user) { login.classList.add('hidden'); loadData(); }
    else { login.classList.remove('hidden'); }
});

window.handleLogin = () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, e, p).catch(() => alert("Invalid Credentials"));
};
window.handleLogout = () => signOut(auth);

function loadData() {
    onValue(ref(db, 'jml_data/'), (snap) => {
        clients = snap.val() || [];
        renderTable();
        updateFinancials();
        if(currentIndex !== null) openDashboard(currentIndex);
    });
}

function saveData() { set(ref(db, 'jml_data/'), clients); }

// UI functions
window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('minimized');
window.toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
};
if(localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');

window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    // Fixed event issue for mobile
    if(event) event.currentTarget.classList.add('active');
    if(window.innerWidth < 768) toggleSidebar();
};

// SEARCH FUNCTION ADDED HERE
window.searchClients = () => {
    const term = document.getElementById('globalSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#clientTableBody tr');
    rows.forEach(row => {
        const name = row.cells[1].innerText.toLowerCase();
        row.style.display = name.includes(term) ? "" : "none";
    });
};

function updateFinancials() {
    let tOut = 0, tPaid = 0, tToday = 0;
    const today = new Date().toLocaleDateString('en-GB');
    clients.forEach(c => {
        tOut += (c.balance || 0);
        const totalWithInt = (c.loan || 0) * 1.25;
        tPaid += (totalWithInt - (c.balance || 0));
        (c.history || []).forEach(h => {
            if(h.date === today && h.act === "Payment") tToday += (h.amt || 0);
        });
    });
    document.getElementById('total-out').innerText = `KSh ${tOut.toLocaleString()}`;
    document.getElementById('total-paid').innerText = `KSh ${tPaid.toLocaleString()}`;
    document.getElementById('total-today').innerText = `KSh ${tToday.toLocaleString()}`;
    document.getElementById('top-today').innerText = `KSh ${tToday.toLocaleString()}`;
}

window.renderTable = () => {
    const tbody = document.getElementById('clientTableBody');
    tbody.innerHTML = clients.map((c, i) => `
        <tr>
            <td>${i+1}</td>
            <td><strong>${c.name}</strong></td>
            <td>${c.phone}</td>
            <td style="color:var(--accent); font-weight:bold">KSh ${c.balance.toLocaleString()}</td>
            <td><button class="view-btn" onclick="openDashboard(${i})">Open</button></td>
        </tr>
    `).join('');
};

window.openDashboard = (i) => {
    currentIndex = i;
    const c = clients[i];
    const totalDue = c.loan * 1.25;
    document.getElementById('d-name').innerText = c.name;
    document.getElementById('d-principal').innerText = `KSh ${c.loan.toLocaleString()}`;
    document.getElementById('d-total').innerText = `KSh ${totalDue.toLocaleString()}`;
    document.getElementById('d-balance').innerText = `KSh ${c.balance.toLocaleString()}`;
    document.getElementById('d-paid').innerText = `KSh ${(totalDue - c.balance).toLocaleString()}`;
    
    // START AND END DATE DISPLAY ADDED HERE
    document.getElementById('d-start-val').innerText = c.startDate || "---";
    document.getElementById('d-end-val').innerText = c.endDate || "---";

    document.getElementById('historyBody').innerHTML = (c.history || []).slice().reverse().map(h => `
        <tr>
            <td>${h.date}</td>
            <td style="${h.time > '18:00' ? 'color:red; font-weight:bold' : ''}">${h.time}</td>
            <td>${h.det}</td>
            <td>${h.by}</td>
        </tr>`).join('');
    document.getElementById('detailWindow').classList.remove('hidden');
};

window.processPayment = () => {
    const amt = parseFloat(document.getElementById('payAmt').value);
    const time = document.getElementById('payTime').value;
    const staff = auth.currentUser.email.split('@')[0];
    if(amt > 0) {
        clients[currentIndex].balance -= amt;
        clients[currentIndex].history.push({
            date: new Date().toLocaleDateString('en-GB'),
            time: time, act: "Payment", amt: amt, det: `Paid KSh ${amt.toLocaleString()}`, by: staff
        });
        saveData();
        document.getElementById('payAmt').value = "";
    }
};

window.settleAndReset = () => {
    if(confirm("Settle this loan and prepare for a new one? Client data stays.")){
        clients[currentIndex].balance = 0;
        clients[currentIndex].loan = 0;
        clients[currentIndex].history.push({
            date: new Date().toLocaleDateString('en-GB'),
            time: new Date().toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'}),
            act: "System", det: "Account Settled", by: "Admin"
        });
        saveData();
    }
};

window.deleteClient = () => {
    if(confirm("Delete entire client profile?")){
        clients.splice(currentIndex, 1);
        saveData();
        closeDetails();
    }
};

window.closeDetails = () => { currentIndex = null; document.getElementById('detailWindow').classList.add('hidden'); };

document.getElementById('clientForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const p = parseFloat(document.getElementById('f-loan').value);
    const staff = auth.currentUser.email.split('@')[0];
    clients.push({
        name: document.getElementById('f-name').value,
        phone: document.getElementById('f-phone').value,
        // START AND END DATE SAVING ADDED HERE
        startDate: document.getElementById('f-start').value,
        endDate: document.getElementById('f-end').value,
        loan: p, balance: p * 1.25,
        history: [{
            date: new Date().toLocaleDateString('en-GB'),
            time: new Date().toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'}),
            act: "Initial", det: "Account Created", by: staff
        }]
    });
    saveData();
    showSection('list-sec');
    e.target.reset();
});
