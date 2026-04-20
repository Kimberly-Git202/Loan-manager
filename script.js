import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, onValue, update, get } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
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
        document.getElementById('user-display').innerText = `Staff: ${user.email.split('@')[0]}`;
        loadData();
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
    }
});

function loadData() {
    onValue(ref(db, 'jml_data'), (snap) => {
        const data = snap.val();
        allClients = data ? Object.values(data) : [];
        renderTable(allClients);
        renderDebtTable();
        populateStaffDropdown();
        calculateFinancials();
    });
    
    onValue(ref(db, 'acc_total'), (snap) => {
        document.getElementById('display-acc-total').innerText = `KSh ${snap.val() || 0}`;
    });
}

// ENROLLMENT
window.enrollClient = async () => {
    const idNum = document.getElementById('e-id').value.trim();
    const name = document.getElementById('e-name').value.trim();
    if(!idNum || !name) return alert("Missing ID or Name");

    const clientData = {
        name, idNumber: idNum,
        phone: document.getElementById('e-phone').value,
        location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value,
        principal: parseFloat(document.getElementById('e-princ').value) || 0,
        balance: parseFloat(document.getElementById('e-princ').value) || 0,
        totalPaid: 0,
        startDate: document.getElementById('e-start').value || new Date().toISOString().split('T')[0],
        status: "Active",
        staff: auth.currentUser.email.split('@')[0],
        history: [{
            date: new Date().toLocaleDateString('en-GB'),
            activity: 'Loan Started',
            details: `Initial KSh ${document.getElementById('e-princ').value}`,
            by: auth.currentUser.email.split('@')[0]
        }]
    };
    await set(ref(db, 'jml_data/' + idNum), clientData);
    alert("Saved!");
    showSection('list-sec');
};

// VIEW BUTTON LOGIC
window.openDashboard = (id) => {
    const c = allClients.find(x => x.idNumber == id);
    if(!c) return;
    activeID = id;
    document.getElementById('v-name').innerText = c.name;
    document.getElementById('v-id').innerText = c.idNumber;
    document.getElementById('vi-phone').innerText = c.phone;
    document.getElementById('vi-loc').innerText = c.location;
    document.getElementById('vi-occ').innerText = c.occupation;
    document.getElementById('vl-princ').innerText = `KSh ${c.principal}`;
    document.getElementById('vl-bal').innerText = `KSh ${c.balance}`;
    document.getElementById('vl-paid').innerText = `KSh ${c.totalPaid || 0}`;
    
    document.getElementById('historyBody').innerHTML = (c.history || []).map(h => `
        <tr><td>${h.date}</td><td>${h.activity}</td><td>${h.details}</td><td>${h.by}</td></tr>
    `).join('');
    document.getElementById('detailWindow').classList.remove('hidden');
};

// DEBT MANAGEMENT
function renderDebtTable() {
    const debts = allClients.filter(c => c.status === "Active" && c.balance > 0);
    document.getElementById('debtTableBody').innerHTML = debts.map(c => `
        <tr>
            <td>${c.name}</td><td>${c.idNumber}</td><td>${c.principal}</td><td>${c.balance}</td>
            <td><button class="btn-post" onclick="openDashboard('${c.idNumber}')">View</button></td>
        </tr>
    `).join('');
}

// FINANCIALS
window.calculateFinancials = () => {
    const today = new Date().toLocaleDateString('en-GB');
    const selectedMonth = document.getElementById('fin-month').value; 

    let totalOut = 0, todayPaid = 0, monthPaid = 0;

    allClients.forEach(c => {
        totalOut += (c.balance || 0);
        (c.history || []).forEach(h => {
            if(h.activity === 'Payment') {
                const amt = parseFloat(h.details.replace(/\D/g,'')) || 0;
                if(h.date === today) todayPaid += amt;
                if(h.date.includes(selectedMonth.split('-')[1])) monthPaid += amt;
            }
        });
    });

    document.getElementById('fin-out').innerText = `KSh ${totalOut.toLocaleString()}`;
    document.getElementById('fin-today').innerText = `KSh ${todayPaid.toLocaleString()}`;
    document.getElementById('fin-month-val').innerText = `KSh ${monthPaid.toLocaleString()}`;
};

window.updateAccTotal = () => {
    const val = document.getElementById('acc-total-entry').value;
    set(ref(db, 'acc_total'), parseFloat(val));
};

// HELPERS
window.postPayment = async () => {
    const amt = parseFloat(document.getElementById('up-amt').value);
    const c = allClients.find(x => x.idNumber == activeID);
    const history = [...(c.history || []), {
        date: new Date().toLocaleDateString('en-GB'),
        activity: 'Payment',
        details: `Paid KSh ${amt}`,
        by: auth.currentUser.email.split('@')[0]
    }];
    await update(ref(db, 'jml_data/' + activeID), {
        balance: c.balance - amt,
        totalPaid: (c.totalPaid || 0) + amt,
        history
    });
    closeDetails();
};

window.settleLoan = async () => {
    await update(ref(db, 'jml_data/' + activeID), { 
        status: "Settled", 
        settleDate: new Date().toISOString().split('T')[0] 
    });
    closeDetails();
};

function populateStaffDropdown() {
    const staff = [...new Set(allClients.map(c => c.staff))];
    document.getElementById('staff-select').innerHTML = '<option value="">Select Employee</option>' + 
        staff.map(s => `<option value="${s}">${s}</option>`).join('');
}

window.renderTable = (list) => {
    document.getElementById('clientTableBody').innerHTML = list.filter(c => c.status === "Active").map((c, i) => `
        <tr><td>${i+1}</td><td>${c.name}</td><td>${c.idNumber}</td><td>${c.phone}</td><td>${c.totalPaid}</td><td>${c.balance}</td>
        <td><button class="btn-post" onclick="openDashboard('${c.idNumber}')">View</button></td></tr>
    `).join('');
};

window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
};
window.closeDetails = () => document.getElementById('detailWindow').classList.add('hidden');
window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('active');
window.toggleTheme = () => document.body.classList.toggle('dark-mode');
window.handleLogin = () => signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value);
window.handleLogout = () => signOut(auth).then(() => location.reload());
