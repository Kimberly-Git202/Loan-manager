import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, onValue, update } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
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
        if (data) {
            allClients = Object.values(data);
            renderTable(allClients);
            populateStaffDropdown();
            calculateFinancials();
        }
    });
}

// Spaced Enrollment Save
window.enrollClient = async () => {
    const idNum = document.getElementById('e-id').value.trim();
    const name = document.getElementById('e-name').value.trim();
    if(!idNum || !name) return alert("Fill Name and ID!");

    const clientData = {
        name: name,
        phone: document.getElementById('e-phone').value,
        idNumber: idNum,
        location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value,
        referral: document.getElementById('e-ref').value,
        principal: parseFloat(document.getElementById('e-princ').value) || 0,
        balance: parseFloat(document.getElementById('e-princ').value) || 0,
        totalPaid: 0,
        startDate: document.getElementById('e-start').value || new Date().toISOString().split('T')[0],
        status: "Active",
        staff: auth.currentUser.email.split('@')[0],
        history: [{
            date: new Date().toLocaleDateString('en-GB'),
            activity: 'Enrollment',
            details: `Started KSh ${document.getElementById('e-princ').value}`,
            by: auth.currentUser.email.split('@')[0]
        }]
    };

    await set(ref(db, 'jml_data/' + idNum), clientData);
    alert("Success!");
    document.querySelectorAll('#add-sec input').forEach(i => i.value = "");
    showSection('list-sec');
};

// Staff Dropdown Logic
function populateStaffDropdown() {
    const staffSelect = document.getElementById('staff-select');
    const uniqueStaff = [...new Set(allClients.map(c => c.staff))];
    staffSelect.innerHTML = '<option value="">-- Choose Employee --</option>' + 
        uniqueStaff.map(s => `<option value="${s}">${s.toUpperCase()}</option>`).join('');
}

window.renderStaffReport = () => {
    const selected = document.getElementById('staff-select').value;
    const tbody = document.getElementById('staffReportTableBody');
    const filtered = allClients.filter(c => c.staff === selected);
    
    tbody.innerHTML = filtered.map(c => `
        <tr>
            <td>${c.name}</td><td>${c.idNumber}</td><td>${c.phone}</td>
            <td>KSh ${c.principal}</td>
            <td><button class="btn-post" onclick="openDashboard('${c.idNumber}')">View</button></td>
        </tr>
    `).join('');
};

// Weekly Loans Sorting
window.renderWeeklyLoans = () => {
    const month = document.getElementById('loan-month-select').value; // YYYY-MM
    const week = parseInt(document.getElementById('loan-week-select').value);
    const tbody = document.getElementById('weeklyLoanBody');
    
    const filtered = allClients.filter(c => {
        if (!c.startDate.startsWith(month)) return false;
        const day = parseInt(c.startDate.split('-')[2]);
        if (week === 1) return day <= 7;
        if (week === 2) return day > 7 && day <= 14;
        if (week === 3) return day > 14 && day <= 21;
        return day > 21;
    });

    tbody.innerHTML = filtered.map(c => `
        <tr><td>${c.name}</td><td>${c.idNumber}</td><td>KSh ${c.principal}</td></tr>
    `).join('');
};

// Settled Archive
window.renderSettled = () => {
    const month = document.getElementById('settled-month-select').value;
    const tbody = document.getElementById('settledTableBody');
    const filtered = allClients.filter(c => c.status === "Settled" && c.settleDate?.startsWith(month));

    tbody.innerHTML = filtered.map(c => `
        <tr><td>${c.name}</td><td>${c.idNumber}</td><td>KSh ${c.totalPaid}</td><td>${c.settleDate}</td></tr>
    `).join('');
};

window.renderTable = (list) => {
    const tbody = document.getElementById('clientTableBody');
    tbody.innerHTML = list.filter(c => c.status === "Active").map((c, i) => `
        <tr>
            <td>${i + 1}</td>
            <td><strong>${c.name}</strong></td>
            <td>${c.idNumber}</td>
            <td>${c.phone}</td>
            <td>KSh ${c.totalPaid}</td>
            <td>KSh ${c.balance.toLocaleString()}</td>
            <td><button class="btn-post" onclick="openDashboard('${c.idNumber}')">View</button></td>
        </tr>
    `).join('');
};

window.openDashboard = (id) => {
    const c = allClients.find(x => x.idNumber === id);
    activeID = id;
    document.getElementById('v-name').innerText = c.name;
    document.getElementById('v-id').innerText = c.idNumber;
    document.getElementById('vi-phone').innerText = c.phone;
    document.getElementById('vi-loc').innerText = c.location;
    document.getElementById('vl-princ').innerText = `KSh ${c.principal}`;
    document.getElementById('vl-bal').innerText = `KSh ${c.balance}`;
    
    document.getElementById('historyBody').innerHTML = (c.history || []).map(h => `
        <tr><td>${h.date}</td><td>${h.activity}</td><td>${h.details}</td><td>${h.by}</td></tr>
    `).join('');
    document.getElementById('detailWindow').classList.remove('hidden');
};

window.postPayment = async () => {
    const amt = parseFloat(document.getElementById('up-amt').value);
    const c = allClients.find(x => x.idNumber === activeID);
    const newHistory = [...(c.history || []), {
        date: new Date().toLocaleDateString('en-GB'),
        activity: 'Payment',
        details: `Paid KSh ${amt}`,
        by: auth.currentUser.email.split('@')[0]
    }];
    await update(ref(db, 'jml_data/' + activeID), {
        balance: c.balance - amt,
        totalPaid: (c.totalPaid || 0) + amt,
        history: newHistory
    });
    alert("Paid!");
    closeDetails();
};

window.settleLoan = async () => {
    await update(ref(db, 'jml_data/' + activeID), { 
        status: "Settled", 
        settleDate: new Date().toISOString().split('T')[0] 
    });
    alert("Settled!");
    closeDetails();
};

// UI Toggles
window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
};
window.closeDetails = () => document.getElementById('detailWindow').classList.add('hidden');
window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('active');
window.toggleTheme = () => document.body.classList.toggle('dark-mode');
window.handleLogin = () => signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value);
window.handleLogout = () => signOut(auth).then(() => location.reload());
