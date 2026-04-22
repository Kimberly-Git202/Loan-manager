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
let currentClientID = null;

// --- AUTHENTICATION ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        document.getElementById('current-user-name').innerText = user.email.split('@')[0];
        loadData();
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
    }
});

// --- CORE DATA LOADING ---
function loadData() {
    onValue(ref(db, 'jml_data'), (snap) => {
        const data = snap.val();
        allClients = [];
        if (data) {
            Object.values(data).forEach(userGroup => {
                Object.values(userGroup).forEach(client => {
                    if (client.idNumber) allClients.push(client);
                });
            });
        }
        renderTable(allClients);
        updateFinancials();
    });
}

// --- RENDER CLIENTS TABLE ---
function renderTable(list) {
    const tbody = document.getElementById('clientTableBody');
    tbody.innerHTML = list.map((c, i) => `
        <tr>
            <td>${i + 1}</td>
            <td><b>${c.name}</b></td>
            <td>${c.idNumber}</td>
            <td>${c.phone}</td>
            <td>KSh ${Number(c.totalPaid || 0).toLocaleString()}</td>
            <td>KSh ${Number(c.balance || 0).toLocaleString()}</td>
            <td><button class="btn-post" onclick="viewClient('${c.idNumber}')">View</button></td>
        </tr>
    `).join('');
}

// --- VIEW CLIENT LOGIC ---
window.viewClient = (id) => {
    const c = allClients.find(x => x.idNumber === id);
    if (!c) return;
    currentClientID = id;

    // Set Header & Bio
    document.getElementById('v-name').innerText = c.name;
    document.getElementById('v-id').innerText = c.idNumber;
    document.getElementById('v-last').innerText = c.lastUpdated || "Never";
    document.getElementById('v-status').value = c.status || "Active";
    document.getElementById('vi-loc').innerText = c.location || "N/A";
    document.getElementById('vi-occ').innerText = c.occupation || "N/A";
    document.getElementById('vi-ref').innerText = c.referral || "N/A";
    
    // Set Loan Data
    document.getElementById('vi-princ').innerText = Number(c.principal).toLocaleString();
    document.getElementById('vi-paid').innerText = Number(c.totalPaid || 0).toLocaleString();
    document.getElementById('vi-bal').innerText = Number(c.balance).toLocaleString();
    document.getElementById('vi-next').value = c.nextPayment || "";
    document.getElementById('vi-officer').value = c.loanOfficer || "Admin";
    document.getElementById('vi-notes').value = c.notes || "";

    renderHistory(c.history || []);
    document.getElementById('viewModal').classList.remove('hidden');
};

// --- PAYMENT HISTORY & HIGHLIGHTING ---
function renderHistory(history) {
    const tbody = document.getElementById('v-history-body');
    tbody.innerHTML = history.map(h => {
        // Logic: Check if time is past 6 PM (18:00)
        let isLate = false;
        if (h.time) {
            const hour = parseInt(h.time.split(':')[0]);
            if (hour >= 18) isLate = true;
        }

        const rowClass = h.activity === 'Loan Started' ? 'new-loan-row' : (isLate || h.activity === 'NO PAYMENT' ? 'late-payment' : '');
        
        return `<tr class="${rowClass}">
            <td>${h.date}</td>
            <td>${h.activity}</td>
            <td>${h.details}</td>
            <td>${h.time || '--:--'}</td>
            <td>${h.by}</td>
        </tr>`;
    }).reverse().join('');
}

// --- RECORD PAYMENT ---
window.recordPayment = async () => {
    if (!confirm("Are you sure you want to post this payment?")) return;
    const amt = parseFloat(document.getElementById('post-amt').value);
    const time = document.getElementById('post-time').value;
    const c = allClients.find(x => x.idNumber === currentClientID);

    const newPayment = {
        date: new Date().toLocaleDateString('en-GB'),
        activity: "Payment Received",
        details: `KSh ${amt} paid`,
        time: time,
        by: auth.currentUser.email.split('@')[0]
    };

    c.totalPaid = (parseFloat(c.totalPaid) || 0) + amt;
    c.balance = parseFloat(c.balance) - amt;
    c.lastUpdated = new Date().toLocaleString();
    if (!c.history) c.history = [];
    c.history.push(newPayment);

    await set(ref(db, `jml_data/${auth.currentUser.uid}/${currentClientID}`), c);
    document.getElementById('post-amt').value = "";
    viewClient(currentClientID);
};

// --- SETTLE LOAN ---
window.settleLoanAction = async () => {
    if (!confirm("Mark this loan as fully settled?")) return;
    const c = allClients.find(x => x.idNumber === currentClientID);
    c.status = "Settled";
    c.clearedDate = new Date().toLocaleDateString('en-GB');
    c.balance = 0;
    
    await set(ref(db, `jml_data/${auth.currentUser.uid}/${currentClientID}`), c);
    alert("Loan Settled and Archived.");
    closeModal();
};

// --- SEARCH ---
window.doSearch = () => {
    const term = document.getElementById('globalSearch').value.toLowerCase();
    const filtered = allClients.filter(c => c.name.toLowerCase().includes(term) || c.idNumber.includes(term));
    renderTable(filtered);
};

// --- UI UTILS ---
window.showSection = (id, el) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
};
window.closeModal = () => document.getElementById('viewModal').classList.add('hidden');
window.toggleTheme = () => document.body.classList.toggle('dark-mode');
