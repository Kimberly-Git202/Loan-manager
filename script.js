import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, onValue, update, get, remove } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
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

let allClients = [];
let activeClientID = null;
let isAdmin = false;

// --- Auth Check ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const snap = await get(ref(db, `jml_users/${user.uid}`));
        const uData = snap.val() || { role: 'staff' };
        isAdmin = uData.role === 'admin';
        
        document.getElementById('user-role-display').innerText = isAdmin ? "Administrator" : "Staff Member";
        document.getElementById('login-overlay').classList.add('hidden');
        if(isAdmin) document.getElementById('admin-controls').classList.remove('hidden');
        
        loadData();
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
    }
});

// --- Data Loading ---
function loadData() {
    onValue(ref(db, 'jml_data'), (snap) => {
        const data = snap.val() || {};
        allClients = [];
        Object.keys(data).forEach(uid => {
            Object.values(data[uid]).forEach(c => {
                // If admin, add all. If staff, only add if ownerId matches.
                if(isAdmin || c.ownerId === auth.currentUser.uid) {
                    allClients.push(c);
                }
            });
        });
        renderTable(allClients);
    });
}

// --- Table Rendering ---
function renderTable(list) {
    const tbody = document.getElementById('clientTableBody');
    const today = new Date().toLocaleDateString('en-GB');
    
    tbody.innerHTML = list.map((c, i) => {
        const lastPay = (c.history && c.history.length > 0) ? c.history[c.history.length-1].date : 'Never';
        const isSkipped = lastPay !== today;
        const rowStyle = isSkipped ? 'style="background: #fff5f5; border-left: 4px solid #ef4444;"' : '';

        return `
            <tr ${rowStyle}>
                <td>${i+1}</td>
                <td><strong>${c.name}</strong></td>
                <td>${c.idNumber}</td>
                <td>${c.totalPaid || 0}</td>
                <td>${c.balance}</td>
                <td>${isSkipped ? '❌ Skipped' : '✅ Paid'}</td>
                <td><button class="view-btn" onclick="openDashboard('${c.idNumber}')">Open</button></td>
            </tr>
        `;
    }).join('');
}

// --- Dashboard Logic (Fixed) ---
window.openDashboard = (id) => {
    activeClientID = id;
    const c = allClients.find(x => x.idNumber === id);
    if(!c) return;

    document.getElementById('d-name').innerText = c.name;
    document.getElementById('d-id').innerText = c.idNumber;
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

window.processPayment = async () => {
    const amt = parseFloat(document.getElementById('payAmt').value);
    const c = allClients.find(x => x.idNumber === activeClientID);
    if(!amt || !c) return;

    c.balance -= amt;
    c.totalPaid = (c.totalPaid || 0) + amt;
    if(!c.history) c.history = [];
    c.history.push({
        date: new Date().toLocaleDateString('en-GB'),
        amt: amt,
        by: auth.currentUser.email.split('@')[0]
    });

    await set(ref(db, `jml_data/${c.ownerId}/${c.idNumber}`), c);
    document.getElementById('payAmt').value = "";
    openDashboard(activeClientID); // Refresh view
};

window.saveEdits = async () => {
    const c = allClients.find(x => x.idNumber === activeClientID);
    c.startDate = document.getElementById('ed-start').value;
    c.endDate = document.getElementById('ed-end').value;
    c.principal = parseFloat(document.getElementById('ed-princ').value);
    c.balance = c.principal * 1.25 - (c.totalPaid || 0); // Recalculate based on edit
    
    await set(ref(db, `jml_data/${c.ownerId}/${c.idNumber}`), c);
    alert("Saved successfully!");
    openDashboard(activeClientID);
};

window.settleAndReset = async () => {
    const c = allClients.find(x => x.idNumber === activeClientID);
    if(!confirm("Settle and re-loan?")) return;

    // Archive
    await set(ref(db, `jml_settled/${c.ownerId}/${c.idNumber}_${Date.now()}`), {...c, settled: true});

    // Reset
    c.principal = parseFloat(prompt("New Principal:", c.principal)) || c.principal;
    c.balance = c.principal * 1.25;
    c.totalPaid = 0;
    c.history = [];
    c.startDate = "";
    c.endDate = "";

    await set(ref(db, `jml_data/${c.ownerId}/${c.idNumber}`), c);
    closeDetails();
};

// --- Search Bar ---
document.getElementById('globalSearch').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allClients.filter(c => 
        c.name.toLowerCase().includes(term) || c.idNumber.includes(term)
    );
    renderTable(filtered);
});

// --- Settings Fix ---
window.adminResetPassword = () => {
    const email = document.getElementById('reset-email').value;
    sendPasswordResetEmail(auth, email).then(() => alert("Reset email sent!")).catch(e => alert(e.message));
};

// --- Boilerplate ---
window.handleLogin = () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, e, p).catch(err => alert("Login Failed: " + err.message));
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




