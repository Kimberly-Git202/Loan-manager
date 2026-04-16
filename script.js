import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.app";
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

// --- AUTH ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        loadData();
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
    }
});

// --- DATA ---
function loadData() {
    onValue(ref(db, 'jml_data'), (snap) => {
        const data = snap.val();
        allClients = [];
        if (data) {
            Object.values(data).forEach(u => {
                Object.values(u).forEach(c => {
                    if (c && c.name && c.idNumber) allClients.push(c);
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

    // Filter Logic
    const active = allClients.filter(c => Number(c.balance) > 0);
    const settled = allClients.filter(c => Number(c.balance) <= 0);

    activeBody.innerHTML = active.map((c, i) => {
        const paid = (c.history || []).some(h => h.date === today && h.activity === 'Payment');
        return `<tr><td>${i+1}</td><td><b>${c.name}</b></td><td>${c.idNumber}</td><td>KSh ${Number(c.balance).toLocaleString()}</td><td>${paid ? '✅ Updated' : '❌ Pending'}</td><td><button onclick="openDashboard('${c.idNumber}')" class="btn-save" style="padding:5px 10px; font-size:12px">View</button></td></tr>`;
    }).join('');

    settledBody.innerHTML = settled.map(c => `<tr><td>${c.name}</td><td>${c.idNumber}</td><td>KSh ${c.principal}</td><td>${c.clearedDate || 'N/A'}</td></tr>`).join('');
}

// --- DASHBOARD & ACTIONS ---
window.openDashboard = (id) => {
    const c = allClients.find(x => x.idNumber === id);
    if (!c) return;
    activeID = id;

    document.getElementById('d-name').innerText = c.name;
    document.getElementById('d-id-sub').innerText = `ID: ${c.idNumber}`;
    document.getElementById('d-phone').innerText = "Phone: " + c.phone;
    document.getElementById('d-loc').innerText = "Loc: " + (c.location || 'N/A');
    document.getElementById('d-princ').innerText = Number(c.principal).toLocaleString();
    document.getElementById('ed-balance').value = c.balance;

    const hBody = document.getElementById('historyBody');
    hBody.innerHTML = (c.history || []).map(h => `<tr><td>${h.date}</td><td>${h.activity}</td><td>KSh ${h.amt}</td><td>${h.by}</td></tr>`).reverse().join('');

    document.getElementById('detailWindow').classList.remove('hidden');
};

window.processUpdate = async () => {
    const amt = parseFloat(document.getElementById('payAmt').value);
    const time = document.getElementById('payTime').value;
    if (!amt || !time) return alert("Enter amount and time!");

    const c = allClients.find(x => x.idNumber === activeID);
    c.balance -= amt;
    if(!c.history) c.history = [];
    c.history.push({ date: new Date().toLocaleDateString('en-GB'), activity: 'Payment', amt, time, by: auth.currentUser.email.split('@')[0] });

    await set(ref(db, `jml_data/${auth.currentUser.uid}/${activeID}`), c);
    document.getElementById('payAmt').value = "";
    openDashboard(activeID);
};

window.settleOnly = async () => {
    if(!confirm("Set balance to 0 and Archive?")) return;
    const c = allClients.find(x => x.idNumber === activeID);
    c.balance = 0;
    c.clearedDate = new Date().toLocaleDateString('en-GB');
    await set(ref(db, `jml_data/${auth.currentUser.uid}/${activeID}`), c);
    closeDetails();
};

// --- CLIENT ENROLLMENT ---
document.getElementById('clientForm').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('f-id').value;
    const princ = parseFloat(document.getElementById('f-loan').value);
    const newClient = {
        name: document.getElementById('f-name').value, idNumber: id, phone: document.getElementById('f-phone').value,
        location: document.getElementById('f-loc').value, principal: princ, balance: princ * 1.25,
        history: [{ date: new Date().toLocaleDateString('en-GB'), activity: 'Loan Started', amt: princ, by: 'Admin' }]
    };
    await set(ref(db, `jml_data/${auth.currentUser.uid}/${id}`), newClient);
    alert("Profile Created!");
    e.target.reset();
    showSection('list-sec', document.querySelector('.nav-item'));
};

// --- UTILS ---
window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('minimized');
window.showSection = (id, el) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
};
window.closeDetails = () => document.getElementById('detailWindow').classList.add('hidden');
window.handleLogin = () => signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value).catch(err => alert(err.message));
window.handleLogout = () => signOut(auth);
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
