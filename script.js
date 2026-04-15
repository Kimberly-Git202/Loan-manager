import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, onValue, update, get } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAEMpC9oczMDYybbkZirDkY9a25d8ZqjJw",
    authDomain: "jml-loans-560d8.firebaseapp.com",
    projectId: "jml-loans-560d8",
    databaseURL: "https://jml-loans-560d8-default-rtdb.europe-west1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

let clients = [];
let currentUser = null;
let isAdmin = false;
let currentIndex = null;

// --- Authentication & Access Control ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userSnap = await get(ref(db, `jml_users/${user.uid}`));
        const userData = userSnap.val() || { role: 'staff', status: 'active' };

        if (userData.status === 'denied') {
            alert("Access Denied by Admin.");
            signOut(auth);
            return;
        }

        currentUser = user;
        isAdmin = userData.role === 'admin';
        document.getElementById('login-overlay').classList.add('hidden');
        if(isAdmin) document.getElementById('admin-settings').classList.remove('hidden');
        loadData();
        loadDebts();
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
    }
});

// --- Data Loading & Search ---
function loadData() {
    const path = isAdmin ? 'jml_data' : `jml_data/${currentUser.uid}`;
    onValue(ref(db, path), (snap) => {
        const data = snap.val() || {};
        clients = [];
        if (isAdmin) {
            Object.keys(data).forEach(uId => {
                Object.values(data[uId]).forEach(c => clients.push(c));
            });
        } else {
            clients = Object.values(data);
        }
        renderTable(clients);
        renderSidebarGroups();
    });
}

// Search Logic
document.getElementById('globalSearch').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = clients.filter(c => 
        c.name.toLowerCase().includes(term) || c.idNumber.includes(term)
    );
    renderTable(filtered);
});

// --- UI Rendering ---
function renderTable(dataArray) {
    const tbody = document.getElementById('clientTableBody');
    const today = new Date().toLocaleDateString('en-GB');

    tbody.innerHTML = dataArray.map((c, i) => {
        // Highlighting Logic
        const lastPay = c.history && c.history.length > 0 ? c.history[c.history.length-1].date : null;
        const skipped = lastPay !== today ? 'style="background: #fff0f0; border-left: 5px solid red;"' : '';
        
        return `
            <tr ${skipped}>
                <td>${i + 1}</td>
                <td><strong>${c.name}</strong></td>
                <td>${c.idNumber}</td>
                <td>${c.totalPaid || 0}</td>
                <td>${c.balance}</td>
                <td>${lastPay === today ? '✅ Paid' : '❌ Skipped'}</td>
                <td><button class="view-btn" onclick="openDashboard('${c.idNumber}')">Open</button></td>
            </tr>
        `;
    }).join('');
}

// Fixed Open Function
window.openDashboard = (idNo) => {
    const c = clients.find(cl => cl.idNumber === idNo);
    if(!c) return;
    currentIndex = clients.indexOf(c);
    
    document.getElementById('d-name').innerText = c.name;
    document.getElementById('d-id').innerText = c.idNumber;
    document.getElementById('d-phone').innerText = c.phone;
    document.getElementById('d-occ').innerText = c.occupation;
    document.getElementById('ed-start').value = c.startDate || "";
    document.getElementById('ed-end').value = c.endDate || "";
    document.getElementById('ed-princ').value = c.principal;
    document.getElementById('d-balance').innerText = `KSh ${c.balance}`;
    
    document.getElementById('historyBody').innerHTML = (c.history || []).map(h => `
        <tr><td>${h.date}</td><td>KSh ${h.amt}</td><td>${h.by}</td></tr>
    `).join('');
    
    document.getElementById('detailWindow').classList.remove('hidden');
};

// Edit Specific Field (Errors Fix)
window.updateClientField = async (field, value) => {
    const c = clients[currentIndex];
    c[field] = value;
    if(field === 'principal') c.balance = parseFloat(value) * 1.25;
    await set(ref(db, `jml_data/${c.ownerId}/${c.idNumber}`), c);
};

// --- Debt Logic ---
function loadDebts() {
    onValue(ref(db, 'jml_debts'), (snap) => {
        const debts = snap.val() || {};
        document.getElementById('debtTableBody').innerHTML = Object.entries(debts).map(([id, d]) => `
            <tr>
                <td>${d.name}</td>
                <td>KSh ${d.amt}</td>
                <td>${d.reason}</td>
                <td><button onclick="clearDebt('${id}')">Clear</button></td>
            </tr>
        `).join('');
    });
}

window.addDebtRow = async () => {
    const name = prompt("Client Name:");
    const amt = prompt("Debt Amount:");
    if(name && amt) {
        const id = Date.now();
        await set(ref(db, `jml_debts/${id}`), {name, amt, reason: "Outstanding", date: new Date().toISOString()});
    }
};

window.clearDebt = (id) => remove(ref(db, `jml_debts/${id}`));

// --- Admin Controls ---
window.adminResetPassword = () => {
    const email = document.getElementById('reset-email').value;
    sendPasswordResetEmail(auth, email).then(() => alert("Reset link sent!")).catch(e => alert(e.message));
};

// --- Utilities ---
window.handleLogin = () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, e, p).catch(err => alert(err.message));
};
window.handleLogout = () => signOut(auth);
window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('minimized');
window.closeDetails = () => document.getElementById('detailWindow').classList.add('hidden');
window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
};
window.togglePass = (id, icon) => {
    const el = document.getElementById(id);
    el.type = el.type === "password" ? "text" : "password";
    icon.classList.toggle('fa-eye-slash');
};
window.toggleTheme = () => document.body.classList.toggle('dark-mode');




