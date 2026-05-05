// script.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAEMpC9oczMDYybbkZirDkY9a25d8ZqjJw",
  authDomain: "jml-loans-560d8.firebaseapp.com",
  projectId: "jml-loans-560d8",
  databaseURL: "https://jml-loans-560d8-default-rtdb.europe-west1.firebasedatabase.app",
  messagingSenderId: "425047270355",
  appId: "1:425047270355:web:6ccd08365ca1cde7354526"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

let clients = [];
let currentIndex = null;
let currentUserEmail = "";

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-overlay').style.display = 'none';
        currentUserEmail = user.email || "User";
        loadData();
    } else {
        document.getElementById('login-overlay').style.display = 'flex';
    }
});

window.handleLogin = () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, email, password).catch(() => alert("Invalid Credentials"));
};

window.handleLogout = () => signOut(auth);

function loadData() {
    onValue(ref(db, 'jml_data/'), (snap) => {
        const data = snap.val();
        clients = data ? Object.entries(data).map(([id, value]) => ({id, ...value})) : [];
        renderTable();
        updateFinancials();
        populateMonthSelectors();
    });
}

function saveData() {
    const obj = {};
    clients.forEach(c => {
        const id = c.id || Date.now().toString();
        obj[id] = c;
    });
    set(ref(db, 'jml_data/'), obj);
}

window.renderTable = () => {
    const tbody = document.getElementById('clientTableBody');
    tbody.innerHTML = clients.map((c, i) => {
        const totalDue = (c.loan || 0) * 1.25;
        const balance = totalDue - (c.totalPaid || 0);
        return `
            <tr>
                <td>${i+1}</td>
                <td>${c.name || ''}</td>
                <td>${c.idNumber || ''}</td>
                <td>${c.phone || ''}</td>
                <td>KSh ${(c.loan || 0).toLocaleString()}</td>
                <td>KSh ${(c.totalPaid || 0).toLocaleString()}</td>
                <td style="color:${balance > 0 ? 'var(--danger)' : 'var(--success)'}; font-weight:bold">KSh ${balance.toLocaleString()}</td>
                <td><button class="view-btn" onclick="openDashboard('${c.id}')">View</button></td>
            </tr>`;
    }).join('');
};

window.searchClients = () => {
    const term = document.getElementById('globalSearch').value.toLowerCase();
    document.querySelectorAll('#clientTableBody tr').forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(term) ? "" : "none";
    });
};

window.openDashboard = (id) => {
    currentIndex = clients.findIndex(c => c.id === id);
    const c = clients[currentIndex];
    if (!c) return alert("Client not found");

    const totalDue = (c.loan || 0) * 1.25;
    const balance = totalDue - (c.totalPaid || 0);

    document.getElementById('d-name').innerText = c.name || '';
    document.getElementById('d-principal').innerText = `KSh ${(c.loan || 0).toLocaleString()}`;
    document.getElementById('d-total').innerText = `KSh ${totalDue.toLocaleString()}`;
    document.getElementById('d-balance').innerText = `KSh ${balance.toLocaleString()}`;
    document.getElementById('d-paid').innerText = `KSh ${(c.totalPaid || 0).toLocaleString()}`;

    document.getElementById('clientNotes').value = c.notes || "";

    const historyBody = document.getElementById('historyBody');
    historyBody.innerHTML = (c.history || []).map(h => `
        <tr>
            <td>${h.date}</td>
            <td>${h.time || ''}</td>
            <td>${h.act || ''}</td>
            <td>${h.by || ''}</td>
        </tr>
    `).join('');

    document.getElementById('detailWindow').style.display = "flex";
};

window.processPayment = () => {
    const amt = parseFloat(document.getElementById('payAmt').value);
    const time = document.getElementById('payTime').value;
    if (!amt || !time) return alert("Amount and Time required");

    const c = clients[currentIndex];
    c.totalPaid = (c.totalPaid || 0) + amt;
    c.history = c.history || [];
    c.history.push({
        date: new Date().toLocaleDateString('en-GB'),
        time: time,
        act: "Payment",
        by: currentUserEmail.split('@')[0]
    });

    saveData();
    alert("Payment recorded");
    openDashboard(c.id);
};

document.getElementById('clientForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const newClient = {
        id: Date.now().toString(),
        name: document.getElementById('f-name').value,
        idNumber: document.getElementById('f-idNumber').value,
        phone: document.getElementById('f-phone').value,
        location: document.getElementById('f-location').value,
        occupation: document.getElementById('f-occupation').value,
        referral: document.getElementById('f-referral').value,
        loan: parseFloat(document.getElementById('f-loan').value) || 0,
        totalPaid: 0,
        history: [{date: new Date().toLocaleDateString('en-GB'), act: "New Loan", by: currentUserEmail.split('@')[0]}]
    };

    clients.unshift(newClient);
    saveData();
    renderTable();
    alert("Client enrolled successfully!");
    e.target.reset();
    showSection('clients-sec');
});

function updateFinancials() {
    let loaned = 0, paid = 0;
    clients.forEach(c => {
        loaned += c.loan || 0;
        paid += c.totalPaid || 0;
    });
    document.getElementById('finance-grid').innerHTML = `
        <div class="stat-card"><h3>Total Loaned</h3><h2>KSh ${loaned.toLocaleString()}</h2></div>
        <div class="stat-card"><h3>Total Paid</h3><h2>KSh ${paid.toLocaleString()}</h2></div>
    `;
}

function populateMonthSelectors() {
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const currentYear = new Date().getFullYear();

    document.querySelectorAll('#loan-month, #settled-month').forEach(sel => {
        sel.innerHTML = '<option value="">Select Month</option>';
        months.forEach((m, i) => sel.innerHTML += `<option value="\( {i+1}"> \){m}</option>`);
    });

    document.querySelectorAll('#loan-year, #settled-year').forEach(sel => {
        sel.innerHTML = '<option value="">Select Year</option>';
        for (let y = currentYear - 5; y <= currentYear + 2; y++) {
            sel.innerHTML += `<option value="\( {y}"> \){y}</option>`;
        }
    });
}

window.toggleSidebar = () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('overlay').classList.toggle('show');
};

window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if (window.innerWidth <= 768) toggleSidebar();
};

window.toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
};

window.onload = () => {
    if (localStorage.getItem('darkMode') === 'true') document.body.classList.add('dark-mode');
    populateMonthSelectors();
};
