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

// Auth Logic
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

// Core Data Logic
function loadData() {
    onValue(ref(db, 'jml_data/'), (snap) => {
        clients = snap.val() || [];
        renderTable();
        updateFinancials();
        if(currentIndex !== null) openDashboard(currentIndex);
    });
}

function saveData() { set(ref(db, 'jml_data/'), clients); }

// UI Toggles
window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('minimized');
window.toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
};

// Apply saved theme on load
if(localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');

window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if(window.innerWidth < 768) toggleSidebar();
};

// Calculations
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

    document.getElementById('grand-out').innerText = `KSh ${tOut.toLocaleString()}`;
    document.getElementById('grand-paid').innerText = `KSh ${tPaid.toLocaleString()}`;
    document.getElementById('grand-today').innerText = `KSh ${tToday.toLocaleString()}`;
    document.getElementById('top-rev').innerText = `KSh ${tToday.toLocaleString()}`;
}

window.renderTable = () => {
    const tbody = document.getElementById('clientTableBody');
    tbody.innerHTML = clients.map((c, i) => `
        <tr>
            <td>${i+1}</td>
            <td><strong>${c.name}</strong></td>
            <td>${c.phone}</td>
            <td style="font-weight:bold; color:var(--accent)">KSh ${c.balance.toLocaleString()}</td>
            <td><button class="view-btn" onclick="openDashboard(${i})">View</button></td>
        </tr>
    `).join('');
};

window.openDashboard = (i) => {
    currentIndex = i;
    const c = clients[i];
    const totalDue = c.loan * 1.25;
    const totalPaid = totalDue - c.balance;

    document.getElementById('d-name').innerText = c.name;
    document.getElementById('d-principal').innerText = `KSh ${c.loan.toLocaleString()}`;
    document.getElementById('d-total').innerText = `KSh ${totalDue.toLocaleString()}`;
    document.getElementById('d-balance').innerText = `KSh ${c.balance.toLocaleString()}`;
    document.getElementById('d-paid').innerText = `KSh ${totalPaid.toLocaleString()}`;

    const hBody = document.getElementById('historyBody');
    hBody.innerHTML = (c.history || []).slice().reverse().map(h => {
        const timeColor = h.time > "18:00" ? 'color:red; font-weight:bold' : '';
        return `<tr>
            <td>${h.date}</td>
            <td style="${timeColor}">${h.time}</td>
            <td>${h.det}</td>
            <td>${h.by}</td>
        </tr>`;
    }).join('');

    document.getElementById('detailWindow').classList.remove('hidden');
};

window.processPayment = () => {
    const amt = parseFloat(document.getElementById('payAmt').value);
    const time = document.getElementById('payTime').value;
    if(!amt || amt <= 0) return;

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
    document.getElementById('payAmt').value = "";
};

window.settleLoan = () => {
    if(confirm("Mark loan as settled? Client details remain for new loans.")){
        clients[currentIndex].balance = 0;
        clients[currentIndex].loan = 0; // Reset principal but keep profile
        clients[currentIndex].history.push({
            date: new Date().toLocaleDateString('en-GB'),
            time: new Date().toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'}),
            act: "Settled",
            det: "Loan Cleared",
            by: "Admin"
        });
        saveData();
    }
};

window.deleteClient = () => {
    if(confirm("Delete entire profile?")){
        clients.splice(currentIndex, 1);
        saveData();
        closeDetails();
    }
};

window.closeDetails = () => {
    currentIndex = null;
    document.getElementById('detailWindow').classList.add('hidden');
};

document.getElementById('clientForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const principal = parseFloat(document.getElementById('f-loan').value);
    clients.push({
        name: document.getElementById('f-name').value,
        phone: document.getElementById('f-phone').value,
        loan: principal,
        balance: principal * 1.25,
        history: [{
            date: new Date().toLocaleDateString('en-GB'),
            time: new Date().toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'}),
            act: "Initial",
            det: `Loan Approved KSh ${principal.toLocaleString()}`,
            by: "Admin"
        }]
    });
    saveData();
    showSection('list-sec');
    e.target.reset();
});
