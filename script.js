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

// --- ENROLL CLIENT ---
window.enrollClient = async () => {
    const idNum = document.getElementById('e-id').value;
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
        endDate: document.getElementById('e-end').value,
        status: "Active",
        history: [{
            date: new Date().toLocaleDateString('en-GB'),
            activity: 'Loan Started',
            details: `Initial Loan of KSh ${document.getElementById('e-princ').value}`,
            time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            by: auth.currentUser.email.split('@')[0]
        }]
    };

    await set(ref(db, `jml_data/${idNum}`), clientData);
    alert("Client Enrolled Successfully!");
    showSection('list-sec');
};

// --- CALCULATE FINANCIALS ---
window.calculateFinancials = () => {
    const selectedMonth = document.getElementById('fin-month').value; // e.g. "2026-04"
    const selectedYear = document.getElementById('fin-year').value;

    let grandTotalOut = 0;
    let paidToday = 0;
    let monthlyPaid = 0;
    let yearlyPaid = 0;

    const todayStr = new Date().toLocaleDateString('en-GB');

    allClients.forEach(c => {
        grandTotalOut += (c.balance || 0);
        (c.history || []).forEach(h => {
            if(h.activity === 'Payment') {
                const amt = parseFloat(h.details.replace(/[^\d.]/g, '')) || 0;
                if(h.date === todayStr) paidToday += amt;
                
                // Extract month/year from h.date "DD/MM/YYYY"
                const parts = h.date.split('/');
                const hMonth = `${parts[2]}-${parts[1]}`; // YYYY-MM
                const hYear = parts[2];

                if(hMonth === selectedMonth) monthlyPaid += amt;
                if(hYear === selectedYear) yearlyPaid += amt;
            }
        });
    });

    document.getElementById('fin-out').innerText = `KSh ${grandTotalOut.toLocaleString()}`;
    document.getElementById('fin-today').innerText = `KSh ${paidToday.toLocaleString()}`;
    document.getElementById('fin-month-val').innerText = `KSh ${monthlyPaid.toLocaleString()}`;
    document.getElementById('fin-year-val').innerText = `KSh ${yearlyPaid.toLocaleString()}`;
};

// --- LOAN WEEKLY SORTING ---
window.updateLoanWeeks = () => renderWeeklyLoans();
window.renderWeeklyLoans = () => {
    const month = document.getElementById('loan-month-select').value;
    const week = document.getElementById('loan-week-select').value;
    const container = document.getElementById('weeklyLoanContainer');

    if(!month) return;

    const filtered = allClients.filter(c => {
        if(!c.startDate) return false;
        const d = new Date(c.startDate);
        const cMonth = d.toISOString().slice(0, 7);
        const day = d.getDate();
        const cWeek = Math.ceil(day / 7);
        return cMonth === month && cWeek == week;
    });

    container.innerHTML = `<table class="styled-table">
        <thead><tr><th>Full Name</th><th>ID</th><th>Loan Amount</th><th>Date Issued</th></tr></thead>
        <tbody>
            ${filtered.length ? filtered.map(f => `
                <tr><td>${f.name}</td><td>${f.idNumber}</td><td>KSh ${f.principal}</td><td>${f.startDate}</td></tr>
            `).join('') : '<tr><td colspan="4">No loans issued this week</td></tr>'}
        </tbody>
    </table>`;
};

// --- DEBT MANAGEMENT ---
window.addNewDebtRow = () => {
    const tbody = document.getElementById('debtTableBody');
    const row = document.createElement('tr');
    row.innerHTML = `
        <td><input type="text" placeholder="Name"></td>
        <td><input type="text" placeholder="ID"></td>
        <td><input type="number" placeholder="Principal"></td>
        <td><input type="number" placeholder="Balance"></td>
        <td><button class="btn-post" onclick="confirmAction(() => this.parentElement.parentElement.remove())">Clear</button></td>
    `;
    tbody.appendChild(row);
};

// --- ACCOUNT BALANCE UPDATE ---
window.updateAccTotal = () => {
    const amt = document.getElementById('acc-total-entry').value;
    if(!amt) return alert("Please enter an amount");
    alert(`Account Balance Updated to: KSh ${amt}`);
    // Optional: Save this value to Firebase as well
};

// --- CORE UTILITIES ---
window.renderTable = (list) => {
    const tbody = document.getElementById('clientTableBody');
    const todayStr = new Date().toLocaleDateString('en-GB');
    const now = new Date();
    const isPast6PM = now.getHours() >= 18;

    tbody.innerHTML = list.map((c, i) => {
        const history = c.history || [];
        const hasPaidToday = history.some(h => h.date === todayStr && h.activity === 'Payment');
        let rowClass = (isPast6PM && !hasPaidToday) ? "late-row" : "";

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
};

window.openDashboard = (id) => {
    const c = allClients.find(x => x.idNumber === id);
    activeID = id;
    document.getElementById('v-name').innerText = c.name;
    document.getElementById('v-id').innerText = c.idNumber;
    document.getElementById('vl-princ').innerText = `KSh ${c.principal}`;
    document.getElementById('vl-bal').innerText = `KSh ${c.balance}`;
    document.getElementById('vi-name').innerText = c.name;
    document.getElementById('vi-id').innerText = c.idNumber;
    document.getElementById('vi-phone').innerText = c.phone;
    document.getElementById('vi-loc').innerText = c.location;
    document.getElementById('vi-occ').innerText = c.occupation;
    document.getElementById('vi-ref').innerText = c.referral;
    document.getElementById('vi-dates').innerText = `${c.startDate} to ${c.endDate || 'Ongoing'}`;
    renderHistory(c.history || []);
    document.getElementById('detailWindow').classList.remove('hidden');
};

function renderHistory(history) {
    const tbody = document.getElementById('historyBody');
    tbody.innerHTML = history.map(h => `
        <tr class="${h.activity === 'Loan Started' ? 'new-loan-row' : ''}">
            <td>${h.date}</td><td>${h.activity}</td><td>${h.details}</td><td>${h.time}</td><td>${h.by}</td>
        </tr>`).join('');
}

window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
};

window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('active');
window.toggleTheme = () => document.body.classList.toggle('dark-mode');
window.closeDetails = () => document.getElementById('detailWindow').classList.add('hidden');
window.confirmAction = (fn) => { if(confirm("Are you sure?")) fn(); };
window.handleLogin = () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, e, p).catch(err => alert(err.message));
};
window.handleLogout = () => signOut(auth);
