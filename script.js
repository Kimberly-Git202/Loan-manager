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
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, email, pass).catch(err => alert("Access Denied"));
};

window.handleLogout = () => signOut(auth);

function loadData() {
    onValue(ref(db, 'jml_data/'), (snapshot) => {
        clients = snapshot.val() || [];
        renderTable();
    });
}

function saveData() { set(ref(db, 'jml_data/'), clients); }

window.toggleSidebar = function() {
    document.getElementById('sidebar').classList.toggle('open');
};

window.showSection = function(id) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if(window.innerWidth < 768) toggleSidebar(); // Auto-close menu on mobile
};

window.renderTable = function() {
    const tbody = document.getElementById('clientTableBody');
    tbody.innerHTML = clients.map((c, i) => `
        <tr>
            <td>${i+1}</td>
            <td><strong>${c.name}</strong></td>
            <td>${c.phone || 'N/A'}</td>
            <td style="color:var(--accent); font-weight:bold">KSh ${c.balance.toLocaleString()}</td>
            <td><button class="view-btn" onclick="openDashboard(${i})">Open</button></td>
        </tr>
    `).join('');
};

window.openDashboard = function(index) {
    currentIndex = index;
    const c = clients[index];
    document.getElementById('d-name').innerText = c.name;
    document.getElementById('d-principal').innerText = c.loan;
    document.getElementById('d-bal-input').value = c.balance;
    renderActivity(c.history || []);
    document.getElementById('detailWindow').classList.remove('hidden');
};

function renderActivity(history) {
    const tbody = document.getElementById('activityTableBody');
    tbody.innerHTML = history.slice().reverse().map(h => {
        const isLate = h.time > "18:00";
        return `<tr>
            <td>${h.date}</td>
            <td style="color:${isLate ? 'red':'inherit'}">${h.time}</td>
            <td>${h.by}</td>
        </tr>`;
    }).join('');
}

window.updatePayment = function() {
    const amt = parseFloat(document.getElementById('dailyPay').value);
    const user = auth.currentUser ? auth.currentUser.email.split('@')[0] : "Admin";
    if (amt > 0) {
        clients[currentIndex].balance -= amt;
        clients[currentIndex].history.push({
            date: new Date().toLocaleDateString('en-GB'),
            time: new Date().toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'}),
            act: "Payment",
            by: user
        });
        saveData();
        document.getElementById('dailyPay').value = "";
    }
};

window.closeDetails = () => {
    document.getElementById('detailWindow').classList.add('hidden');
    currentIndex = null;
};

