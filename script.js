import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, onValue, update, get, remove } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

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
let currentIndex = null;
let isAdmin = false;

// --- Theme and App Initialization ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const userRef = ref(db, `jml_users/${user.uid}`);
        const snap = await get(userRef);
        const userData = snap.val() || { role: 'staff' };
        isAdmin = userData.role === 'admin';
        
        document.getElementById('login-overlay').classList.add('hidden');
        if (isAdmin) document.getElementById('admin-nav').classList.remove('hidden');
        loadData();
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
    }
});

// Load data with Data Isolation
function loadData() {
    const path = isAdmin ? 'jml_data' : `jml_data/${currentUser.uid}`;
    onValue(ref(db, path), (snap) => {
        const raw = snap.val() || {};
        clients = [];
        if (isAdmin) {
            Object.keys(raw).forEach(uid => {
                Object.values(raw[uid]).forEach(c => clients.push(c));
            });
        } else {
            clients = Object.values(raw);
        }
        renderTable();
        renderSidebar();
        updateFinancials();
    });
}

// --- Dashboard Logic ---
window.processPayment = async () => {
    const amt = parseFloat(document.getElementById('payAmt').value);
    if (isNaN(amt) || currentIndex === null) return;

    const c = clients[currentIndex];
    c.balance -= amt;
    c.totalPaid = (c.totalPaid || 0) + amt;
    if(!c.history) c.history = [];
    c.history.push({
        date: new Date().toLocaleDateString('en-GB'),
        amt: amt,
        by: currentUser.email.split('@')[0]
    });

    await set(ref(db, `jml_data/${c.ownerId}/${c.idNumber}`), c);
    document.getElementById('payAmt').value = "";
    openDashboard(currentIndex);
};

window.settleAndReset = async () => {
    const c = clients[currentIndex];
    if(!confirm("Settle this loan? Old details will be archived and account will reset.")) return;

    // Archive current loan state
    await set(ref(db, `jml_settled/${c.ownerId}/${c.idNumber}_${Date.now()}`), {...c, settled: true});

    // Reset client for New Loan
    const newPrincipal = parseFloat(prompt("Enter New Loan Principal Amount:", c.principal)) || c.principal;
    c.principal = newPrincipal;
    c.balance = newPrincipal * 1.25;
    c.totalPaid = 0;
    c.history = [];
    c.startDate = ""; 
    c.endDate = "";

    await set(ref(db, `jml_data/${c.ownerId}/${c.idNumber}`), c);
    closeDetails();
};

window.updateDates = async () => {
    const c = clients[currentIndex];
    c.startDate = document.getElementById('ed-start').value;
    c.endDate = document.getElementById('ed-end').value;
    await set(ref(db, `jml_data/${c.ownerId}/${c.idNumber}`), c);
};

// --- Sidebar Groups (Months & Weeks) ---
function renderSidebar() {
    const container = document.getElementById('givenAccordion');
    container.innerHTML = "";
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    let groups = {};
    clients.forEach(c => {
        if (!c.startDate) return;
        const d = new Date(c.startDate);
        const m = monthNames[d.getMonth()];
        const w = `Week ${Math.ceil(d.getDate() / 7)}`;
        if(!groups[m]) groups[m] = {};
        if(!groups[m][w]) groups[m][w] = [];
        groups[m][w].push(c);
    });

    for (let m in groups) {
        let mHtml = `<details><summary>${m}</summary>`;
        for (let w in groups[m]) {
            mHtml += `<details style="margin-left:20px;"><summary>${w}</summary><ul>`;
            groups[m][w].forEach(c => mHtml += `<li>${c.name} (ID: ${c.idNumber})</li>`);
            mHtml += `</ul></details>`;
        }
        container.innerHTML += mHtml + `</details>`;
    }
}

// --- Boilerplate & UI Helpers ---
window.toggleTheme = () => {
    document.body.classList.toggle('dark-mode');
    document.body.classList.toggle('light-mode');
};

window.togglePass = (id, icon) => {
    const el = document.getElementById(id);
    el.type = el.type === "password" ? "text" : "password";
    icon.classList.toggle('fa-eye-slash');
};

window.handleLogin = () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, email, pass).catch(err => alert(err.message));
};

window.handleLogout = () => signOut(auth);
window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('minimized');
window.closeDetails = () => document.getElementById('detailWindow').classList.add('hidden');
window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
};

document.getElementById('clientForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('f-id').value;
    const princ = parseFloat(document.getElementById('f-loan').value);
    const client = {
        name: document.getElementById('f-name').value,
        idNumber: id,
        phone: document.getElementById('f-phone').value,
        location: document.getElementById('f-loc').value,
        occupation: document.getElementById('f-occ').value,
        referral: document.getElementById('f-ref').value,
        principal: princ,
        balance: princ * 1.25,
        startDate: document.getElementById('f-start').value || "",
        endDate: document.getElementById('f-end').value || "",
        ownerId: currentUser.uid,
        history: [],
        settled: false
    };
    await set(ref(db, `jml_data/${currentUser.uid}/${id}`), client);
    e.target.reset();
    showSection('list-sec');
});

window.renderTable = () => {
    const tbody = document.getElementById('clientTableBody');
    tbody.innerHTML = clients.map((c, i) => `
        <tr>
            <td><strong>${c.name}</strong></td>
            <td>${c.idNumber}</td>
            <td>${c.totalPaid || 0}</td>
            <td style="color:var(--accent)">${c.balance}</td>
            <td><button class="view-btn" onclick="openDashboard(${i})">Open</button></td>
        </tr>
    `).join('');
};

function openDashboard(i) {
    currentIndex = i;
    const c = clients[i];
    document.getElementById('d-name').innerText = c.name;
    document.getElementById('d-id').innerText = c.idNumber;
    document.getElementById('d-phone').innerText = c.phone || "---";
    document.getElementById('d-loc').innerText = c.location || "---";
    document.getElementById('d-occ').innerText = c.occupation || "---";
    document.getElementById('d-ref').innerText = c.referral || "---";
    document.getElementById('d-principal').innerText = c.principal;
    document.getElementById('d-balance').innerText = c.balance;
    document.getElementById('ed-start').value = c.startDate || "";
    document.getElementById('ed-end').value = c.endDate || "";
    document.getElementById('historyBody').innerHTML = (c.history || []).map(h => `
        <tr><td>${h.date}</td><td>KSh ${h.amt}</td><td>${h.by}</td></tr>
    `).join('');
    document.getElementById('detailWindow').classList.remove('hidden');
}

function updateFinancials() {
    let out = 0, coll = 0, recovered = 0;
    const today = new Date().toLocaleDateString('en-GB');
    clients.forEach(c => {
        out += (c.balance || 0);
        recovered += (c.totalPaid || 0);
        (c.history || []).forEach(h => {
            if(h.date === today) coll += (h.amt || 0);
        });
    });
    document.getElementById('total-out').innerText = `KSh ${out.toLocaleString()}`;
    document.getElementById('total-paid').innerText = `KSh ${recovered.toLocaleString()}`;
    document.getElementById('top-today').innerText = `KSh ${coll.toLocaleString()} Collected Today`;
}



