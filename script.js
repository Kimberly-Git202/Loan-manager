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
let isAdmin = false;

// 1. AUTH & INITIALIZATION
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        document.getElementById('user-display').innerText = user.email;
        const snap = await get(ref(db, `jml_users/${user.uid}`));
        isAdmin = (snap.val()?.role === 'admin');
        loadData();
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
    }
});

// 2. DATA LOADING
function loadData() {
    onValue(ref(db, 'jml_data'), (snap) => {
        const data = snap.val() || {};
        allClients = Object.values(data);
        renderTable(allClients);
        calculateFinancials();
    });
}

// 3. TABLE RENDERING (With 6PM & Overdue Logic)
function renderTable(list) {
    const tbody = document.getElementById('clientTableBody');
    const now = new Date();
    const isLateTime = now.getHours() >= 18; 
    const todayStr = now.toLocaleDateString('en-GB');

    tbody.innerHTML = list.map((c, i) => {
        const hasPaidToday = (c.history || []).some(h => h.date === todayStr && h.activity === 'Payment');
        
        // Logic for Red Highlight
        let rowClass = "";
        if (isLateTime && !hasPaidToday) rowClass = "late-row";
        if (c.nextPaymentDate && new Date(c.nextPaymentDate) < now && !hasPaidToday) rowClass = "late-row";

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
}

// 4. CLIENT DASHBOARD LOGIC
window.openDashboard = (id) => {
    const c = allClients.find(x => x.idNumber === id);
    activeID = id;
    
    document.getElementById('v-name').innerText = c.name;
    document.getElementById('v-id').innerText = c.idNumber;
    document.getElementById('v-last').innerText = c.lastUpdated || "N/A";
    
    // Bio
    document.getElementById('vi-name').innerText = c.name;
    document.getElementById('vi-id').innerText = c.idNumber;
    document.getElementById('vi-phone').innerText = c.phone;
    document.getElementById('vi-loc').innerText = c.location;
    document.getElementById('vi-occ').innerText = c.occupation;
    document.getElementById('vi-ref').innerText = c.referral;

    // Loans
    document.getElementById('vl-princ').innerText = `KSh ${c.principal}`;
    document.getElementById('vl-paid').innerText = `KSh ${c.totalPaid || 0}`;
    document.getElementById('vl-bal').innerText = `KSh ${c.balance}`;
    document.getElementById('vl-next').innerText = c.nextPaymentStr || "Not Scheduled";

    // History
    const hBody = document.getElementById('historyBody');
    hBody.innerHTML = (c.history || []).map(h => {
        const isLateRow = (parseInt(h.time?.split(':')[0]) >= 18) ? 'late-row' : '';
        const startClass = (h.activity === 'Loan Started') ? 'new-loan-row' : '';
        return `<tr class="${isLateRow} ${startClass}">
            <td>${h.date}</td>
            <td>${h.activity}</td>
            <td>${h.details}</td>
            <td>${h.time}</td>
            <td>${h.by}</td>
        </tr>`;
    }).join('');

    document.getElementById('detailWindow').classList.remove('hidden');
};

// 5. UPDATE RECORDS (Manual Time & Next Payment)
window.postPayment = async () => {
    const amt = parseFloat(document.getElementById('up-amt').value) || 0;
    const time = document.getElementById('up-time').value;
    const nextDate = document.getElementById('up-next-date').value;

    if(!time || !nextDate) return alert("Time and Next Payment Date are COMPULSORY.");

    const c = allClients.find(x => x.idNumber === activeID);
    
    const newEntry = {
        date: new Date().toLocaleDateString('en-GB'),
        activity: "Payment",
        details: `Repayment of KSh ${amt}`,
        time: time,
        by: auth.currentUser.email.split('@')[0]
    };

    c.totalPaid = (c.totalPaid || 0) + amt;
    c.balance -= amt;
    c.nextPaymentDate = nextDate;
    c.nextPaymentStr = `KSh 200 due on ${nextDate}`;
    c.lastUpdated = `${newEntry.date} at ${time}`;
    if(!c.history) c.history = [];
    c.history.push(newEntry);

    await set(ref(db, `jml_data/${c.idNumber}`), c);
    alert("Record Updated Successfully");
    openDashboard(activeID);
};

// 6. ENROLLMENT
window.enrollClient = async () => {
    const id = document.getElementById('e-id').value;
    const princ = parseFloat(document.getElementById('e-princ').value);
    
    const newClient = {
        name: document.getElementById('e-name').value,
        phone: document.getElementById('e-phone').value,
        idNumber: id,
        location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value,
        referral: document.getElementById('e-ref').value,
        principal: princ,
        balance: princ * 1.2, // Example 20% interest
        startDate: document.getElementById('e-start').value,
        endDate: document.getElementById('e-end').value,
        status: "Active",
        history: [{
            date: new Date().toLocaleDateString('en-GB'),
            activity: "Loan Started",
            details: `Initial Loan of KSh ${princ}`,
            time: "Enrollment",
            by: auth.currentUser.email.split('@')[0]
        }]
    };

    await set(ref(db, `jml_data/${id}`), newClient);
    alert("Client Enrolled!");
    showSection('list-sec');
};

// 7. FINANCIALS & WEEKLY SORTING
window.calculateFinancials = () => {
    const month = document.getElementById('fin-month').value;
    let totalOut = 0, todayPaid = 0, monthPaid = 0;
    const today = new Date().toLocaleDateString('en-GB');

    allClients.forEach(c => {
        totalOut += c.balance;
        (c.history || []).forEach(h => {
            if(h.date === today && h.activity === "Payment") todayPaid += (h.amt || 0);
            if(h.date.includes(month) && h.activity === "Payment") monthPaid += (h.amt || 0);
        });
    });

    document.getElementById('fin-out').innerText = `KSh ${totalOut.toLocaleString()}`;
    document.getElementById('fin-today').innerText = `KSh ${todayPaid.toLocaleString()}`;
    document.getElementById('fin-month-val').innerText = `KSh ${monthPaid.toLocaleString()}`;
};

// 8. UTILS
window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
};

window.confirmAction = (fn) => { if(confirm("Confirm this transaction?")) fn(); };
window.toggleTheme = () => document.body.classList.toggle('dark-mode');
window.closeDetails = () => document.getElementById('detailWindow').classList.add('hidden');
window.handleLogin = () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, e, p).catch(err => alert("Login Failed: " + err.message));
};
window.handleLogout = () => signOut(auth);
