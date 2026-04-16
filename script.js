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

onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('login-overlay').classList.add('hidden');
        const snap = await get(ref(db, `jml_users/${user.uid}`));
        isAdmin = (snap.val()?.role === 'admin');
        if(isAdmin) document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
        loadData();
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
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
    });
}

function renderTable(list) {
    const tbody = document.getElementById('clientTableBody');
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-GB');
    const isPast6PM = now.getHours() >= 18;

    tbody.innerHTML = list.map((c, i) => {
        const history = c.history || [];
        const paidToday = history.some(h => h.date === todayStr && h.type === 'Payment');
        const shouldHighlight = isPast6PM && !paidToday;

        return `
            <tr style="${shouldHighlight ? 'background:#ffebee; border-left: 5px solid red;' : ''}">
                <td>${i+1}</td>
                <td><strong>${c.name}</strong></td>
                <td>${c.idNumber}</td>
                <td>${c.balance}</td>
                <td>${paidToday ? '✅ Updated' : '❌ Pending'}</td>
                <td><button onclick="openDashboard('${c.idNumber}')">View</button></td>
            </tr>
        `;
    }).join('');
}

window.processPayment = async () => {
    const amt = parseFloat(document.getElementById('payAmt').value);
    const time = document.getElementById('payTime').value;
    const c = allClients.find(x => x.idNumber === activeID);
    if(!amt || !time) return alert("Fill amount and time");

    c.balance -= amt;
    if(!c.history) c.history = [];
    c.history.push({
        date: new Date().toLocaleDateString('en-GB'),
        type: 'Payment',
        time: time,
        amt: amt,
        by: auth.currentUser.email.split('@')[0]
    });

    await set(ref(db, `jml_data/${c.ownerId}/${c.idNumber}`), c);
    document.getElementById('payAmt').value = "";
    openDashboard(activeID);
};

window.settleLoanOnly = async () => {
    const c = allClients.find(x => x.idNumber === activeID);
    if(!confirm("Settle without new loan?")) return;
    
    const archive = { name: c.name, principal: c.principal, date: new Date().toLocaleDateString('en-GB') };
    await set(ref(db, `jml_settled/${Date.now()}`), archive);
    
    c.history.push({ date: archive.date, type: 'Cleared Loan', time: '--', amt: 0, by: 'System' });
    c.balance = 0;
    c.status = "Inactive";
    await set(ref(db, `jml_data/${c.ownerId}/${c.idNumber}`), c);
    closeDetails();
};

window.doSearch = () => {
    const term = document.getElementById('globalSearch').value.toLowerCase();
    const filtered = allClients.filter(c => c.name.toLowerCase().includes(term) || c.idNumber.includes(term));
    renderTable(filtered);
};

window.triggerReset = () => {
    const email = document.getElementById('reset-email').value;
    sendPasswordResetEmail(auth, email).then(() => alert("Reset Link Sent"));
};

window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('minimized');
window.toggleTheme = () => document.body.classList.toggle('dark-mode');
window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
};
window.closeDetails = () => document.getElementById('detailWindow').classList.add('hidden');





