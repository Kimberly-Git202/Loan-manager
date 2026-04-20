import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, onValue, push, remove } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
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

// --- AUTH & INITIALIZATION ---
onAuthStateChanged(auth, user => {
    if (user) {
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        document.getElementById('user-display').innerText = `Staff: ${user.email.split('@')[0]}`;
        loadData();
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
    }
});

function loadData() {
    onValue(ref(db, 'jml_data'), (snap) => {
        const data = snap.val() || {};
        allClients = Object.values(data);
        renderTable(allClients);
        calculateFinancials();
        renderSettled();
    });
}

// --- 1. ENROLL CLIENT (FIXED) ---
window.enrollClient = async () => {
    const idNum = document.getElementById('e-id').value.trim();
    if(!idNum) return alert("ID Number is required!");

    const clientData = {
        name: document.getElementById('e-name').value,
        phone: document.getElementById('e-phone').value,
        idNumber: idNum,
        location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value,
        referral: document.getElementById('e-ref').value,
        principal: parseFloat(document.getElementById('e-princ').value) || 0,
        balance: parseFloat(document.getElementById('e-princ').value) || 0,
        totalPaid: 0,
        startDate: document.getElementById('e-start').value,
        endDate: document.getElementById('e-end').value || "Not Set",
        status: "Active",
        history: [{
            date: new Date().toLocaleDateString('en-GB'),
            activity: 'Loan Started',
            details: `Initial Loan KSh ${document.getElementById('e-princ').value}`,
            time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            by: auth.currentUser.email.split('@')[0]
        }]
    };

    try {
        await set(ref(db, `jml_data/${idNum}`), clientData);
        alert("Client Enrolled Successfully!");
        // Clear Form
        document.querySelectorAll('#add-sec input').forEach(i => i.value = "");
        window.showSection('list-sec');
    } catch (e) { alert("Error: " + e.message); }
};

// --- 2. PAYMENT & RECORDING ---
window.postPayment = async () => {
    const amt = parseFloat(document.getElementById('up-amt').value);
    const time = document.getElementById('up-time').value;
    const nextDate = document.getElementById('up-next-date').value;

    if(!amt || !time || !nextDate) return alert("FILL ALL: Amount, Time, and Next Payment Date!");

    const c = allClients.find(x => x.idNumber === activeID);
    const today = new Date().toLocaleDateString('en-GB');

    c.totalPaid = (c.totalPaid || 0) + amt;
    c.balance -= amt;
    c.nextPaymentStr = `KSh ${amt} due on ${nextDate}`;
    c.lastUpdated = `${today} ${time}`;
    
    if(!c.history) c.history = [];
    c.history.push({
        date: today,
        activity: 'Payment',
        details: `Paid KSh ${amt}`,
        time: time,
        by: auth.currentUser.email.split('@')[0]
    });

    await set(ref(db, `jml_data/${activeID}`), c);
    window.openDashboard(activeID);
    alert("Payment Recorded");
};

// --- 3. SETTLED LOANS LOGIC ---
window.settleLoan = async () => {
    const c = allClients.find(x => x.idNumber === activeID);
    if(c.balance > 0) {
        if(!confirm("Balance is not zero. Settle anyway?")) return;
    }

    c.status = "Settled";
    if(!c.archivedLoans) c.archivedLoans = [];
    c.archivedLoans.push({
        amount: c.principal,
        clearedDate: new Date().toLocaleDateString('en-GB')
    });
    
    c.balance = 0;
    await set(ref(db, `jml_data/${activeID}`), c);
    alert("Loan Moved to Settled Archive");
    window.closeDetails();
};

window.renderSettled = () => {
    const month = document.getElementById('settled-month-select').value;
    const container = document.getElementById('settledContainer');
    if(!month) return;

    const settled = allClients.filter(c => c.status === "Settled");
    
    container.innerHTML = `
    <table class="styled-table">
        <thead><tr><th>Name</th><th>ID</th><th>Total Paid</th><th>Cleared Date</th></tr></thead>
        <tbody>
            ${settled.map(s => `<tr><td>${s.name}</td><td>${s.idNumber}</td><td>${s.totalPaid}</td><td>${s.lastUpdated || 'N/A'}</td></tr>`).join('')}
        </tbody>
    </table>`;
};

// --- 4. FINANCIALS ---
window.calculateFinancials = () => {
    const selMonth = document.getElementById('fin-month').value;
    let totalOut = 0, paidToday = 0, monthly = 0;
    const today = new Date().toLocaleDateString('en-GB');

    allClients.forEach(c => {
        totalOut += (c.balance || 0);
        (c.history || []).forEach(h => {
            if(h.activity === 'Payment') {
                const amt = parseFloat(h.details.replace(/[^\d.]/g, '')) || 0;
                if(h.date === today) paidToday += amt;
                if(selMonth && h.date.includes(selMonth.split('-')[1])) monthly += amt;
            }
        });
    });

    document.getElementById('fin-out').innerText = `KSh ${totalOut.toLocaleString()}`;
    document.getElementById('fin-today').innerText = `KSh ${paidToday.toLocaleString()}`;
    document.getElementById('fin-month-val').innerText = `KSh ${monthly.toLocaleString()}`;
};

// --- 5. DEBTS & ACCOUNT ---
window.addNewDebtRow = () => {
    const tbody = document.getElementById('debtTableBody');
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input type="text"></td><td><input type="text"></td><td><input type="number"></td><td><input type="number"></td><td><button onclick="this.parentElement.parentElement.remove()">Clear</button></td>`;
    tbody.appendChild(tr);
};

window.updateAccTotal = () => {
    const val = document.getElementById('acc-total-entry').value;
    alert("Account Balance Logged: KSh " + val);
};

// --- UI UTILITIES ---
window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
};

window.openDashboard = (id) => {
    const c = allClients.find(x => x.idNumber === id);
    activeID = id;
    document.getElementById('v-name').innerText = c.name;
    document.getElementById('v-id').innerText = c.idNumber;
    document.getElementById('vi-name').innerText = c.name;
    document.getElementById('vi-phone').innerText = c.phone;
    document.getElementById('vi-loc').innerText = c.location;
    document.getElementById('vl-princ').innerText = "KSh " + c.principal;
    document.getElementById('vl-bal').innerText = "KSh " + c.balance;
    document.getElementById('vl-next').innerText = c.nextPaymentStr || "None";
    
    const hBody = document.getElementById('historyBody');
    hBody.innerHTML = (c.history || []).map(h => `<tr><td>${h.date}</td><td>${h.activity}</td><td>${h.details}</td><td>${h.time}</td><td>${h.by}</td></tr>`).join('');
    
    document.getElementById('detailWindow').classList.remove('hidden');
};

window.renderTable = (list) => {
    const tbody = document.getElementById('clientTableBody');
    tbody.innerHTML = list.map((c, i) => `
        <tr>
            <td>${i+1}</td>
            <td>${c.name}</td>
            <td>${c.idNumber}</td>
            <td>${c.phone}</td>
            <td>${c.totalPaid}</td>
            <td>${c.balance}</td>
            <td><button class="btn-post" onclick="openDashboard('${c.idNumber}')">View</button></td>
        </tr>
    `).join('');
};

window.confirmAction = (callback) => { if(confirm("Are you sure?")) callback(); };
window.closeDetails = () => document.getElementById('detailWindow').classList.add('hidden');
window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('active');
window.toggleTheme = () => document.body.classList.toggle('dark-mode');
window.handleLogin = () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, e, p).catch(err => alert(err.message));
};
window.handleLogout = () => signOut(auth);
