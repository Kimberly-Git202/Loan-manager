import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, onValue, get, update, remove } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
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
        document.getElementById('user-display').innerText = `User: ${user.email.split('@')[0]}`;
        loadData();
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
    }
});

function loadData() {
    onValue(ref(db, 'jml_data'), (snap) => {
        const data = snap.val() || {};
        allClients = Object.values(data);
        renderTable(allClients);
        calculateFinancials();
    });
}

// --- RENDER TABLE & LATE/SKIP LOGIC ---
function renderTable(list) {
    const tbody = document.getElementById('clientTableBody');
    const todayStr = new Date().toLocaleDateString('en-GB');
    const now = new Date();
    const isPast6PM = now.getHours() >= 18;

    tbody.innerHTML = list.map((c, i) => {
        const history = c.history || [];
        const hasPaidToday = history.some(h => h.date === todayStr && h.activity === 'Payment');
        
        let rowClass = "";
        // Red highlight if 6PM rule hit OR next payment date missed
        if ((isPast6PM && !hasPaidToday) || (c.nextPayDate && new Date(c.nextPayDate) < now && !hasPaidToday)) {
            rowClass = "late-row";
        }

        return `<tr class="${rowClass}">
            <td>${i+1}</td>
            <td><strong>${c.name}</strong></td>
            <td>${c.idNumber}</td>
            <td>${c.phone}</td>
            <td>KSh ${c.totalPaid || 0}</td>
            <td>KSh ${c.balance.toLocaleString()}</td>
            <td><button class="btn-post" onclick="openDashboard('${c.idNumber}')">View</button></td>
        </tr>`;
    }).join('');
}

// --- CLIENT DASHBOARD ---
window.openDashboard = (id) => {
    const c = allClients.find(x => x.idNumber === id);
    activeID = id;

    document.getElementById('v-name').innerText = c.name;
    document.getElementById('v-id').innerText = c.idNumber;
    document.getElementById('v-last').innerText = c.lastUpdated || 'Never';
    
    // Fill Boxes
    document.getElementById('vi-name').innerText = c.name;
    document.getElementById('vi-id').innerText = c.idNumber;
    document.getElementById('vi-phone').innerText = c.phone;
    document.getElementById('vi-loc').innerText = c.location;
    document.getElementById('vi-occ').innerText = c.occupation;
    document.getElementById('vi-ref').innerText = c.referral;
    document.getElementById('vi-dates').innerText = `${c.startDate} to ${c.endDate || 'Ongoing'}`;

    document.getElementById('vl-princ').innerText = `KSh ${c.principal}`;
    document.getElementById('vl-paid').innerText = `KSh ${c.totalPaid || 0}`;
    document.getElementById('vl-bal').innerText = `KSh ${c.balance}`;
    document.getElementById('vl-next').innerText = c.nextPaymentStr || 'Not Set';
    document.getElementById('v-notes').value = c.notes || '';

    // History & Archived
    renderHistory(c.history || []);
    renderArchive(c.archivedLoans || []);

    document.getElementById('detailWindow').classList.remove('hidden');
};

function renderHistory(history) {
    const tbody = document.getElementById('historyBody');
    tbody.innerHTML = history.map(h => {
        const isLate = parseInt(h.time?.split(':')[0]) >= 18 ? 'late-row' : '';
        const isNew = h.activity === 'Loan Started' ? 'new-loan-row' : '';
        return `<tr class="${isLate} ${isNew}">
            <td>${h.date}</td>
            <td>${h.activity}</td>
            <td>${h.details}</td>
            <td>${h.time}</td>
            <td>${h.by}</td>
        </tr>`;
    }).join('');
}

// --- RECORD PAYMENT (Compulsory Checks) ---
window.postPayment = async () => {
    const amt = parseFloat(document.getElementById('up-amt').value);
    const time = document.getElementById('up-time').value;
    const nextDate = document.getElementById('up-next-date').value;

    if(!amt || !time || !nextDate) return alert("All fields (Amount, Time, Next Date) are compulsory!");

    const c = allClients.find(x => x.idNumber === activeID);
    const today = new Date().toLocaleDateString('en-GB');

    const entry = {
        date: today,
        activity: 'Payment',
        details: `Repayment KSh ${amt}`,
        time: time,
        by: auth.currentUser.email.split('@')[0]
    };

    c.totalPaid = (c.totalPaid || 0) + amt;
    c.balance -= amt;
    c.nextPayDate = nextDate;
    c.nextPaymentStr = `KSh 200 due on ${new Date(nextDate).toLocaleDateString('en-GB')}`;
    c.lastUpdated = `${today} ${time}`;
    if(!c.history) c.history = [];
    c.history.push(entry);

    await set(ref(db, `jml_data/${activeID}`), c);
    openDashboard(activeID);
};

// --- SETTLE & ARCHIVE ---
window.settleLoan = async () => {
    const c = allClients.find(x => x.idNumber === activeID);
    if(!c.archivedLoans) c.archivedLoans = [];
    
    c.archivedLoans.push({
        amount: c.principal,
        clearedDate: new Date().toLocaleDateString('en-GB')
    });

    c.balance = 0;
    c.status = "Inactive";
    c.history.push({
        date: new Date().toLocaleDateString('en-GB'),
        activity: 'Loan Settled',
        details: 'Full balance cleared',
        time: '--',
        by: 'System'
    });

    await set(ref(db, `jml_data/${activeID}`), c);
    openDashboard(activeID);
};

// --- SIDEBAR NAVIGATION & SEARCH ---
window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if(window.innerWidth <= 768) toggleSidebar();
};

window.doSearch = () => {
    const term = document.getElementById('globalSearch').value.toLowerCase();
    const filtered = allClients.filter(c => c.name.toLowerCase().includes(term) || c.idNumber.includes(term));
    renderTable(filtered);
};

window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('active');
window.toggleTheme = () => document.body.classList.toggle('dark-mode');
window.closeDetails = () => document.getElementById('detailWindow').classList.add('hidden');
window.confirmAction = (fn) => { if(confirm("Are you sure you want to proceed?")) fn(); };

// --- LOGIN ---
window.handleLogin = () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, e, p).catch(err => alert("Login Failed: " + err.message));
};
