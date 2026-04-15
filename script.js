import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, onValue, update, get } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAEMpC9oczMDYybbkZirDkY9a25d8ZqjJw",
  authDomain: "jml-loans-560d8.firebaseapp.com",
  projectId: "jml-loans-560d8",
  databaseURL: "https://jml-loans-560d8-default-rtdb.europe-west1.firebasedatabase.app", 
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

let clients = [];
let currentUser = null;
let currentIndex = null;
let isAdmin = false;

// --- AUTH & DATA SEPARATION ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const staffRef = ref(db, `jml_users/${user.uid}`);
        const snap = await get(staffRef);
        let userData = snap.val();
        
        if (!userData) {
            userData = { email: user.email, role: 'staff', disabled: false };
            await set(staffRef, userData);
        }

        if (userData.disabled) {
            alert("Account access denied.");
            handleLogout();
            return;
        }

        currentUser = user;
        isAdmin = userData.role === 'admin';
        document.getElementById('user-display').innerText = user.email;
        document.getElementById('login-overlay').classList.add('hidden');
        if (isAdmin) document.getElementById('admin-nav').classList.remove('hidden');
        loadData();
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
    }
});

// Load data based on role
function loadData() {
    // If Admin: show all. If Staff: show only their path
    const dataPath = isAdmin ? 'jml_data/' : `jml_data/${currentUser.uid}`;
    
    onValue(ref(db, dataPath), (snap) => {
        const raw = snap.val() || {};
        if (isAdmin) {
            // Admin aggregates all employee records
            clients = [];
            for (let userId in raw) {
                const userClients = Object.values(raw[userId]);
                clients.push(...userClients);
            }
        } else {
            clients = Object.values(raw);
        }
        renderTable();
        updateFinancials();
        renderLoansGiven();
    });
}

// --- UTILITIES ---
window.togglePassVisibility = (id, icon) => {
    const el = document.getElementById(id);
    if (el.type === "password") {
        el.type = "text";
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        el.type = "password";
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
};

function getWeekOfMonth(date) {
    const d = new Date(date);
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
    return Math.ceil((d.getDate() + firstDay) / 7);
}

// --- CORE FUNCTIONS ---
window.processPayment = () => {
    const amt = parseFloat(document.getElementById('payAmt').value);
    const time = document.getElementById('payTime').value;
    if (isNaN(amt) || currentIndex === null) return;

    const client = clients[currentIndex];
    client.balance -= amt;
    client.totalPaid = (client.totalPaid || 0) + amt;
    
    if (!client.history) client.history = [];
    client.history.push({
        date: new Date().toLocaleDateString('en-GB'),
        time: time,
        amt: amt,
        by: currentUser.email.split('@')[0]
    });

    saveClientData(client);
    document.getElementById('payAmt').value = "";
    openDashboard(currentIndex); // Refresh view
};

function saveClientData(client) {
    // We save to the specific user's folder
    const userId = isAdmin ? client.ownerId : currentUser.uid;
    const clientRef = ref(db, `jml_data/${userId}/${client.idNumber}`);
    set(clientRef, client);
}

window.openDashboard = (i) => {
    currentIndex = i;
    const c = clients[i];
    document.getElementById('d-name').innerText = c.name;
    document.getElementById('d-id').innerText = c.idNumber;
    document.getElementById('d-phone').innerText = c.phone;
    document.getElementById('d-loc').innerText = c.location || "---";
    document.getElementById('d-occ').innerText = c.occupation || "---";
    document.getElementById('d-ref').innerText = c.referral || "---";
    
    document.getElementById('ed-start').value = c.startDate || "";
    document.getElementById('ed-end').value = c.endDate || "";
    
    document.getElementById('d-principal').innerText = `KSh ${c.principal.toLocaleString()}`;
    document.getElementById('d-interest').innerText = `KSh ${(c.principal * 0.25).toLocaleString()}`;
    document.getElementById('d-balance').innerText = `KSh ${c.balance.toLocaleString()}`;
    document.getElementById('d-notes').value = c.notes || "";

    document.getElementById('historyBody').innerHTML = (c.history || []).map(h => `
        <tr>
            <td>${h.date}</td>
            <td style="${h.time > '18:00' ? 'color:red; font-weight:bold' : ''}">${h.time}</td>
            <td>${h.amt}</td>
            <td>${h.by}</td>
        </tr>
    `).join('');
    document.getElementById('detailWindow').classList.remove('hidden');
};

// --- SIDEBAR WEEKLY GROUPING ---
function renderLoansGiven() {
    const container = document.getElementById('givenAccordion');
    container.innerHTML = "";
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    let structure = {};
    clients.forEach(c => {
        if (!c.startDate) return;
        const d = new Date(c.startDate);
        const m = months[d.getMonth()];
        const w = `Week ${getWeekOfMonth(d)}`;
        
        if (!structure[m]) structure[m] = {};
        if (!structure[m][w]) structure[m][w] = [];
        structure[m][w].push(c);
    });

    for (let m in structure) {
        let mHtml = `<details class="month-det"><summary>${m}</summary>`;
        for (let w in structure[m]) {
            mHtml += `<details class="week-det"><summary>${w}</summary><ul>`;
            structure[m][w].forEach(c => {
                mHtml += `<li>${c.name} - KSh ${c.principal}</li>`;
            });
            mHtml += `</ul></details>`;
        }
        mHtml += `</details>`;
        container.innerHTML += mHtml;
    }
}

// Enrollment
document.getElementById('clientForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const principal = parseFloat(document.getElementById('f-loan').value);
    const newClient = {
        name: document.getElementById('f-name').value,
        idNumber: document.getElementById('f-id').value,
        phone: document.getElementById('f-phone').value,
        location: document.getElementById('f-location').value,
        occupation: document.getElementById('f-occupation').value,
        referral: document.getElementById('f-ref').value,
        principal: principal,
        balance: principal * 1.25,
        startDate: document.getElementById('f-start').value || null,
        endDate: document.getElementById('f-end').value || null,
        ownerId: currentUser.uid,
        history: [],
        notes: ""
    };
    saveClientData(newClient);
    e.target.reset();
    showSection('list-sec');
});

// Global Boilerplate
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

