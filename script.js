import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
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

let allClients = [];
let activeID = null;

// --- AUTHENTICATION ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        document.getElementById('user-display').innerText = user.email.split('@')[0].toUpperCase();
        loadData();
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
    }
});

// --- CORE DATA ENGINE ---
function loadData() {
    onValue(ref(db, 'jml_data'), (snap) => {
        const data = snap.val();
        allClients = [];
        if (data) {
            // Traverse folders to find clients, filtering out any 'undefined' entries
            Object.values(data).forEach(uFolder => {
                Object.values(uFolder).forEach(client => {
                    if (client && client.name && client.idNumber) {
                        allClients.push(client);
                    }
                });
            });
        }
        renderTables();
        calculateStats();
    });
}

function renderTables() {
    const activeBody = document.getElementById('clientTableBody');
    const settledBody = document.getElementById('settledTableBody');
    const today = new Date().toLocaleDateString('en-GB');

    const activeList = allClients.filter(c => Number(c.balance) > 0);
    const settledList = allClients.filter(c => Number(c.balance) <= 0);

    // Render Active
    activeBody.innerHTML = activeList.map((c, i) => {
        const paid = (c.history || []).some(h => h.date === today && h.activity === 'Payment');
        return `<tr>
            <td>${i+1}</td>
            <td><b style="color:var(--accent)">${c.name}</b></td>
            <td>${c.idNumber}</td>
            <td>KSh ${Number(c.balance).toLocaleString()}</td>
            <td><span class="status-pill ${paid ? 'paid' : 'pending'}">${paid ? 'Updated' : 'Pending'}</span></td>
            <td><button onclick="openDashboard('${c.idNumber}')" class="btn-table">Manage</button></td>
        </tr>`;
    }).join('');

    // Render Settled
    settledBody.innerHTML = settledList.map(c => `
        <tr>
            <td>${c.name}</td>
            <td>${c.idNumber}</td>
            <td>KSh ${Number(c.principal).toLocaleString()}</td>
            <td>${c.clearedDate || 'Prior Record'}</td>
            <td><span class="status-pill paid">SETTLED</span></td>
        </tr>
    `).join('');
}

// --- DASHBOARD ACTIONS ---
window.openDashboard = (id) => {
    const c = allClients.find(x => x.idNumber === id);
    if (!c) return;
    activeID = id;

    document.getElementById('d-name').innerText = c.name;
    document.getElementById('d-id-sub').innerText = `ID: ${c.idNumber}`;
    document.getElementById('d-phone').innerText = "Phone: " + c.phone;
    document.getElementById('d-loc-val').innerText = "Location: " + (c.location || 'N/A');
    document.getElementById('d-princ').innerText = Number(c.principal).toLocaleString();
    document.getElementById('ed-balance').value = c.balance;

    const hBody = document.getElementById('historyBody');
    hBody.innerHTML = (c.history || []).map(h => `
        <tr><td>${h.date}</td><td>${h.activity}</td><td>KSh ${h.amt}</td><td>${h.by}</td></tr>
    `).reverse().join('');

    document.getElementById('detailWindow').classList.remove('hidden');
};

window.processUpdate = async () => {
    const amt = parseFloat(document.getElementById('payAmt').value);
    const time = document.getElementById('payTime').value;
    if (!amt || !time) return alert("Enter Amount and Time");

    const c = allClients.find(x => x.idNumber === activeID);
    c.balance -= amt;
    if(!c.history) c.history = [];
    c.history.push({
        date: new Date().toLocaleDateString('en-GB'),
        activity: 'Payment',
        amt: amt,
        time: time,
        by: auth.currentUser.email.split('@')[0]
    });

    await set(ref(db, `jml_data/${auth.currentUser.uid}/${activeID}`), c);
    document.getElementById('payAmt').value = "";
    openDashboard(activeID);
};

window.settleOnly = async () => {
    if(!confirm("Move to Settled Archive? Current balance will be cleared.")) return;
    const c = allClients.find(x => x.idNumber === activeID);
    c.balance = 0;
    c.clearedDate = new Date().toLocaleDateString('en-GB');
    await set(ref(db, `jml_data/${auth.currentUser.uid}/${activeID}`), c);
    closeDetails();
};

// --- CLIENT REGISTRATION ---
document.getElementById('clientForm').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('f-id').value;
    const princ = parseFloat(document.getElementById('f-loan').value);
    
    const newClient = {
        name: document.getElementById('f-name').value,
        idNumber: id,
        phone: document.getElementById('f-phone').value,
        location: document.getElementById('f-loc').value,
        principal: princ,
        balance: princ * 1.25, // Auto-apply 25% interest
        history: [{
            date: new Date().toLocaleDateString('en-GB'),
            activity: 'Loan Issued',
            amt: princ,
            by: auth.currentUser.email.split('@')[0]
        }]
    };

    await set(ref(db, `jml_data/${auth.currentUser.uid}/${id}`), newClient);
    alert("Client Registered Successfully!");
    e.target.reset();
    showSection('list-sec', document.querySelector('.nav-item'));
};

// --- UI UTILITIES ---
window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('minimized');

window.showSection = (id, el) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if(el) el.classList.add('active');
    if(window.innerWidth < 768) document.getElementById('sidebar').classList.add('minimized');
};

window.handleLogin = () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, e, p).catch(err => alert(err.message));
};

window.handleLogout = () => signOut(auth);
window.closeDetails = () => document.getElementById('detailWindow').classList.add('hidden');
window.toggleTheme = () => document.body.classList.toggle('dark-mode');

function calculateStats() {
    let out = 0, today = 0;
    const d = new Date().toLocaleDateString('en-GB');
    allClients.forEach(c => {
        out += Number(c.balance);
        (c.history || []).forEach(h => { if(h.date === d && h.activity === 'Payment') today += Number(h.amt); });
    });
    document.getElementById('fin-out').innerText = "KSh " + out.toLocaleString();
    document.getElementById('fin-today').innerText = "KSh " + today.toLocaleString();
    document.getElementById('top-today-val').innerText = "Paid Today: KSh " + today.toLocaleString();
}
