import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, onValue, update, get, remove } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
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

let allClients = [];
let activeID = null;

// THEME TOGGLE
window.toggleTheme = () => {
    document.body.classList.toggle('dark-mode');
    document.body.classList.toggle('light-mode');
};

// DATA LOADING
function loadData() {
    onValue(ref(db, 'jml_data'), (snap) => {
        const data = snap.val() || {};
        allClients = [];
        Object.keys(data).forEach(uid => {
            Object.values(data[uid]).forEach(c => allClients.push(c));
        });
        renderTable(allClients);
        updateStats();
    });
}

// RENDER TABLE WITH PROFESSIONAL LOOK
function renderTable(list) {
    const tbody = document.getElementById('clientTableBody');
    tbody.innerHTML = list.map((c, i) => `
        <tr>
            <td>${i + 1}</td>
            <td class="name-cell" onclick="openDashboard('${c.idNumber}')">${c.name}</td>
            <td>${c.phone}</td>
            <td>KSh ${c.balance.toLocaleString()}</td>
            <td><button class="btn-view" onclick="openDashboard('${c.idNumber}')">View</button></td>
        </tr>
    `).join('');
}

// OPEN DASHBOARD (Fills every enrollment detail)
window.openDashboard = (id) => {
    activeID = id;
    const c = allClients.find(x => x.idNumber === id);
    if(!c) return;

    document.getElementById('d-name').innerText = c.name;
    document.getElementById('d-id').innerText = c.idNumber;
    document.getElementById('d-phone').innerText = c.phone;
    document.getElementById('d-occ').innerText = c.occupation || "N/A";
    document.getElementById('d-loc').innerText = c.location || "N/A";
    document.getElementById('d-ref').innerText = c.referral || "N/A";
    document.getElementById('d-princ-display').innerText = `KSh ${c.principal}`;
    document.getElementById('ed-balance').value = c.balance;

    // History with TIME
    document.getElementById('historyBody').innerHTML = (c.history || []).reverse().map(h => `
        <tr>
            <td>${h.date}</td>
            <td>${h.type || 'Payment'}</td>
            <td class="${h.amt < 0 ? 'text-red' : 'text-green'}">
                ${h.amt > 0 ? 'Paid KSh ' + h.amt : h.note}
            </td>
            <td>${h.by}</td>
        </tr>
    `).join('');

    document.getElementById('detailWindow').classList.remove('hidden');
};

// DELETE CLIENT
window.deleteClient = async () => {
    if(!confirm("Are you sure? This will permanently delete this client profile.")) return;
    const c = allClients.find(x => x.idNumber === activeID);
    await remove(ref(db, `jml_data/${c.ownerId}/${c.idNumber}`));
    closeDetails();
};

// PROCESS PAYMENT WITH TIME
window.processPayment = async () => {
    const amt = parseFloat(document.getElementById('payAmt').value);
    const c = allClients.find(x => x.idNumber === activeID);
    if(!amt || !c) return;

    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
    
    c.balance -= amt;
    if(!c.history) c.history = [];
    c.history.push({
        date: now.toLocaleDateString('en-GB'),
        time: timeStr,
        amt: amt,
        type: 'Payment',
        by: 'Admin'
    });

    await set(ref(db, `jml_data/${c.ownerId}/${c.idNumber}`), c);
    document.getElementById('payAmt').value = "";
    openDashboard(activeID);
};

// Sidebar Toggle
window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('minimized');
window.closeDetails = () => document.getElementById('detailWindow').classList.add('hidden');




