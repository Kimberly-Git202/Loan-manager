import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, onValue, update, get, remove } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

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
let isAdmin = false;

// AUTH MONITOR
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('main-app').classList.remove('hidden');
        document.getElementById('user-email-display').innerText = user.email;
        const snap = await get(ref(db, `jml_users/${user.uid}`));
        isAdmin = (snap.val()?.role === 'admin');
        if(isAdmin) document.getElementById('admin-panel').classList.remove('hidden');
        loadData();
        setupSettledMonths();
    } else {
        document.getElementById('login-overlay').style.display = 'flex';
        document.getElementById('main-app').classList.add('hidden');
    }
});

function loadData() {
    onValue(ref(db, 'jml_data'), (snap) => {
        const data = snap.val() || {};
        allClients = [];
        Object.keys(data).forEach(uid => {
            Object.values(data[uid]).forEach(c => allClients.push(c));
        });
        renderTable(allClients);
        updateFinancials();
    });
}

// RENDER MAIN TABLE WITH 6PM LOGIC
function renderTable(list) {
    const tbody = document.getElementById('clientTableBody');
    const todayStr = new Date().toLocaleDateString('en-GB');
    const now = new Date();
    const isPast6PM = now.getHours() >= 18;

    tbody.innerHTML = list.map((c, i) => {
        const lastPay = (c.history || []).filter(h => h.activity === 'Payment').slice(-1)[0];
        const hasPaidToday = lastPay && lastPay.date === todayStr;
        
        // Highlight logic: If past 6PM and no payment recorded today
        const shouldHighlight = isPast6PM && !hasPaidToday;

        return `
            <tr style="${shouldHighlight ? 'background: #ffdce0; border-left: 5px solid red;' : ''}">
                <td>${i+1}</td>
                <td style="font-weight:bold">${c.name}</td>
                <td>${c.idNumber}</td>
                <td>KSh ${c.balance.toLocaleString()}</td>
                <td><span class="badge ${hasPaidToday ? 'success' : 'danger'}">${hasPaidToday ? 'Updated' : 'Pending'}</span></td>
                <td><button class="btn-view" onclick="openDashboard('${c.idNumber}')">View</button></td>
            </tr>
        `;
    }).join('');
}

// SEARCH
window.searchClients = () => {
    const term = document.getElementById('globalSearch').value.toLowerCase();
    const filtered = allClients.filter(c => 
        c.name.toLowerCase().includes(term) || c.idNumber.includes(term)
    );
    renderTable(filtered);
};

// SETTINGS: ADMIN ONLY PASSWORD RESET
window.adminResetPassword = () => {
    if(!isAdmin) return alert("Unauthorized");
    const email = document.getElementById('reset-email').value;
    sendPasswordResetEmail(auth, email).then(() => alert("Reset email sent!")).catch(e => alert(e.message));
};

// PAYMENT PROCESSING
window.processPayment = async () => {
    const amt = parseFloat(document.getElementById('payAmt').value);
    const time = document.getElementById('payTime').value;
    const activity = document.getElementById('payActivity').value;
    const c = allClients.find(x => x.idNumber === activeID);

    if(!amt || !time || !c) return alert("Please fill amount and time");

    if(activity === 'Payment') c.balance -= amt;
    
    if(!c.history) c.history = [];
    c.history.push({
        date: new Date().toLocaleDateString('en-GB'),
        time: time,
        amt: amt,
        activity: activity,
        by: auth.currentUser.email.split('@')[0]
    });

    await set(ref(db, `jml_data/${c.ownerId}/${c.idNumber}`), c);
    document.getElementById('payAmt').value = "";
    openDashboard(activeID);
};

// SETTLE VS NEW LOAN
window.settleLoanOnly = async () => {
    const c = allClients.find(x => x.idNumber === activeID);
    if(!confirm("Settle this loan? Profile will stay but balance will be 0.")) return;
    
    const archive = { 
        clearedDate: new Date().toLocaleDateString('en-GB'), 
        principal: c.principal, 
        totalPaid: c.principal * 1.25 - c.balance 
    };
    if(!c.pastLoans) c.pastLoans = [];
    c.pastLoans.push(archive);
    
    c.balance = 0;
    c.status = "Inactive";
    await set(ref(db, `jml_data/${c.ownerId}/${c.idNumber}`), c);
    closeDetails();
};

window.startNewLoan = async () => {
    const c = allClients.find(x => x.idNumber === activeID);
    const newPrinc = prompt("Enter New Loan Principal Amount:");
    if(!newPrinc) return;

    c.principal = parseFloat(newPrinc);
    c.balance = c.principal * 1.25;
    c.status = "Active Member";
    c.history.push({
        date: new Date().toLocaleDateString('en-GB'),
        activity: "Loan Started",
        amt: c.principal,
        time: "---",
        by: auth.currentUser.email.split('@')[0]
    });

    await set(ref(db, `jml_data/${c.ownerId}/${c.idNumber}`), c);
    openDashboard(activeID);
};

// UI UTILS
window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    event.currentTarget.classList.add('active');
};




