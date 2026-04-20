import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, onValue, update, remove, get } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

// YOUR FIREBASE CONFIG
const firebaseConfig = {
    apiKey: "AIzaSy...", // Replace with your actual key
    authDomain: "jml-loans.firebaseapp.com",
    databaseURL: "https://jml-loans-default-rtdb.firebaseio.com",
    projectId: "jml-loans",
    storageBucket: "jml-loans.appspot.com",
    messagingSenderId: "...",
    appId: "..."
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

let currentClients = [];
let activeClientID = null;

// --- AUTH HANDLERS ---
window.handleLogin = () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, e, p).catch(err => alert(err.message));
};

onAuthStateChanged(auth, user => {
    if(user) {
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        fetchData();
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
    }
});

// --- DATA FETCHING ---
function fetchData() {
    onValue(ref(db, 'clients'), (snapshot) => {
        const data = snapshot.val();
        currentClients = data ? Object.values(data) : [];
        renderList(currentClients);
        updateFinancials();
    });
}

// --- CORE LOGIC: 6PM HIGHLIGHTING ---
function isLate(timeString) {
    if(!timeString) return false;
    const [hours] = timeString.split(':').map(Number);
    return hours >= 18; // 6:00 PM onwards
}

function renderList(list) {
    const tbody = document.getElementById('clientTableBody');
    tbody.innerHTML = list.map((c, i) => `
        <tr>
            <td>${i+1}</td>
            <td>${c.name}</td>
            <td>${c.idNum}</td>
            <td>${c.phone}</td>
            <td>KSh ${c.totalPaid || 0}</td>
            <td>KSh ${c.balance || 0}</td>
            <td><button class="btn-post" onclick="openDashboard('${c.idNum}')">View</button></td>
        </tr>
    `).join('');
}

// --- MODAL DASHBOARD ---
window.openDashboard = (id) => {
    const client = currentClients.find(c => c.idNum === id);
    activeClientID = id;
    
    document.getElementById('v-name').innerText = client.name;
    document.getElementById('v-id').innerText = client.idNum;
    document.getElementById('v-last').innerText = client.lastUpdated || "Never";
    
    // Fill Info Boxes
    document.getElementById('vi-name').innerText = client.name;
    document.getElementById('vi-id').innerText = client.idNum;
    document.getElementById('vi-loc').innerText = client.location;
    document.getElementById('vl-princ').innerText = client.principal;
    document.getElementById('vl-bal').innerText = client.balance;
    document.getElementById('vl-next').innerText = client.nextPayment || "Not Set";

    // Payment History with Highlighting
    const hBody = document.getElementById('historyBody');
    hBody.innerHTML = (client.history || []).map(h => {
        let cls = isLate(h.time) ? 'late-payment' : '';
        if(h.activity === 'Loan Started') cls += ' new-loan-row';
        
        return `<tr class="${cls}">
            <td>${h.date}</td>
            <td>${h.activity}</td>
            <td>${h.details}</td>
            <td>${h.time}</td>
            <td>${h.user}</td>
        </tr>`;
    }).join('');

    document.getElementById('detailWindow').classList.remove('hidden');
};

// --- UPDATING PAYMENTS ---
window.postPayment = async () => {
    const amt = parseFloat(document.getElementById('up-amt').value);
    const time = document.getElementById('up-time').value;
    const nextPay = document.getElementById('up-next-date').value;

    if(!amt || !time || !nextPay) return alert("All fields including Next Payment Date are compulsory!");

    const clientRef = ref(db, `clients/${activeClientID}`);
    const snap = await get(clientRef);
    const client = snap.val();

    const newHistory = {
        date: new Date().toLocaleDateString(),
        activity: "Repayment",
        details: `Paid KSh ${amt}`,
        time: time,
        user: auth.currentUser.email.split('@')[0]
    };

    const updates = {
        totalPaid: (client.totalPaid || 0) + amt,
        balance: (client.balance || client.principal) - amt,
        nextPayment: `KSh 200 due on ${nextPay}`,
        lastUpdated: `${new Date().toLocaleDateString()} ${time}`,
        history: [...(client.history || []), newHistory]
    };

    await update(clientRef, updates);
    alert("Record Saved!");
    openDashboard(activeClientID);
};

// --- CONFIRMATION PROMPTS ---
window.confirmAction = (fn) => {
    if(confirm("Are you sure you want to proceed with this action?")) {
        fn();
    }
};

window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
};
