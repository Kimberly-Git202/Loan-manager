import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, onValue, update, remove } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

// --- 1. FIREBASE INITIALIZATION ---
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

// --- 2. AUTHENTICATION & DATA LOADING ---
onAuthStateChanged(auth, user => {
    if (user) {
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        document.getElementById('user-display').innerText = `Logged in: ${user.email}`;
        loadData();
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
    }
});

function loadData() {
    onValue(ref(db, 'jml_data'), snap => {
        const data = snap.val();
        allClients = data ? Object.values(data) : [];
        renderTable();
        renderDebtTable();
        calculateFinancials();
        renderStaffDropdown(); // For Reports
    });
}

// --- 3. THE CLIENT VIEW (DASHBOARD LOGIC) ---
window.openView = (id) => {
    const c = allClients.find(x => x.idNumber == id);
    if(!c) return;
    activeID = id;
    
    // Header Info
    document.getElementById('v-name').innerText = c.name;
    document.getElementById('v-id').innerText = c.idNumber;
    document.getElementById('v-time').innerText = c.lastUpdated || "New Account";
    document.getElementById('v-status').innerText = c.status;

    // CLIENT INFORMATION BOX
    document.getElementById('vi-name').innerText = c.name;
    document.getElementById('vi-id').innerText = c.idNumber;
    document.getElementById('vi-phone').innerText = c.phone;
    document.getElementById('vi-loc').innerText = c.location;
    document.getElementById('vi-occ').innerText = c.occupation;
    document.getElementById('vi-ref').innerText = c.referral;

    // CURRENT LOANS BOX
    document.getElementById('vl-princ').innerText = `KSH ${c.principal}`;
    document.getElementById('vl-paid').innerText = `KSH ${c.totalPaid}`;
    document.getElementById('vl-bal').innerText = `KSH ${c.balance}`;
    document.getElementById('vl-next').innerText = c.nextPayment || "Not Set";
    document.getElementById('vl-start').innerText = c.startDate;
    document.getElementById('vl-end').innerText = c.endDate || "N/A";

    // PAYMENT HISTORY (Requirement: RED if past 6PM or skipped)
    const historyHtml = (c.history || []).map(h => {
        // Red Highlight if manually entered time is past 18:00 (6 PM)
        const isLate = h.time && h.time > "18:00";
        const isNew = h.activity === "New Loan";
        return `<tr class="${isLate ? 'row-late' : ''} ${isNew ? 'row-new' : ''}">
            <td>${h.date}</td>
            <td>${h.activity}</td>
            <td>${h.details}</td>
            <td>${h.time}</td>
            <td>${h.by}</td>
        </tr>`;
    }).join('');
    document.getElementById('v-history').innerHTML = historyHtml;

    // ARCHIVED LOANS
    const archivedHtml = (c.archivedLoans || []).map(a => `
        <tr><td>KSH ${a.amount}</td><td>${a.clearedDate}</td></tr>
    `).join('');
    document.getElementById('v-archived-loans').innerHTML = archivedHtml;

    document.getElementById('view-modal').classList.remove('hidden');
};

// --- 4. FINANCIAL CALCULATIONS (Requirement 3) ---
window.calculateFinancials = () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, '0')}`;
    const selectedMonth = document.getElementById('fin-month-picker').value || currentMonth;

    let totalOut = 0;
    let paidToday = 0;
    let monthlyTotal = 0;
    let profit = 0;
    let loss = 0;

    allClients.forEach(c => {
        totalOut += (c.balance || 0);
        (c.history || []).forEach(h => {
            if(h.activity === "Payment") {
                const amt = parseFloat(h.details.replace('KSh ', '')) || 0;
                if(h.date === now.toLocaleDateString()) paidToday += amt;
                if(h.date.includes(selectedMonth)) monthlyTotal += amt;
            }
        });
    });

    document.getElementById('fin-out').innerText = `KSh ${totalOut}`;
    document.getElementById('fin-today').innerText = `KSh ${paidToday}`;
    document.getElementById('fin-month-val').innerText = `KSh ${monthlyTotal}`;
    // Profit/Loss logic can be customized based on your interest rates
    document.getElementById('fin-profit').innerText = `KSh ${monthlyTotal * 0.1}`; 
};

// --- 5. SATURDAY LOAN FILTERING (Requirement 4 & Loans sidebar) ---
window.renderWeeklyLoans = () => {
    const month = document.getElementById('loan-month-filter').value;
    const week = parseInt(document.getElementById('loan-week-filter').value);
    const body = document.getElementById('loanWeekBody');
    
    const filtered = allClients.filter(c => {
        const d = new Date(c.startDate);
        const day = d.getDay(); // 6 is Saturday
        const date = d.getDate();
        const m = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2, '0')}`;
        
        const inWeek = Math.ceil(date / 7) === week;
        return day === 6 && m === month && inWeek;
    });

    body.innerHTML = filtered.map(c => `
        <tr><td>${c.name}</td><td>${c.idNumber}</td><td>${c.phone}</td><td>${c.principal}</td><td>${c.startDate}</td></tr>
    `).join('');
};

// --- 6. ACTIONS (Record, Settle, New Loan, Delete) ---
window.processAction = async (type) => {
    if(!confirm(`Are you sure you want to ${type}?`)) return;
    
    const c = allClients.find(x => x.idNumber == activeID);
    const amt = parseFloat(document.getElementById('act-amt').value) || 0;
    const manualTime = document.getElementById('act-time').value;

    if(type === 'Payment') {
        const newPaid = (c.totalPaid || 0) + amt;
        await update(ref(db, `jml_data/${activeID}`), {
            totalPaid: newPaid,
            balance: c.principal - newPaid,
            lastUpdated: `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
            history: [...(c.history || []), {
                date: new Date().toLocaleDateString(),
                activity: "Payment",
                details: `KSh ${amt}`,
                time: manualTime,
                by: auth.currentUser.email
            }]
        });
    } else if (type === 'Settle') {
        const archived = { amount: c.principal, clearedDate: new Date().toLocaleDateString() };
        await update(ref(db, `jml_data/${activeID}`), {
            status: "Settled",
            balance: 0,
            archivedLoans: [...(c.archivedLoans || []), archived]
        });
    } else if (type === 'Delete') {
        await remove(ref(db, `jml_data/${activeID}`));
        closeView();
    }
    openView(activeID);
};

// --- 7. ENROLLMENT ---
window.enrollClient = async () => {
    const id = document.getElementById('e-id').value;
    const princ = parseFloat(document.getElementById('e-princ').value);
    const data = {
        name: document.getElementById('e-name').value,
        idNumber: id,
        phone: document.getElementById('e-phone').value,
        location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value,
        referral: document.getElementById('e-ref').value,
        principal: princ,
        balance: princ,
        totalPaid: 0,
        startDate: document.getElementById('e-start').value,
        endDate: document.getElementById('e-end').value,
        status: "Active",
        history: [{
            date: new Date().toLocaleDateString(),
            activity: "New Loan",
            details: `Started KSh ${princ}`,
            time: "09:00",
            by: auth.currentUser.email
        }]
    };
    await set(ref(db, `jml_data/${id}`), data);
    showSection('list-sec');
};

// --- 8. UI HELPERS ---
window.showSection = id => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
};

window.doSearch = () => {
    const q = document.getElementById('globalSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#clientTableBody tr');
    rows.forEach(r => {
        r.style.display = r.innerText.toLowerCase().includes(q) ? '' : 'none';
    });
};

window.closeView = () => document.getElementById('view-modal').classList.add('hidden');
window.toggleTheme = () => document.body.classList.toggle('dark-mode');
window.handleLogin = () => signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value);
window.handleLogout = () => signOut(auth).then(() => location.reload());

// ... Other rendering functions (renderTable, renderDebtTable, etc.)

