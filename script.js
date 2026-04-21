import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, onValue, update, remove } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
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

onAuthStateChanged(auth, user => {
    if (user) {
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        document.getElementById('user-display').innerText = user.email;
        loadData();
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
    }
});

function loadData() {
    onValue(ref(db, 'jml_data'), snap => {
        allClients = snap.val() ? Object.values(snap.val()) : [];
        renderTable();
        renderDebtTable();
        calculateFinancials();
    });
}

// 1. VIEW BUTTON & DASHBOARD
window.openView = (id) => {
    const c = allClients.find(x => x.idNumber == id);
    if(!c) return;
    activeID = id;
    
    // Fill Dashboard
    document.getElementById('v-name').innerText = c.name;
    document.getElementById('v-id').innerText = c.idNumber;
    document.getElementById('v-time').innerText = c.lastUpdated || "N/A";
    document.getElementById('v-status').innerText = c.status;
    document.getElementById('vi-name').innerText = c.name;
    document.getElementById('vi-id').innerText = c.idNumber;
    document.getElementById('vi-phone').innerText = c.phone;
    document.getElementById('vi-loc').innerText = c.location;
    document.getElementById('vi-occ').innerText = c.occupation;
    document.getElementById('vi-ref').innerText = c.referral;
    document.getElementById('vl-princ').innerText = c.principal;
    document.getElementById('vl-paid').innerText = c.totalPaid;
    document.getElementById('vl-bal').innerText = c.balance;
    document.getElementById('vl-start').innerText = c.startDate;
    document.getElementById('vl-end').innerText = c.endDate || "N/A";

    // History & Highlighting (Red if past 6PM or missed)
    document.getElementById('v-history').innerHTML = (c.history || []).map(h => {
        const isLate = h.time > "18:00";
        const isNew = h.activity === "New Loan";
        return `<tr class="${isLate ? 'row-late' : ''} ${isNew ? 'row-new' : ''}">
            <td>${h.date}</td><td>${h.activity}</td><td>${h.details}</td><td>${h.time}</td><td>${h.by}</td>
        </tr>`;
    }).join('');

    document.getElementById('view-modal').classList.remove('hidden');
};

// 4. LOANS (SATURDAY LOGIC)
window.renderWeeklyLoans = () => {
    const month = document.getElementById('loan-month-filter').value;
    const week = parseInt(document.getElementById('loan-week-filter').value);
    const body = document.getElementById('loanWeekBody');
    
    const filtered = allClients.filter(c => {
        const d = new Date(c.startDate);
        const day = d.getDay(); // 6 = Saturday
        const date = d.getDate();
        const m = (d.getMonth() + 1).toString().padStart(2, '0');
        const y = d.getFullYear();
        const formatted = `${y}-${m}`;
        
        const inWeek = Math.ceil(date / 7) === week;
        return day === 6 && formatted === month && inWeek;
    });

    body.innerHTML = filtered.map(c => `
        <tr><td>${c.name}</td><td>${c.idNumber}</td><td>${c.phone}</td><td>${c.principal}</td><td>${c.startDate}</td></tr>
    `).join('');
};

// ACTIONS WITH PROMPTS
window.processAction = async (type) => {
    if(!confirm(`Are you sure you want to ${type}?`)) return;
    const c = allClients.find(x => x.idNumber == activeID);
    const amt = parseFloat(document.getElementById('act-amt').value) || 0;
    const time = document.getElementById('act-time').value;

    if(type === 'Delete') {
        await remove(ref(db, `jml_data/${activeID}`));
        closeView();
    } else if (type === 'Payment') {
        const newPaid = (c.totalPaid || 0) + amt;
        const updates = {
            totalPaid: newPaid,
            balance: c.principal - newPaid,
            lastUpdated: new Date().toLocaleString(),
            history: [...(c.history || []), {
                date: new Date().toLocaleDateString(),
                activity: "Payment", details: `KSh ${amt}`,
                time: time, by: auth.currentUser.email
            }]
        };
        await update(ref(db, `jml_data/${activeID}`), updates);
        openView(activeID);
    } else if (type === 'Settle') {
        await update(ref(db, `jml_data/${activeID}`), {
            status: "Settled",
            clearedDate: new Date().toLocaleDateString(),
            balance: 0
        });
        closeView();
    }
};

window.enrollClient = async () => {
    const id = document.getElementById('e-id').value;
    const data = {
        name: document.getElementById('e-name').value,
        idNumber: id,
        phone: document.getElementById('e-phone').value,
        location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value,
        referral: document.getElementById('e-ref').value,
        principal: parseFloat(document.getElementById('e-princ').value),
        balance: parseFloat(document.getElementById('e-princ').value),
        totalPaid: 0,
        startDate: document.getElementById('e-start').value,
        endDate: document.getElementById('e-end').value,
        status: "Active",
        loanOfficer: auth.currentUser.email,
        history: [{date: new Date().toLocaleDateString(), activity: "New Loan", details: "Initial enrollment", time: "09:00", by: auth.currentUser.email}]
    };
    await set(ref(db, `jml_data/${id}`), data);
    showSection('list-sec');
};

window.renderTable = () => {
    document.getElementById('clientTableBody').innerHTML = allClients.filter(c => c.status === "Active").map((c, i) => `
        <tr><td>${i+1}</td><td>${c.name}</td><td>${c.idNumber}</td><td>${c.phone}</td><td>${c.totalPaid}</td><td>${c.balance}</td>
        <td><button class="btn-post" onclick="openView('${c.idNumber}')">View</button></td></tr>
    `).join('');
};

window.renderDebtTable = () => {
    document.getElementById('debtTableBody').innerHTML = allClients.filter(c => c.balance > 0).map(c => `
        <tr><td>${c.name}</td><td>${c.idNumber}</td><td>${c.principal}</td><td>${c.balance}</td>
        <td><button class="btn-settle" onclick="openView('${c.idNumber}')">Clear</button></td></tr>
    `).join('');
};

window.showSection = id => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
};
window.closeView = () => document.getElementById('view-modal').classList.add('hidden');
window.toggleTheme = () => document.body.classList.toggle('dark-mode');
window.handleLogin = () => signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value);
window.handleLogout = () => signOut(auth).then(() => location.reload());
