import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, onValue, get, remove } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
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
let isAdmin = false;

// 1. AUTHENTICATION (First step)
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('main-app').classList.remove('hidden');
        document.getElementById('user-email-display').innerText = user.email;
        const snap = await get(ref(db, `jml_users/${user.uid}`));
        isAdmin = (snap.val()?.role === 'admin');
        if(isAdmin) document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
        loadData();
    } else {
        document.getElementById('login-overlay').style.display = 'flex';
        document.getElementById('main-app').classList.add('hidden');
    }
});

// 2. LOAD & FINANCIALS
function loadData() {
    onValue(ref(db, 'jml_data'), (snap) => {
        const data = snap.val() || {};
        allClients = [];
        Object.keys(data).forEach(uid => {
            Object.values(data[uid]).forEach(c => allClients.push(c));
        });
        renderTable(allClients);
        calculateFinancials();
    });
}

// 3. RENDER TABLE WITH 6PM RULE
function renderTable(list) {
    const tbody = document.getElementById('clientTableBody');
    const now = new Date();
    const isLateTime = now.getHours() >= 18; // 6 PM
    const today = now.toLocaleDateString('en-GB');

    tbody.innerHTML = list.map((c, i) => {
        const hasPaidToday = (c.history || []).some(h => h.date === today && h.activity === 'Payment');
        const lateClass = (isLateTime && !hasPaidToday) ? 'late-row' : '';

        return `<tr class="${lateClass}">
            <td>${i+1}</td>
            <td><strong>${c.name}</strong></td>
            <td>${c.idNumber}</td>
            <td>KSh ${c.balance.toLocaleString()}</td>
            <td>${hasPaidToday ? '✅ Updated' : '❌ Pending'}</td>
            <td><button class="btn-save" onclick="openDashboard('${c.idNumber}')">View</button></td>
        </tr>`;
    }).join('');
}

// 4. POST UPDATE (Manual Time Entry)
window.processUpdate = async () => {
    const amt = parseFloat(document.getElementById('payAmt').value) || 0;
    const time = document.getElementById('payTime').value;
    const activity = document.getElementById('payActivity').value;
    const c = allClients.find(x => x.idNumber === activeID);

    if(!time) return alert("You MUST enter the time of transaction manually.");

    if(activity === 'Payment') c.balance -= amt;
    
    if(!c.history) c.history = [];
    c.history.push({
        date: new Date().toLocaleDateString('en-GB'),
        activity: activity,
        time: time,
        amt: amt,
        by: auth.currentUser.email.split('@')[0]
    });

    await set(ref(db, `jml_data/${c.ownerId}/${c.idNumber}`), c);
    document.getElementById('payAmt').value = "";
    openDashboard(activeID);
};

// 5. SETTLE & RE-LOAN (Separated)
window.settleOnly = async () => {
    const c = allClients.find(x => x.idNumber === activeID);
    if(!confirm("Settle this loan? No new loan will be started.")) return;
    
    c.balance = 0;
    c.status = "Settled/Inactive";
    c.history.push({ date: new Date().toLocaleDateString('en-GB'), activity: 'Cleared Loan', time: '--', amt: 0, by: 'System' });
    
    await set(ref(db, `jml_data/${c.ownerId}/${c.idNumber}`), c);
    closeDetails();
};

window.settleAndNew = async () => {
    const c = allClients.find(x => x.idNumber === activeID);
    const newPrinc = parseFloat(prompt("Enter NEW Principal Amount:"));
    if(!newPrinc) return;

    // Archive current
    if(!c.pastLoans) c.pastLoans = [];
    c.pastLoans.push({ principal: c.principal, cleared: new Date().toLocaleDateString('en-GB') });

    // Reset for new
    c.principal = newPrinc;
    c.balance = newPrinc * 1.25;
    c.history = [{ date: new Date().toLocaleDateString('en-GB'), activity: 'Loan Started', time: 'New', amt: 0, by: 'Admin' }];
    
    await set(ref(db, `jml_data/${c.ownerId}/${c.idNumber}`), c);
    openDashboard(activeID);
};

// 6. SEARCH
window.doSearch = () => {
    const term = document.getElementById('globalSearch').value.toLowerCase();
    const filtered = allClients.filter(c => c.name.toLowerCase().includes(term) || c.idNumber.includes(term));
    renderTable(filtered);
};

// UTILITIES
window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
};
window.handleLogin = () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, e, p).catch(err => alert(err.message));
};
window.handleLogout = () => signOut(auth);
window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('minimized');
window.toggleTheme = () => document.body.classList.toggle('dark-mode');
window.closeDetails = () => document.getElementById('detailWindow').classList.add('hidden');

