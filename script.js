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
let activeID = null;
let isAdmin = false;

// AUTH MONITOR
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('user-email-display').innerText = user.email;
        const snap = await get(ref(db, `jml_users/${user.uid}`));
        isAdmin = (snap.val()?.role === 'admin');
        if(isAdmin) document.getElementById('admin-panel').classList.remove('hidden');
        loadData();
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
    }
});

// LOAD DATA
function loadData() {
    onValue(ref(db, 'jml_data'), (snap) => {
        const data = snap.val() || {};
        allClients = [];
        Object.keys(data).forEach(uid => {
            Object.values(data[uid]).forEach(c => {
                if(isAdmin || c.ownerId === auth.currentUser.uid) allClients.push(c);
            });
        });
        renderTable(allClients);
        renderAccordion();
    });
}

// RENDER MAIN TABLE
function renderTable(list) {
    const tbody = document.getElementById('clientTableBody');
    const today = new Date().toLocaleDateString('en-GB');
    let dailyCollected = 0;

    tbody.innerHTML = list.map((c, i) => {
        const history = c.history || [];
        const lastDate = history.length > 0 ? history[history.length-1].date : 'None';
        const skipped = lastDate !== today;
        
        history.forEach(h => { if(h.date === today) dailyCollected += h.amt; });

        return `
            <tr style="${skipped ? 'border-left: 5px solid red; background: #fff5f5' : ''}">
                <td>${i+1}</td>
                <td style="font-weight:bold">${c.name}</td>
                <td>${c.idNumber}</td>
                <td>KSh ${c.balance.toLocaleString()}</td>
                <td><span class="badge ${skipped ? 'danger' : 'success'}">${skipped ? 'Skipped' : 'Paid'}</span></td>
                <td><button class="btn-view" onclick="openDashboard('${c.idNumber}')">View</button></td>
            </tr>
        `;
    }).join('');
    document.getElementById('top-today-val').innerText = `Paid Today: KSh ${dailyCollected.toLocaleString()}`;
}

// OPEN DASHBOARD
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
    document.getElementById('d-princ').innerText = c.principal;
    document.getElementById('ed-balance').value = c.balance;
    document.getElementById('ed-start').value = c.startDate || "";
    document.getElementById('ed-end').value = c.endDate || "";

    // Payment History with TIME
    document.getElementById('historyBody').innerHTML = (c.history || []).reverse().map(h => `
        <tr><td>${h.date}</td><td style="color:red; font-weight:bold">${h.time}</td><td>KSh ${h.amt}</td><td>${h.by}</td></tr>
    `).join('');

    // Past Loans History
    document.getElementById('pastLoansContainer').innerHTML = (c.pastLoans || []).map(p => `
        <div class="info-card" style="margin-top:5px; font-size:0.8rem">
            Settled ${p.clearedDate}: KSh ${p.principal} principal | Total Paid KSh ${p.totalPaid}
        </div>
    `).join('') || "No archived loans.";

    document.getElementById('detailWindow').classList.remove('hidden');
};

// PROCESS PAYMENT
window.processPayment = async () => {
    const amt = parseFloat(document.getElementById('payAmt').value);
    const c = allClients.find(x => x.idNumber === activeID);
    if(!amt || !c) return;

    const now = new Date();
    const timestamp = now.getHours().toString().padStart(2,'0') + ":" + now.getMinutes().toString().padStart(2,'0');
    
    c.balance -= amt;
    if(!c.history) c.history = [];
    c.history.push({ 
        date: now.toLocaleDateString('en-GB'), 
        time: timestamp, 
        amt: amt, 
        by: auth.currentUser.email.split('@')[0] 
    });

    await set(ref(db, `jml_data/${c.ownerId}/${c.idNumber}`), c);
    document.getElementById('payAmt').value = "";
    openDashboard(activeID);
};

// DELETE CLIENT
window.deleteClient = async () => {
    if(!confirm("DELETE PROFILE? This cannot be undone.")) return;
    const c = allClients.find(x => x.idNumber === activeID);
    await remove(ref(db, `jml_data/${c.ownerId}/${c.idNumber}`));
    closeDetails();
};

// UPDATE FIELDS (Principal/Dates/Balance)
window.updateField = async (field, val) => {
    const c = allClients.find(x => x.idNumber === activeID);
    c[field] = (field === 'balance' || field === 'principal') ? parseFloat(val) : val;
    await set(ref(db, `jml_data/${c.ownerId}/${c.idNumber}`), c);
};

// SETTLE AND RE-LOAN
window.settleAndReset = async () => {
    const c = allClients.find(x => x.idNumber === activeID);
    if(!confirm("Settle this loan and archive data?")) return;

    const archive = { 
        principal: c.principal, 
        totalPaid: (c.principal * 1.25) - c.balance, 
        clearedDate: new Date().toLocaleDateString('en-GB') 
    };
    if(!c.pastLoans) c.pastLoans = [];
    c.pastLoans.push(archive);

    c.principal = parseFloat(prompt("New Principal Amount:", c.principal)) || c.principal;
    c.balance = c.principal * 1.25;
    c.history = [];
    c.startDate = ""; c.endDate = "";

    await set(ref(db, `jml_data/${c.ownerId}/${c.idNumber}`), c);
    closeDetails();
};

// UTILITIES
window.handleLogin = () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, e, p).catch(err => alert(err.message));
};
window.handleLogout = () => signOut(auth);
window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('minimized');
window.toggleTheme = () => document.body.classList.toggle('dark-mode');
window.closeDetails = () => document.getElementById('detailWindow').classList.add('hidden');
window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
};
window.togglePass = (id, icon) => {
    const input = document.getElementById(id);
    input.type = input.type === 'password' ? 'text' : 'password';
    icon.classList.toggle('fa-eye-slash');
};



