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

let currentClientID = null;
let allClients = [];

// Authentication Logic
window.handleLogin = () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, email, pass).catch(err => alert(err.message));
};

onAuthStateChanged(auth, user => {
    if(user) {
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('main-wrapper').classList.remove('hidden');
        document.getElementById('current-user-email').innerText = user.email;
        loadData();
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
        document.getElementById('main-wrapper').classList.add('hidden');
    }
});

// Load Clients and Filter by User Role
function loadData() {
    onValue(ref(db, 'jml_data'), (snapshot) => {
        const data = snapshot.val();
        allClients = data ? Object.values(data) : [];
        renderClientTable();
        calcFinance();
    });
}

function renderClientTable() {
    const tbody = document.getElementById('clientTableBody');
    const user = auth.currentUser;
    
    // Employee logic: Only see their own enrollments. Admin sees all.
    const filtered = (user.email === 'admin@jml.com') ? allClients : allClients.filter(c => c.enrolledBy === user.email);

    tbody.innerHTML = filtered.map((c, i) => `
        <tr>
            <td>${i+1}</td>
            <td>${c.name}</td>
            <td>${c.idNumber}</td>
            <td>${c.phone}</td>
            <td>Ksh ${c.totalPaid || 0}</td>
            <td>Ksh ${c.balance || 0}</td>
            <td><button class="btn-main" onclick="openClient('${c.idNumber}')">VIEW</button></td>
        </tr>
    `).join('');
}

// Client Enrollment
window.enrollClient = () => {
    const id = document.getElementById('e-id').value;
    const princ = parseFloat(document.getElementById('e-princ').value);
    
    const clientData = {
        name: document.getElementById('e-name').value,
        phone: document.getElementById('e-phone').value,
        idNumber: id,
        location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value,
        referral: document.getElementById('e-ref').value,
        principal: princ,
        balance: princ,
        totalPaid: 0,
        startDate: document.getElementById('e-start').value,
        endDate: document.getElementById('e-end').value,
        status: 'Active',
        enrolledBy: auth.currentUser.email,
        history: [{
            date: new Date().toLocaleDateString(),
            activity: 'Account Created',
            details: `Loan of Ksh ${princ} initiated`,
            time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            by: auth.currentUser.email
        }]
    };

    set(ref(db, 'jml_data/' + id), clientData).then(() => {
        alert("Client Enrolled Successfully");
        showSec('list-sec', document.querySelector('.nav-item'));
    });
};

// Client Detailed View (Box Layout)
window.openClient = (id) => {
    const c = allClients.find(x => x.idNumber == id);
    currentClientID = id;
    
    document.getElementById('v-name').innerText = c.name;
    document.getElementById('v-id').innerText = c.idNumber;
    document.getElementById('v-up').innerText = c.lastUpdated || 'Never';
    document.getElementById('v-pri').innerText = `Ksh ${c.principal}`;
    document.getElementById('v-paid').innerText = `Ksh ${c.totalPaid}`;
    document.getElementById('v-bal').innerText = `Ksh ${c.balance}`;
    document.getElementById('v-next').innerText = c.nextPayment || 'Manual Entry Needed';
    document.getElementById('v-officer').value = c.enrolledBy;
    document.getElementById('v-notes').value = c.notes || '';

    // History rendering with Late Highlighting (Red after 6 PM)
    document.getElementById('v-history-body').innerHTML = (c.history || []).map(h => {
        const isLate = h.time && h.time.includes('PM') && parseInt(h.time) >= 6;
        return `
            <tr class="${isLate ? 'late-payment' : ''}">
                <td>${h.date}</td><td>${h.activity}</td><td>${h.details}</td><td>${h.time}</td><td>${h.by}</td>
            </tr>
        `;
    }).join('');

    document.getElementById('view-modal').classList.remove('hidden');
};

// Update Logic (Payments / New Loan)
window.postAction = (type) => {
    const client = allClients.find(x => x.idNumber == currentClientID);
    const amt = parseFloat(document.getElementById('u-amt').value) || 0;
    const time = document.getElementById('u-time').value;
    const nextPay = document.getElementById('u-next').value;

    let updates = {
        lastUpdated: new Date().toLocaleString(),
        notes: document.getElementById('v-notes').value,
        status: document.getElementById('v-status').value
    };

    if(type === 'Payment') {
        updates.totalPaid = (client.totalPaid || 0) + amt;
        updates.balance = client.balance - amt;
        updates.nextPayment = nextPay;
        updates.history = [...client.history, {
            date: new Date().toLocaleDateString(),
            activity: 'Payment Received',
            details: `Ksh ${amt} paid`,
            time: time,
            by: auth.currentUser.email
        }];
    }
    
    if(type === 'Delete') {
        if(confirm("Permanently delete this profile?")) {
            remove(ref(db, 'jml_data/' + currentClientID));
            closeModal();
            return;
        }
    }

    update(ref(db, 'jml_data/' + currentClientID), updates).then(() => {
        openClient(currentClientID);
        alert("System Updated");
    });
};

// Financial Calculations (As per 9-Card Sketch)
function calcFinance() {
    let grandOut = 0;
    let paidToday = 0;
    const today = new Date().toLocaleDateString();

    allClients.forEach(c => {
        grandOut += parseFloat(c.principal || 0);
        (c.history || []).forEach(h => {
            if(h.date === today && h.activity === 'Payment Received') {
                const val = parseFloat(h.details.replace(/[^0-9.]/g, ''));
                paidToday += val;
            }
        });
    });

    document.getElementById('f-out').innerText = `Ksh ${grandOut}`;
    document.getElementById('f-today').innerText = `Ksh ${paidToday}`;
}

// Sidebar & Theme Toggles
window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('minimized');
window.toggleTheme = () => document.getElementById('app-body').classList.toggle('dark-mode');
window.showSec = (id, el) => {
    document.querySelectorAll('.content-panel').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
};
window.closeModal = () => document.getElementById('view-modal').classList.add('hidden');
window.logout = () => signOut(auth);
