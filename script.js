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

// AUTH
window.handleLogin = () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, e, p).catch(err => alert(err.message));
};

onAuthStateChanged(auth, user => {
    if(user) {
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('main-wrapper').classList.remove('hidden');
        document.getElementById('current-user-email').innerText = user.email;
        syncData();
    }
});

function syncData() {
    onValue(ref(db, 'jml_data'), (snap) => {
        allClients = snap.val() ? Object.values(snap.val()) : [];
        renderTable();
        calcFinance();
    });
}

// RENDER CLIENTS TABLE
window.renderTable = () => {
    const q = document.getElementById('globalSearch').value.toLowerCase();
    const tbody = document.getElementById('clientTableBody');
    tbody.innerHTML = allClients
        .filter(c => c.name.toLowerCase().includes(q) || c.idNumber.includes(q))
        .map((c, i) => `
            <tr>
                <td>${i+1}</td><td>${c.name}</td><td>${c.idNumber}</td><td>${c.phone}</td>
                <td>KSH ${c.totalPaid || 0}</td><td>KSH ${c.balance || 0}</td>
                <td><button class="btn-main" onclick="openView('${c.idNumber}')">VIEW</button></td>
            </tr>
        `).join('');
};

// ENROLL (WITH 1.25x CALCULATION)
window.enrollClient = () => {
    const id = document.getElementById('e-id').value;
    const princ = parseFloat(document.getElementById('e-princ').value);
    const balance = princ * 1.25; // PROFIT LOGIC

    const data = {
        name: document.getElementById('e-name').value, idNumber: id,
        phone: document.getElementById('e-phone').value, location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value, referral: document.getElementById('e-ref').value,
        principal: princ, balance: balance, totalPaid: 0,
        startDate: document.getElementById('e-start').value, endDate: document.getElementById('e-end').value,
        status: 'Active', officer: auth.currentUser.email,
        history: [{
            date: new Date().toLocaleDateString(), activity: 'New Loan',
            details: `KSH ${princ} Issued. Balance set to ${balance}`, time: '09:00', by: auth.currentUser.email
        }]
    };
    set(ref(db, 'jml_data/' + id), data).then(() => alert("Saved!"));
};

// OPEN VIEW (ONE CLIENT VIEW)
window.openView = (id) => {
    const c = allClients.find(x => x.idNumber == id);
    if(!c) return;
    activeID = id;

    document.getElementById('v-name').innerText = c.name;
    document.getElementById('v-id').innerText = c.idNumber;
    document.getElementById('v-up').innerText = c.lastUpdated || 'Initial';
    document.getElementById('v-status').value = c.status;
    document.getElementById('v-officer').value = c.officer;
    
    document.getElementById('v-info-grid').innerHTML = `
        <p>Full Name: <b>${c.name}</b></p><p>ID: <b>${c.idNumber}</b></p>
        <p>Phone: <b>${c.phone}</b></p><p>Location: <b>${c.location}</b></p>
        <p>Occupation: <b>${c.occupation}</b></p><p>Referral: <b>${c.referral}</b></p>
    `;
    
    document.getElementById('v-pri').innerText = c.principal;
    document.getElementById('v-paid').innerText = c.totalPaid;
    document.getElementById('v-bal').innerText = c.balance;
    document.getElementById('v-next-txt').innerText = c.nextDue || 'None Set';
    document.getElementById('v-notes').value = c.notes || "";
    document.getElementById('v-start-edit').value = c.startDate || "";
    document.getElementById('v-end-edit').value = c.endDate || "";

    // Payment History with Late Highlighting (Past 6 PM)
    document.getElementById('v-history-body').innerHTML = (c.history || []).map(h => {
        const isLate = h.time && h.time > "18:00";
        const isNew = h.activity === 'New Loan';
        return `<tr class="${isLate ? 'late-payment' : ''} ${isNew ? 'new-loan-row' : ''}">
            <td>${h.date}</td><td>${h.activity}</td><td>${h.details}</td><td>${h.time}</td><td>${h.by}</td>
        </tr>`;
    }).join('');

    document.getElementById('v-archived-body').innerHTML = (c.archived || []).map(a => `
        <tr><td>${a.amt}</td><td>${a.date}</td></tr>
    `).join('');

    document.getElementById('view-modal').classList.remove('hidden');
};

// TRANSACTIONS
window.processTx = (type) => {
    if(!confirm(`Are you sure you want to ${type}?`)) return;
    const c = allClients.find(x => x.idNumber == activeID);
    const amt = parseFloat(document.getElementById('u-amt').value) || 0;
    const mTime = document.getElementById('u-time').value;
    
    let updates = { 
        lastUpdated: new Date().toLocaleString(),
        status: document.getElementById('v-status').value,
        notes: document.getElementById('v-notes').value,
        startDate: document.getElementById('v-start-edit').value,
        endDate: document.getElementById('v-end-edit').value
    };

    if(type === 'Payment') {
        updates.totalPaid = (c.totalPaid || 0) + amt;
        updates.balance = c.balance - amt;
        updates.nextDue = document.getElementById('u-next').value;
        updates.history = [...(c.history || []), {
            date: new Date().toLocaleDateString(), activity: 'Payment',
            details: `Paid KSH ${amt}`, time: mTime, by: auth.currentUser.email
        }];
    } else if(type === 'Settle') {
        updates.balance = 0;
        updates.status = 'Inactive';
        updates.settledDate = new Date().toLocaleDateString();
        updates.archived = [...(c.archived || []), { amt: c.principal, date: updates.settledDate }];
    } else if(type === 'New') {
        updates.principal = amt;
        updates.balance = amt * 1.25;
        updates.totalPaid = 0;
        updates.status = 'Active';
        updates.history = [...(c.history || []), { 
            date: new Date().toLocaleDateString(), activity: 'New Loan', 
            details: `New Loan Issued: ${amt}`, time: mTime, by: auth.currentUser.email 
        }];
    } else if(type === 'Delete') {
        remove(ref(db, 'jml_data/' + activeID)).then(closeModal);
        return;
    }

    update(ref(db, 'jml_data/' + activeID), updates).then(() => openView(activeID));
};

// FINANCIALS
window.calcFinance = () => {
    const m = document.getElementById('f-m-pick').value;
    let totalOut = 0, paidToday = 0, paidMonth = 0, profitMonth = 0;
    const todayStr = new Date().toLocaleDateString();

    allClients.forEach(c => {
        totalOut += parseFloat(c.principal || 0);
        (c.history || []).forEach(h => {
            if(h.activity === 'Payment') {
                const hAmt = parseFloat(h.details.split('KSH ')[1]) || 0;
                if(h.date === todayStr) paidToday += hAmt;
                if(h.date.includes(m)) paidMonth += hAmt;
            }
        });
        // Profit logic from 1.25x
        if(c.startDate && c.startDate.includes(m)) {
            profitMonth += (c.principal * 0.25);
        }
    });

    document.getElementById('f-out').innerText = totalOut;
    document.getElementById('f-today').innerText = paidToday;
    document.getElementById('f-m-val').innerText = paidMonth;
    document.getElementById('f-profit').innerText = profitMonth;
};

// LOAN SORTING (SATURDAYS)
window.renderLoans = () => {
    const m = document.getElementById('loan-month').value;
    const w = document.getElementById('loan-week').value;
    document.getElementById('loanTableBody').innerHTML = allClients
        .filter(c => c.startDate && c.startDate.includes(m))
        .map(c => `<tr><td>${c.name}</td><td>${c.idNumber}</td><td>${c.phone}</td><td>${c.principal}</td><td>${c.startDate}</td></tr>`)
        .join('');
};

window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('minimized');
window.toggleTheme = () => document.getElementById('app-body').classList.toggle('dark-mode');
window.showSec = (id, el) => {
    document.querySelectorAll('.content-panel').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
};
window.closeModal = () => document.getElementById('view-modal').classList.add('hidden');
