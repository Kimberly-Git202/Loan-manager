import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, onValue, get, push } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
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

// --- AUTH LOGIC ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        document.getElementById('user-email-display').innerText = user.email;
        loadData();
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
    }
});

window.handleLogin = () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, e, p).catch(err => alert("Login Failed: " + err.message));
};

// --- DATA LOGIC ---
function loadData() {
    // Listen for data changes in real-time
    onValue(ref(db, 'jml_data'), (snapshot) => {
        const data = snapshot.val();
        allClients = [];
        if (data) {
            Object.values(data).forEach(userLoans => {
                Object.values(userLoans).forEach(client => allClients.push(client));
            });
        }
        renderTable(allClients);
        calculateFinancials();
    });
}

function renderTable(list) {
    const tbody = document.getElementById('clientTableBody');
    const today = new Date().toLocaleDateString('en-GB');
    const isLate = new Date().getHours() >= 18;

    tbody.innerHTML = list.map((c, i) => {
        const hasPaid = (c.history || []).some(h => h.date === today && h.activity === 'Payment');
        return `
            <tr class="${isLate && !hasPaid ? 'late-row' : ''}">
                <td>${i+1}</td>
                <td><strong>${c.name}</strong></td>
                <td>${c.idNumber}</td>
                <td>KSh ${Number(c.balance).toLocaleString()}</td>
                <td><span class="status-dot ${hasPaid ? 'paid' : 'pending'}"></span> ${hasPaid ? 'Updated' : 'Pending'}</td>
                <td><button class="btn-save" onclick="openDashboard('${c.idNumber}')">View Details</button></td>
            </tr>
        `;
    }).join('');
}

// --- ADD CLIENT LOGIC ---
document.getElementById('clientForm').onsubmit = async (e) => {
    e.preventDefault();
    const idNum = document.getElementById('f-id').value;
    const principal = parseFloat(document.getElementById('f-loan').value);
    
    const newClient = {
        name: document.getElementById('f-name').value,
        idNumber: idNum,
        phone: document.getElementById('f-phone').value,
        location: document.getElementById('f-loc').value,
        occupation: document.getElementById('f-occ').value,
        referral: document.getElementById('f-ref').value,
        principal: principal,
        balance: principal * 1.2, // Example interest
        startDate: document.getElementById('f-start').value,
        endDate: document.getElementById('f-end').value,
        ownerId: auth.currentUser.uid,
        history: [{
            date: new Date().toLocaleDateString('en-GB'),
            activity: 'Loan Started',
            time: new Date().toLocaleTimeString(),
            amt: principal,
            by: auth.currentUser.email.split('@')[0]
        }]
    };

    await set(ref(db, `jml_data/${auth.currentUser.uid}/${idNum}`), newClient);
    alert("Client Added Successfully!");
    e.target.reset();
    showSection('list-sec', document.querySelector('.nav-item')); // Go back to portfolio
};

// --- DASHBOARD LOGIC ---
window.openDashboard = (id) => {
    const c = allClients.find(x => x.idNumber === id);
    if(!c) return;
    activeID = id;

    document.getElementById('d-name').innerText = c.name;
    document.getElementById('d-id-sub').innerText = `ID: ${c.idNumber}`;
    document.getElementById('d-phone').innerText = c.phone;
    document.getElementById('d-loc').innerText = c.location || 'N/A';
    document.getElementById('d-occ').innerText = c.occupation || 'N/A';
    document.getElementById('d-princ').innerText = c.principal.toLocaleString();
    document.getElementById('ed-balance').value = c.balance;

    const histBody = document.getElementById('historyBody');
    histBody.innerHTML = (c.history || []).map(h => `
        <tr>
            <td>${h.date}</td>
            <td>${h.activity}</td>
            <td>${h.time}</td>
            <td>KSh ${h.amt}</td>
            <td>${h.by}</td>
        </tr>
    `).reverse().join('');

    document.getElementById('detailWindow').classList.remove('hidden');
};

// --- UI UTILS ---
window.toggleSidebar = () => {
    document.getElementById('sidebar').classList.toggle('minimized');
};

window.showSection = (id, el) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if(el) el.classList.add('active');
};

window.closeDetails = () => document.getElementById('detailWindow').classList.add('hidden');
window.handleLogout = () => signOut(auth);
window.toggleTheme = () => document.body.classList.toggle('dark-mode');

// Financial Calculations
function calculateFinancials() {
    let totalOut = 0;
    let paidToday = 0;
    const today = new Date().toLocaleDateString('en-GB');

    allClients.forEach(c => {
        totalOut += Number(c.balance);
        (c.history || []).forEach(h => {
            if(h.date === today && h.activity === 'Payment') paidToday += Number(h.amt);
        });
    });

    document.getElementById('fin-out').innerText = `KSh ${totalOut.toLocaleString()}`;
    document.getElementById('fin-today').innerText = `KSh ${paidToday.toLocaleString()}`;
    document.getElementById('top-today-val').innerText = `Paid Today: KSh ${paidToday.toLocaleString()}`;
}
