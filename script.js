import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

// ================= FIREBASE CONFIG =================
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

// ================= STATE =================
let clients = [];
let currentIndex = null;
let currentUserEmail = "";

// ================= AUTH =================
onAuthStateChanged(auth, (user) => {
    const login = document.getElementById('login-overlay');

    if (user) {
        if (login) login.classList.add('hidden');
        currentUserEmail = user.email || "User";
        loadData();
    } else {
        if (login) login.classList.remove('hidden');
    }
});

window.handleLogin = () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    signInWithEmailAndPassword(auth, email, password)
        .catch(() => alert("Invalid Credentials"));
};

window.handleLogout = () => signOut(auth);

// ================= DATA =================
function loadData() {
    try {
        onValue(ref(db, 'jml_data/'), (snap) => {
            const data = snap.val();

            clients = data
                ? Object.entries(data).map(([id, value]) => ({ id, ...value }))
                : [];

            renderTable();
            updateFinancials();
            populateMonthSelectors();
            renderDebts();
        });
    } catch (err) {
        console.error("Firebase error:", err);
        clients = [];
        renderTable();
    }
}

function saveData() {
    const obj = {};
    clients.forEach((c) => {
        const id = c.id || Date.now().toString();
        c.id = id;
        obj[id] = c;
    });

    set(ref(db, 'jml_data/'), obj);
}

// ================= CLIENT TABLE =================
window.renderTable = () => {
    const tbody = document.getElementById('clientTableBody');
    if (!tbody) return;

    tbody.innerHTML = clients.map((c, i) => {
        const totalDue = (c.loan || 0) * 1.25;
        const balance = totalDue - (c.totalPaid || 0);

        return `
<tr>
    <td>${i + 1}</td>
    <td><strong>${c.name || ''}</strong></td>
    <td>${c.idNumber || ''}</td>
    <td>${c.phone || ''}</td>
    <td>KSh ${(c.loan || 0).toLocaleString()}</td>
    <td>KSh ${(c.totalPaid || 0).toLocaleString()}</td>
    <td style="color:${balance > 0 ? 'red' : 'green'}; font-weight:bold">
        KSh ${balance.toLocaleString()}
    </td>
    <td>
        <button class="view-btn" onclick="openDashboard('${c.id}')">View</button>
    </td>
</tr>
`;
    }).join('');
};

// ================= SEARCH =================
window.searchClients = () => {
    const term = document.getElementById('globalSearch')?.value.toLowerCase() || "";
    const rows = document.querySelectorAll('#clientTableBody tr');

    rows.forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(term) ? "" : "none";
    });
};

// ================= DASHBOARD =================
window.openDashboard = (id) => {
    const i = clients.findIndex(c => c.id === id);
    const c = clients[i];
    if (!c) return alert("Client not found");

    currentIndex = i;

    const totalDue = (c.loan || 0) * 1.25;
    const balance = totalDue - (c.totalPaid || 0);

    // safe assignments
    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    };

    set('d-name', c.name || '');
    set('d-phone', c.phone || '');
    set('d-location', c.location || '');
    set('d-occupation', c.occupation || '');
    set('d-referral', c.referral || '');
    set('d-start', c.startDate || '');
    set('d-end', c.endDate || '');

    set('d-principal', `KSh ${(c.loan || 0).toLocaleString()}`);
    set('d-total', `KSh ${totalDue.toLocaleString()}`);
    set('d-balance', `KSh ${balance.toLocaleString()}`);
    set('d-paid', `KSh ${(c.totalPaid || 0).toLocaleString()}`);

    const modal = document.getElementById('detailWindow');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = "flex";
    }

    const historyBody = document.getElementById('historyBody');
    if (historyBody) {
        historyBody.innerHTML = (c.history || []).slice().reverse().map(h => `
            <tr>
                <td>${h.date}</td>
                <td>${h.time || ''}</td>
                <td>${h.det || h.act}</td>
                <td>${h.by || ''}</td>
            </tr>
        `).join('');
    }
};

// ================= PAYMENT =================
window.processPayment = () => {
    const amt = parseFloat(document.getElementById('payAmt')?.value);
    const time = document.getElementById('payTime')?.value;

    if (!amt || !time) return alert("Enter amount and time");

    const c = clients[currentIndex];
    if (!c) return;

    c.totalPaid = (c.totalPaid || 0) + amt;

    c.history = c.history || [];
    c.history.push({
        date: new Date().toLocaleDateString('en-GB'),
        time,
        act: "Payment",
        det: `Payment KSh ${amt}`,
        by: currentUserEmail.split('@')[0]
    });

    saveData();
    alert("Payment recorded");
    openDashboard(c.id);
};

// ================= SETTLE =================
window.settleAndReset = () => {
    if (!confirm("Settle loan?")) return;

    const c = clients[currentIndex];
    if (!c) return;

    c.balance = 0;

    c.history.push({
        date: new Date().toLocaleDateString('en-GB'),
        time: new Date().toLocaleTimeString(),
        act: "Settlement",
        det: "Loan Settled",
        by: "System"
    });

    saveData();
    alert("Loan settled");
    openDashboard(c.id);
};

// ================= CLIENT CRUD =================
window.deleteClient = () => {
    if (!confirm("Delete client?")) return;

    clients.splice(currentIndex, 1);
    saveData();
    closeDetails();
};

window.closeDetails = () => {
    const modal = document.getElementById('detailWindow');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = "none";
    }
};

// ================= ENROLL =================
document.getElementById('clientForm')?.addEventListener('submit', (e) => {
    e.preventDefault();

    const loan = parseFloat(document.getElementById('f-loan').value) || 0;

    const newClient = {
        id: Date.now().toString(),
        name: document.getElementById('f-name').value,
        idNumber: document.getElementById('f-idNumber').value,
        phone: document.getElementById('f-phone').value,
        location: document.getElementById('f-location').value,
        occupation: document.getElementById('f-occupation').value,
        referral: document.getElementById('f-referral').value,
        loan,
        totalPaid: 0,
        balance: loan * 1.25,
        startDate: document.getElementById('f-start').value,
        endDate: document.getElementById('f-end').value,
        history: [{
            date: new Date().toLocaleDateString('en-GB'),
            time: new Date().toLocaleTimeString(),
            act: "New Loan",
            det: "Account Created",
            by: currentUserEmail.split('@')[0]
        }]
    };

    clients.unshift(newClient);
    saveData();
    renderTable();

    alert("Client added");
    e.target.reset();
});

// ================= FINANCIALS =================
function updateFinancials() {
    let loaned = 0;
    let paid = 0;

    clients.forEach(c => {
        loaned += c.loan || 0;
        paid += c.totalPaid || 0;
    });

    const profit = paid * 0.25;
    const loss = (loaned * 1.25) - paid;

    const grid = document.getElementById('finance-grid');
    if (!grid) return;

    grid.innerHTML = `
        <div class="stat-card"><h3>Loaned</h3><h2>KSh ${loaned.toLocaleString()}</h2></div>
        <div class="stat-card"><h3>Paid</h3><h2>KSh ${paid.toLocaleString()}</h2></div>
        <div class="stat-card"><h3>Profit</h3><h2>KSh ${profit.toLocaleString()}</h2></div>
        <div class="stat-card"><h3>Loss</h3><h2>KSh ${loss.toLocaleString()}</h2></div>
    `;
}

// ================= DEBTS =================
function renderDebts() {
    const tbody = document.getElementById('debts-body');
    if (!tbody) return;

    tbody.innerHTML = clients
        .filter(c => (c.balance || 0) > 0)
        .map(c => `
<tr>
    <td>${c.name}</td>
    <td>${c.idNumber}</td>
    <td>KSh ${c.loan}</td>
    <td>${c.details || 'Pending'}</td>
    <td>KSh ${c.balance}</td>
    <td><button onclick="alert('Clear debt feature pending')" class="btn-save">Clear</button></td>
</tr>
`).join('');
}

// ================= SIDEBAR =================
window.toggleSidebar = () => {
    document.getElementById('sidebar')?.classList.toggle('open');
    document.getElementById('overlay')?.classList.toggle('show');
};

const overlay = document.getElementById('overlay');
if (overlay) {
    overlay.addEventListener('click', () => toggleSidebar());
}

// ================= SECTION SWITCH =================
window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id)?.classList.remove('hidden');

    if (window.innerWidth < 768) {
        document.getElementById('sidebar')?.classList.remove('open');
    }
};

// ================= INIT =================
console.log("JML System Loaded Clean Version");
