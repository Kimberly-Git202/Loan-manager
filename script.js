
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

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-overlay').style.display = 'none';
        loadData();
    } else {
        document.getElementById('login-overlay').style.display = 'flex';
    }
});

window.handleLogin = () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, e, p).catch(err => alert("Login Error"));
};

window.handleLogout = () => signOut(auth);

function loadData() {
    onValue(ref(db, 'jml_data/'), (snapshot) => {
        clients = snapshot.val() || [];
        renderTable();
        if (currentIndex !== null) openDashboard(currentIndex);
    });
}

function saveData() { set(ref(db, 'jml_data/'), clients); }

window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('open');

window.toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
};

// Apply saved theme
if(localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');

window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if(window.innerWidth < 768) toggleSidebar();
};

window.renderTable = () => {
    const tbody = document.getElementById('clientTableBody');
    tbody.innerHTML = clients.map((c, i) => `
        <tr>
            <td><strong>${c.name}</strong></td>
            <td>${c.phone || '---'}</td>
            <td>KSh ${c.balance.toLocaleString()}</td>
            <td><button onclick="openDashboard(${i})" style="padding:5px 10px; border-radius:5px; background:var(--accent); color:white; border:none;">View</button></td>
        </tr>
    `).join('');
};

window.openDashboard = (i) => {
    currentIndex = i;
    const c = clients[i];
    const principal = parseFloat(c.loan);
    const totalInt = principal * 1.25; // 25% Interest
    const totalPaid = totalInt - parseFloat(c.balance);

    document.getElementById('d-name').innerText = c.name;
    document.getElementById('d-principal').innerText = `KSh ${principal.toLocaleString()}`;
    document.getElementById('d-total-int').innerText = `KSh ${totalInt.toLocaleString()}`;
    document.getElementById('d-balance').innerText = `KSh ${c.balance.toLocaleString()}`;
    document.getElementById('d-total-paid').innerText = `KSh ${totalPaid.toLocaleString()}`;
    
    renderActivity(c.history || []);
    document.getElementById('detailWindow').classList.remove('hidden');
};

function renderActivity(history) {
    const tbody = document.getElementById('activityTableBody');
    tbody.innerHTML = history.slice().reverse().map(h => {
        const isLate = h.time > "18:00";
        return `<tr>
            <td>${h.date}</td>
            <td style="color:${isLate ? 'red' : 'inherit'}; font-weight:${isLate ? 'bold' : 'normal'}">${h.time}</td>
            <td>${h.det}</td>
            <td>${h.by}</td>
        </tr>`;
    }).join('');
}

window.updatePayment = () => {
    const amt = parseFloat(document.getElementById('dailyPay').value);
    const time = document.getElementById('payTime').value;
    const user = auth.currentUser.email.split('@')[0];

    if (amt > 0) {
        clients[currentIndex].balance -= amt;
        clients[currentIndex].history.push({
            date: new Date().toLocaleDateString('en-GB'),
            time: time,
            det: `Paid KSh ${amt.toLocaleString()}`,
            by: user
        });
        saveData();
        document.getElementById('dailyPay').value = "";
    }
};

window.markAsCleared = () => {
    if(confirm("Confirm Settle Loan?")) {
        clients[currentIndex].balance = 0;
        clients[currentIndex].history.push({
            date: new Date().toLocaleDateString('en-GB'),
            time: new Date().toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'}),
            det: "Loan Settled Fully",
            by: "System"
        });
        saveData();
    }
};

window.deleteClient = () => {
    if(confirm("Permanently delete this profile?")) {
        clients.splice(currentIndex, 1);
        saveData();
        closeDetails();
    }
};

window.closeDetails = () => {
    currentIndex = null;
    document.getElementById('detailWindow').classList.add('hidden');
};

document.getElementById('clientForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const principal = parseFloat(document.getElementById('f-loan').value);
    const newClient = {
        name: document.getElementById('f-name').value,
        loan: principal,
        balance: principal * 1.25, // Starting balance includes 25% interest
        startDate: document.getElementById('f-start').value,
        history: [{
            date: new Date().toLocaleDateString('en-GB'),
            time: new Date().toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'}),
            det: "Account Opened",
            by: "Admin"
        }]
    };
    clients.push(newClient);
    saveData();
    showSection('list-sec');
    this.reset();
});

