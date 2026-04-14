import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, onValue, update, get } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, updatePassword } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

const firebaseConfig = { /* Paste your config here */ };
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

let clients = [];
let allStaffData = {}; 
let currentUser = null;
let currentIndex = null;
let isAdmin = false;

// 1. Auth & Access Control
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const staffRef = ref(db, `jml_users/${user.uid}`);
        const snap = await get(staffRef);
        const userData = snap.val();
        
        if (userData && userData.disabled) {
            alert("Your access has been denied by Admin.");
            handleLogout();
            return;
        }

        currentUser = user;
        isAdmin = userData?.role === 'admin';
        document.getElementById('user-display').innerText = user.email.split('@')[0];
        document.getElementById('login-overlay').classList.add('hidden');
        if (isAdmin) document.getElementById('admin-nav').classList.remove('hidden');
        loadData();
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
    }
});

// 2. Data Handling (Separate DB per User)
function loadData() {
    const dataPath = isAdmin ? 'jml_data/' : `jml_data/${currentUser.uid}`;
    onValue(ref(db, dataPath), (snap) => {
        const raw = snap.val() || {};
        clients = isAdmin ? Object.values(raw).flatMap(u => Object.values(u)) : Object.values(raw);
        renderTable();
        updateFinancials();
        renderSettled();
        renderLoansGiven();
    });
    
    if (isAdmin) {
        onValue(ref(db, 'jml_users'), (snap) => { renderAdminPanel(snap.val()); });
    }

    onValue(ref(db, 'jml_finance/grand_total'), (snap) => {
        document.getElementById('grand-total-val').value = snap.val() || 0;
    });
}

function saveData() {
    set(ref(db, `jml_data/${currentUser.uid}`), clients);
}

// 3. Formatting Date
function formatDate(dateStr) {
    if (!dateStr) return "---";
    const d = new Date(dateStr);
    const day = d.getDate();
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const suffix = (day) => {
        if (day > 3 && day < 21) return 'th';
        switch (day % 10) { case 1: return "st"; case 2: return "nd"; case 3: return "rd"; default: return "th"; }
    };
    return `${day}${suffix(day)} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// 4. Enrollment & Re-Loan logic
document.getElementById('clientForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const loan = parseFloat(document.getElementById('f-loan').value);
    const newClient = {
        id: Date.now(),
        name: document.getElementById('f-name').value,
        idNumber: document.getElementById('f-id').value,
        phone: document.getElementById('f-phone').value,
        referral: document.getElementById('f-ref').value,
        principal: loan,
        balance: loan * 1.25,
        totalPaid: 0,
        startDate: document.getElementById('f-start').value || null,
        endDate: document.getElementById('f-end').value || null,
        history: [],
        settled: false,
        notes: ""
    };
    clients.push(newClient);
    saveData();
    showSection('list-sec');
    e.target.reset();
});

// 5. Daily Skip logic + Payment
window.processPayment = () => {
    const amt = parseFloat(document.getElementById('payAmt').value);
    const time = document.getElementById('payTime').value;
    const client = clients[currentIndex];
    
    // Check if skipped days (Simple logic: check last history date)
    const today = new Date().toLocaleDateString('en-GB');
    if (client.history.length > 0) {
        const lastDate = client.history[client.history.length - 1].date;
        if (lastDate !== today) {
            // Add placeholder for missing day
            client.history.push({ date: lastDate, act: "SKIPPED", amt: 0, time: "00:00", by: "System" });
        }
    }

    client.balance -= amt;
    client.totalPaid += amt;
    client.history.push({
        date: today,
        time: time,
        amt: amt,
        by: currentUser.email.split('@')[0],
        act: "PAYMENT"
    });
    saveData();
};

// 6. Sidebar Sections: Loans Given (Monthly/Weekly)
function renderLoansGiven() {
    const container = document.getElementById('givenAccordion');
    container.innerHTML = "";
    const grouped = {};

    clients.forEach(c => {
        if (!c.startDate) return;
        const d = new Date(c.startDate);
        const month = d.toLocaleString('default', { month: 'long' });
        const week = Math.ceil(d.getDate() / 7);
        if (!grouped[month]) grouped[month] = {};
        if (!grouped[month][`Week ${week}`]) grouped[month][`Week ${week}`] = [];
        grouped[month][`Week ${week}`].push(c);
    });

    for (let m in grouped) {
        let html = `<div class="accordion-item"><div class="accordion-header">${m}</div><div class="accordion-content">`;
        for (let w in grouped[m]) {
            html += `<p><strong>${w}:</strong> ${grouped[m][w].map(c => c.name).join(', ')}</p>`;
        }
        container.innerHTML += html + `</div></div>`;
    }
}

// 7. Search (Name & ID)
window.searchClients = () => {
    const term = document.getElementById('globalSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#clientTableBody tr');
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(term) ? "" : "none";
    });
};

// 8. Admin Panel: Deny Access & Change Pwd
function renderAdminPanel(users) {
    const container = document.getElementById('staffList');
    container.innerHTML = "";
    for (let id in users) {
        const u = users[id];
        container.innerHTML += `
            <div class="stat-card">
                <h3>${u.email}</h3>
                <p>Status: ${u.disabled ? 'DENIED' : 'ACTIVE'}</p>
                <button onclick="toggleAccess('${id}', ${u.disabled})">${u.disabled ? 'Enable' : 'Deny Access'}</button>
                <button onclick="adminChangePwd('${id}')">Reset Password</button>
            </div>`;
    }
}

window.toggleAccess = (uid, curStatus) => {
    update(ref(db, `jml_users/${uid}`), { disabled: !curStatus });
};

// ... Rest of UI logic (toggleSidebar, showSection, openDashboard)
window.openDashboard = (i) => {
    currentIndex = i;
    const c = clients[i];
    document.getElementById('d-name').innerText = c.name;
    document.getElementById('d-meta').innerHTML = `ID: ${c.idNumber} | Referral: ${c.referral || 'None'}<br>Dates: ${formatDate(c.startDate)} to ${formatDate(c.endDate)}`;
    document.getElementById('d-principal').innerText = c.principal.toLocaleString();
    document.getElementById('d-balance').innerText = c.balance.toLocaleString();
    document.getElementById('d-notes').value = c.notes || "";
    
    document.getElementById('historyBody').innerHTML = c.history.map(h => `
        <tr class="${h.amt === 0 ? 'skipped-day' : ''}">
            <td>${h.date}</td>
            <td class="${parseInt(h.time) >= 18 ? 'time-late' : ''}">${h.time}</td>
            <td contenteditable="true" onblur="editHistory(${i}, '${h.date}', this.innerText)">${h.amt}</td>
            <td>${h.by}</td>
        </tr>
    `).join('');
    document.getElementById('detailWindow').classList.remove('hidden');
};

window.handleLogin = () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, e, p).catch(err => alert(err.message));
};
window.handleLogout = () => signOut(auth);
window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('minimized');
window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
};
window.closeDetails = () => document.getElementById('detailWindow').classList.add('hidden');
window.saveGrandTotal = () => set(ref(db, 'jml_finance/grand_total'), document.getElementById('grand-total-val').value);
