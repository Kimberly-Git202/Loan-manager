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
let activeClientID = null;

// --- AUTH HANDLERS ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        document.getElementById('user-display').innerText = user.email;
        fetchData();
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
    }
});

function fetchData() {
    onValue(ref(db, 'jml_data'), (snapshot) => {
        const data = snapshot.val();
        allClients = data ? Object.values(data) : [];
        renderClientTable(allClients);
        calculateFinancials();
    });
}

// --- VIEW DASHBOARD LOGIC ---
window.openView = (id) => {
    const c = allClients.find(x => x.idNumber == id);
    if (!c) return;
    activeClientID = id;

    document.getElementById('v-name').innerText = c.name;
    document.getElementById('v-id').innerText = c.idNumber;
    document.getElementById('v-updated').innerText = c.lastUpdated || "Never";
    document.getElementById('v-status-badge').innerText = c.status;
    
    // Fill Info Cards
    document.getElementById('vi-loc').innerText = c.location;
    document.getElementById('vi-occ').innerText = c.occupation;
    document.getElementById('vi-phone').innerText = c.phone;
    document.getElementById('vi-ref').innerText = c.referral;

    // Fill Loan Data
    document.getElementById('vl-princ').innerText = `KSh ${c.principal}`;
    document.getElementById('vl-paid').innerText = `KSh ${c.totalPaid}`;
    document.getElementById('vl-bal').innerText = `KSh ${c.balance}`;
    document.getElementById('vl-next').innerText = c.nextPayment || "N/A";
    
    document.getElementById('v-notes-area').value = c.notes || "";
    document.getElementById('ve-officer').value = c.loanOfficer || "System";

    renderHistory(c.history || []);
    document.getElementById('view-modal').classList.remove('hidden');
};

function renderHistory(history) {
    const body = document.getElementById('v-history-body');
    body.innerHTML = history.map(h => {
        // Highlighting Logic: Red if past 18:00 (6 PM)
        const isLate = h.time && h.time > "18:00";
        const rowClass = isLate ? "row-late" : "";
        
        return `<tr class="${rowClass}">
            <td>${h.date}</td>
            <td>${h.activity}</td>
            <td>${h.details}</td>
            <td>${h.time || '--'}</td>
            <td>${h.by}</td>
        </tr>`;
    }).join('');
}

// --- ACTIONS (PAYMENT/SETTLE/DELETE) ---
window.processAction = async (type) => {
    if (!confirm(`Are you sure you want to ${type}?`)) return;

    const amount = parseFloat(document.getElementById('act-amount').value) || 0;
    const time = document.getElementById('act-time').value;
    const clientRef = ref(db, `jml_data/${activeClientID}`);
    const client = allClients.find(x => x.idNumber == activeClientID);

    let updates = {
        lastUpdated: new Date().toLocaleString(),
        loanOfficer: auth.currentUser.email
    };

    if (type === 'Payment') {
        updates.totalPaid = (client.totalPaid || 0) + amount;
        updates.balance = (client.principal || 0) - updates.totalPaid;
        updates.history = [...(client.history || []), {
            date: new Date().toLocaleDateString(),
            activity: 'Payment',
            details: `KSh ${amount} received`,
            time: time,
            by: auth.currentUser.email
        }];
    } else if (type === 'Delete') {
        await remove(clientRef);
        return closeView();
    }

    await update(clientRef, updates);
    openView(activeClientID); // Refresh view
};

// --- CALCULATIONS ---
window.calculateFinancials = () => {
    let out = 0, today = 0;
    const now = new Date().toLocaleDateString();

    allClients.forEach(c => {
        out += (c.balance || 0);
        (c.history || []).forEach(h => {
            if (h.date === now && h.activity === 'Payment') {
                today += parseFloat(h.details.replace(/[^0-9.]/g, '')) || 0;
            }
        });
    });

    document.getElementById('fin-out').innerText = `KSh ${out.toLocaleString()}`;
    document.getElementById('fin-today').innerText = `KSh ${today.toLocaleString()}`;
};

// --- UTILS ---
window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
};
window.closeView = () => document.getElementById('view-modal').classList.add('hidden');
window.toggleTheme = () => document.body.classList.toggle('dark-mode');

