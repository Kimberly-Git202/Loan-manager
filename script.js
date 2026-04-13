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

// Persistence for Dark Mode
if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');

onAuthStateChanged(auth, user => {
    if (user) {
        document.getElementById('login-overlay').classList.add('hidden');
        loadData();
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
    }
});

function loadData() {
    onValue(ref(db, 'jml_data/'), (snap) => {
        clients = snap.val() || [];
        renderTable();
        calculateFinance();
    });
}

function saveData() { set(ref(db, 'jml_data/'), clients); }

window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('open');
window.toggleDarkMode = () => {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
};

window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if (window.innerWidth < 768) toggleSidebar();
};

function calculateFinance() {
    let out = 0, paid = 0, today = 0;
    const now = new Date().toLocaleDateString('en-GB');
    
    clients.forEach(c => {
        out += (parseFloat(c.balance) || 0);
        (c.history || []).forEach(h => {
            if (h.act === "Payment") {
                paid += (parseFloat(h.amt) || 0);
                if (h.date === now) today += (parseFloat(h.amt) || 0);
            }
        });
    });
    
    document.getElementById('f-out').innerText = `KSh ${out.toLocaleString()}`;
    document.getElementById('f-paid').innerText = `KSh ${paid.toLocaleString()}`;
    document.getElementById('f-today').innerText = `KSh ${today.toLocaleString()}`;
    document.getElementById('header-today').innerText = `KSh ${today.toLocaleString()}`;
}

window.renderTable = () => {
    const tbody = document.getElementById('clientTableBody');
    tbody.innerHTML = clients.map((c, i) => `
        <tr>
            <td>${i+1}</td>
            <td><b>${c.name}</b></td>
            <td>${c.phone}</td>
            <td style="color:var(--accent); font-weight:bold">KSh ${(c.balance || 0).toLocaleString()}</td>
            <td><button class="btn-post" onclick="openModal(${i})">View</button></td>
        </tr>
    `).join('');
};

window.openModal = (i) => {
    currentIndex = i;
    const c = clients[i];
    document.getElementById('d-name').innerText = c.name;
    document.getElementById('d-principal').innerText = `KSh ${(c.loan || 0).toLocaleString()}`;
    document.getElementById('d-balance').innerText = `KSh ${(c.balance || 0).toLocaleString()}`;
    document.getElementById('d-start').value = c.startDate || '';
    document.getElementById('d-end').value = c.endDate || '';
    
    // Toggle Renewal View
    const settled = c.balance <= 0;
    document.getElementById('payment-area').classList.toggle('hidden', settled);
    document.getElementById('settleBtn').classList.toggle('hidden', settled);
    document.getElementById('renewal-area').classList.toggle('hidden', !settled);
    document.getElementById('status-badge').innerText = settled ? "Cleared" : "Active";
    document.getElementById('status-badge').style.background = settled ? "var(--success)" : "var(--accent)";
    document.getElementById('status-badge').style.color = "white";

    renderHistory(c.history || []);
    document.getElementById('detailModal').classList.remove('hidden');
};

function renderHistory(history) {
    const tbody = document.getElementById('historyBody');
    tbody.innerHTML = history.slice().reverse().map(h => {
        const isLate = h.time > "18:00";
        return `<tr>
            <td>${h.date}</td>
            <td class="${isLate ? 'late-time' : ''}">${h.time}</td>
            <td>${h.det}</td>
            <td>${h.by}</td>
        </tr>`;
    }).join('');
}

window.processPayment = () => {
    const amt = parseFloat(document.getElementById('payAmt').value);
    const time = document.getElementById('payTime').value;
    const user = auth.currentUser.email.split('@')[0];
    
    if (amt > 0) {
        clients[currentIndex].balance -= amt;
        clients[currentIndex].history.push({
            date: new Date().toLocaleDateString('en-GB'),
            time: time,
            act: "Payment",
            amt: amt,
            det: `Paid KSh ${amt.toLocaleString()}`,
            by: user
        });
        saveData();
        openModal(currentIndex); // Refresh UI
        document.getElementById('payAmt').value = '';
    }
};

window.settleLoan = () => {
    if(confirm("Mark loan as fully settled?")) {
        clients[currentIndex].balance = 0;
        clients[currentIndex].history.push({
            date: new Date().toLocaleDateString('en-GB'),
            time: "---",
            act: "System",
            det: "Loan Settle/Closed",
            by: "Admin"
        });
        saveData();
        openModal(currentIndex);
    }
};

window.showNewLoanPrompt = () => {
    const newPrincipal = prompt("Enter New Principal Amount for " + clients[currentIndex].name);
    if (newPrincipal && !isNaN(newPrincipal)) {
        const total = parseFloat(newPrincipal) * 1.25;
        clients[currentIndex].loan = parseFloat(newPrincipal);
        clients[currentIndex].balance = total;
        clients[currentIndex].history.push({
            date: new Date().toLocaleDateString('en-GB'),
            time: new Date().toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'}),
            act: "Renewal",
            det: `New Loan Approved: KSh ${total.toLocaleString()}`,
            by: "Admin"
        });
        saveData();
        openModal(currentIndex);
    }
};

window.closeModal = () => document.getElementById('detailModal').classList.add('hidden');
window.deleteClient = () => {
    if(confirm("PERMANENTLY delete this client record?")) {
        clients.splice(currentIndex, 1);
        saveData();
        closeModal();
    }
};


