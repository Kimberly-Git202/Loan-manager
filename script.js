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

// --- AUTHENTICATION ---
onAuthStateChanged(auth, user => {
    if (user) {
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
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
        renderStaffReport();
    });
}

// --- RENDER CLIENT LIST (With Late Skip Red Logic) ---
function renderTable(list) {
    const tbody = document.getElementById('clientTableBody');
    const now = new Date();
    const isLateTime = now.getHours() >= 18; // 6 PM Rule
    const todayStr = now.toLocaleDateString('en-GB');

    tbody.innerHTML = list.map((c, i) => {
        const hasPaidToday = (c.history || []).some(h => h.date === todayStr);
        let rowClass = "";
        
        // Red highlight if skipped payment today or past due
        if ((isLateTime && !hasPaidToday) || (c.nextPaymentDate && new Date(c.nextPaymentDate) < now && !hasPaidToday)) {
            rowClass = "late-row";
        }

        return `<tr class="${rowClass}">
            <td>${i+1}</td>
            <td>${c.name}</td>
            <td>${c.idNumber}</td>
            <td>${c.phone}</td>
            <td>KSh ${c.totalPaid || 0}</td>
            <td>KSh ${c.balance.toLocaleString()}</td>
            <td><button class="btn-post" onclick="openDashboard('${c.idNumber}')">View</button></td>
        </tr>`;
    }).join('');
}

// --- POST PAYMENT (Compulsory Next Date & Manual Time) ---
window.postPayment = async () => {
    const amt = parseFloat(document.getElementById('up-amt').value) || 0;
    const time = document.getElementById('up-time').value;
    const nextDate = document.getElementById('up-next-date').value;

    if(!time || !nextDate) return alert("Time and Next Payment Date are COMPULSORY!");

    const c = allClients.find(x => x.idNumber === activeID);
    
    const entry = {
        date: new Date().toLocaleDateString('en-GB'),
        activity: "Payment",
        details: `KSh ${amt} payment`,
        time: time,
        by: auth.currentUser.email.split('@')[0]
    };

    c.totalPaid = (c.totalPaid || 0) + amt;
    c.balance -= amt;
    c.nextPaymentDate = nextDate;
    c.nextPaymentStr = `KSh 200 due on ${nextDate}`;
    c.lastUpdated = `${entry.date} ${time}`;
    if(!c.history) c.history = [];
    c.history.push(entry);

    await set(ref(db, `jml_data/${activeID}`), c);
    openDashboard(activeID);
};

// --- SETTLE LOAN & ARCHIVING ---
window.settleLoan = async () => {
    const c = allClients.find(x => x.idNumber === activeID);
    if(!c.archivedLoans) c.archivedLoans = [];
    
    c.archivedLoans.push({
        amount: c.principal,
        clearedDate: new Date().toLocaleDateString('en-GB')
    });

    c.status = "Inactive";
    c.balance = 0;
    await set(ref(db, `jml_data/${activeID}`), c);
    alert("Loan Settled and Archived!");
    closeDetails();
};

// --- STAFF REPORT (Admin Only) ---
function renderStaffReport() {
    const container = document.getElementById('staff-report-container');
    // Group all history by employee
    let reportData = {};
    allClients.forEach(c => {
        (c.history || []).forEach(h => {
            if(!reportData[h.by]) reportData[h.by] = [];
            reportData[h.by].push({ client: c.name, ...h });
        });
    });

    container.innerHTML = Object.keys(reportData).map(staff => `
        <div class="info-box" style="margin-bottom:10px;">
            <h4>Update Log: ${staff}</h4>
            ${reportData[staff].slice(-3).map(r => `<p>${r.date} - ${r.client}: ${r.activity}</p>`).join('')}
        </div>
    `).join('');
}

// --- UTILS ---
window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('active');
window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if(window.innerWidth <= 768) toggleSidebar();
};
window.confirmAction = (fn) => { if(confirm("Confirm this action?")) fn(); };
window.closeDetails = () => document.getElementById('detailWindow').classList.add('hidden');
window.handleLogin = () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, e, p).catch(err => alert(err.message));
};
window.toggleTheme = () => document.body.classList.toggle('dark-mode');
