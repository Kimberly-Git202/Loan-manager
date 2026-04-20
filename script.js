import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, onValue, get } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
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
        document.getElementById('user-display').innerText = `Logged: ${user.email}`;
        loadData();
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
    }
});

function loadData() {
    onValue(ref(db, 'jml_data'), (snap) => {
        const data = snap.val() || {};
        const currentUser = auth.currentUser.email.split('@')[0];
        const rawArray = Object.values(data);

        // 1. Logic for Client List View (Staff vs Admin)
        if (currentUser === 'admin') {
            allClients = rawArray;
        } else {
            allClients = rawArray.filter(c => c.enrolledBy === currentUser);
        }

        // 2. Populate Reports Dropdown with unique staff names
        const staffList = [...new Set(rawArray.map(c => c.enrolledBy))];
        const dropdown = document.getElementById('staff-report-dropdown');
        dropdown.innerHTML = '<option value="">Select Staff Member</option>' + 
            staffList.map(s => `<option value="${s}">${s}</option>`).join('');

        renderTable(allClients);
        renderWeeklyLoans();
        renderSettled();
    });
}

window.enrollClient = async () => {
    const idNum = document.getElementById('e-id').value.trim();
    const name = document.getElementById('e-name').value.trim();
    if(!idNum || !name) return alert("Fill ID and Name!");

    const clientData = {
        name, idNumber: idNum,
        phone: document.getElementById('e-phone').value,
        location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value,
        referral: document.getElementById('e-ref').value,
        principal: parseFloat(document.getElementById('e-princ').value) || 0,
        balance: parseFloat(document.getElementById('e-princ').value) || 0,
        startDate: document.getElementById('e-start').value,
        status: "Active",
        enrolledBy: auth.currentUser.email.split('@')[0],
        history: [{
            date: new Date().toLocaleDateString('en-GB'),
            activity: 'Enrolled',
            by: auth.currentUser.email.split('@')[0]
        }]
    };

    await set(ref(db, 'jml_data/' + idNum), clientData);
    alert("Enrolled Successfully");
    window.showSection('list-sec');
};

// Weekly Logic (Week 1: 1-7, Week 2: 8-14...)
window.renderWeeklyLoans = () => {
    const month = document.getElementById('loan-month-select').value;
    const week = parseInt(document.getElementById('loan-week-select').value);
    const container = document.getElementById('weeklyLoanContainer');

    if(!month) return container.innerHTML = "Select a month";

    const filtered = allClients.filter(c => {
        if(!c.startDate) return false;
        const [y, m, d] = c.startDate.split('-');
        const clientMonth = `${y}-${m}`;
        const day = parseInt(d);
        const inMonth = clientMonth === month;
        const inWeek = day > (week-1)*7 && day <= week*7;
        return inMonth && inWeek;
    });

    container.innerHTML = filtered.map(c => `
        <tr><td>${c.name}</td><td>${c.idNumber}</td><td>KSh ${c.principal}</td></tr>
    `).join('') || "<tr><td colspan='3'>No loans this week</td></tr>";
};

window.renderSettled = () => {
    const month = document.getElementById('settled-month-select').value;
    const container = document.getElementById('settledContainer');
    const settled = allClients.filter(c => c.status === "Settled"); // Add your settlement logic here

    container.innerHTML = settled.map(c => `
        <tr><td>${c.name}</td><td>${c.idNumber}</td><td>KSh ${c.totalPaid || 0}</td><td>${c.clearedDate || '-'}</td></tr>
    `).join('') || "<tr><td colspan='4'>No settled loans</td></tr>";
};

window.renderStaffReport = () => {
    const selectedStaff = document.getElementById('staff-report-dropdown').value;
    const body = document.getElementById('staffReportBody');
    
    onValue(ref(db, 'jml_data'), (snap) => {
        const data = Object.values(snap.val() || {});
        const filtered = data.filter(c => c.enrolledBy === selectedStaff);
        
        body.innerHTML = filtered.map(c => `
            <tr>
                <td>${c.name}</td><td>${c.idNumber}</td><td>${c.phone}</td>
                <td>KSh ${c.principal}</td>
                <td><button class="btn-post" onclick="openDashboard('${c.idNumber}')">View</button></td>
            </tr>
        `).join('');
    });
};

window.renderTable = (list) => {
    const tbody = document.getElementById('clientTableBody');
    tbody.innerHTML = list.map((c, i) => `
        <tr>
            <td>${i + 1}</td>
            <td><strong>${c.name}</strong></td>
            <td>${c.idNumber}</td>
            <td>${c.phone}</td>
            <td>KSh ${c.totalPaid || 0}</td>
            <td>KSh ${c.balance}</td>
            <td><button class="btn-post" onclick="openDashboard('${c.idNumber}')">View</button></td>
        </tr>
    `).join('');
};

window.openDashboard = (id) => {
    const c = allClients.find(x => x.idNumber === id);
    if(!c) return;
    document.getElementById('v-name').innerText = c.name;
    document.getElementById('vi-id').innerText = c.idNumber;
    document.getElementById('vi-phone').innerText = c.phone;
    document.getElementById('vl-princ').innerText = c.principal;
    document.getElementById('vl-bal').innerText = c.balance;
    document.getElementById('detailWindow').classList.remove('hidden');
};

window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
};

window.closeDetails = () => document.getElementById('detailWindow').classList.add('hidden');
window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('active');
window.handleLogin = () => { /* Your login logic */ };
window.handleLogout = () => signOut(auth).then(() => location.reload());
