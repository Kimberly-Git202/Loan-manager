import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, onValue, update } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAEMpC9oczMDYybbkZirDkY9a25d8ZqjJw",
  authDomain: "jml-loans-560d8.firebaseapp.com",
  projectId: "jml-loans-560d8",
  databaseURL: "https://jml-loans-560d8-default-rtdb.europe-west1.firebasedatabase.app", 
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

let clients = [];
let currentClientId = null;
let currentUserEmail = "";

// Auth Listener
onAuthStateChanged(auth, (user) => {
    const login = document.getElementById('login-overlay');
    if (user) {
        login.classList.add('hidden');
        currentUserEmail = user.email || "User";
        loadData();
    } else {
        login.classList.remove('hidden');
    }
});

window.handleLogin = () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, email, password).catch(() => alert("Invalid Credentials"));
};

window.handleLogout = () => signOut(auth);

// Load Data - Realtime
function loadData() {
    onValue(ref(db, 'jml_data/'), (snap) => {
        const data = snap.val();
        clients = data ? Object.values(data) : [];
        renderTable();
        updateFinancials();
        renderDebts();
    });
}

// 1. Table Render (Fixed View Button)
window.renderTable = (dataToRender = clients) => {
    const tbody = document.getElementById('clientTableBody');
    if (!tbody) return;

    tbody.innerHTML = dataToRender.map((c, i) => {
        const principal = Number(c.loan || 0);
        const totalDue = principal * 1.25;
        const totalPaid = Number(c.totalPaid || 0);
        const balance = totalDue - totalPaid;

        return `
            <tr>
                <td>${i+1}</td>
                <td><strong>${c.name || ''}</strong></td>
                <td>${c.idNumber || ''}</td>
                <td>${c.phone || ''}</td>
                <td>KSh ${totalPaid.toLocaleString()}</td>
                <td style="color:${balance > 0 ? 'var(--danger)' : 'var(--success)'}; font-weight:bold">
                    KSh ${balance.toLocaleString()}
                </td>
                <td><button class="view-btn" onclick="openDashboard('${c.idNumber}')">View Dossier</button></td>
            </tr>
        `;
    }).join('');
};

// 2. Financials - Monthly Intelligence (Calculations)
window.updateFinancials = (selectedMonth = new Date().getMonth() + 1) => {
    let totalOut = 0, todayPaid = 0, monthlyPaid = 0;
    const todayStr = new Date().toLocaleDateString('en-GB');

    clients.forEach(c => {
        const principal = Number(c.loan || 0);
        const totalDue = principal * 1.25;
        totalOut += (totalDue - Number(c.totalPaid || 0));

        (c.history || []).forEach(h => {
            if (h.date === todayStr && h.act === "Payment") {
                todayPaid += Number(h.amount || 0);
            }
            // Logic to calculate monthly total based on dropdown
            const [d, m, y] = h.date.split('/');
            if (parseInt(m) === parseInt(selectedMonth) && h.act === "Payment") {
                monthlyPaid += Number(h.amount || 0);
            }
        });
    });

    const grid = document.getElementById('finance-grid');
    grid.innerHTML = `
        <div class="stat-card"><h3>Grand Total Out</h3><h2>KSh ${totalOut.toLocaleString()}</h2></div>
        <div class="stat-card"><h3>Total Paid Today</h3><h2 style="color:var(--success)">KSh ${todayPaid.toLocaleString()}</h2></div>
        <div class="stat-card">
            <h3>Total Paid Monthly</h3>
            <select onchange="updateFinancials(this.value)" style="padding:5px; border-radius:5px;">
                ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => `<option value="${m}" ${m==selectedMonth?'selected':''}>Mwezi wa ${m}</option>`).join('')}
            </select>
            <h2 style="color:var(--success)">KSh ${monthlyPaid.toLocaleString()}</h2>
        </div>
        <div class="stat-card"><h3>Total Profit (Earned)</h3><h2>KSh ${(monthlyPaid * 0.2).toLocaleString()}</h2></div>
    `;
    
    document.getElementById('top-today').innerText = `KSh ${todayPaid.toLocaleString()}`;
};

// 3. Open Dossier (Fixed logic)
window.openDashboard = (idNumber) => {
    const c = clients.find(x => x.idNumber === idNumber);
    if (!c) return;
    currentClientId = idNumber;

    const totalDue = Number(c.loan) * 1.25;
    const paid = Number(c.totalPaid || 0);
    const balance = totalDue - paid;

    document.getElementById('d-name').innerText = c.name;
    document.getElementById('d-principal').innerText = `KSh ${Number(c.loan).toLocaleString()}`;
    document.getElementById('d-total').innerText = `KSh ${totalDue.toLocaleString()}`;
    document.getElementById('d-balance').innerText = `KSh ${balance.toLocaleString()}`;
    document.getElementById('d-paid').innerText = `KSh ${paid.toLocaleString()}`;

    const hBody = document.getElementById('historyBody');
    hBody.innerHTML = (c.history || []).slice().reverse().map(h => `
        <tr class="${h.time >= '18:00' ? 'highlight-late' : ''}">
            <td>${h.date}</td><td>${h.time}</td><td>${h.det}</td><td>${h.by}</td>
        </tr>
    `).join('');

    document.getElementById('detailWindow').classList.remove('hidden');
};

// 4. Record Payment
window.processPayment = () => {
    const amt = parseFloat(document.getElementById('payAmt').value);
    const time = document.getElementById('payTime').value;
    if (!amt || !time) return alert("Weka kiasi na muda");

    const clientRef = ref(db, `jml_data/${currentClientId}`);
    const client = clients.find(x => x.idNumber === currentClientId);
    
    const newPaid = Number(client.totalPaid || 0) + amt;
    const history = client.history || [];
    history.push({
        date: new Date().toLocaleDateString('en-GB'),
        time: time,
        act: "Payment",
        amount: amt,
        det: `Malipo ya KSh ${amt}`,
        by: currentUserEmail.split('@')[0]
    });

    update(clientRef, { totalPaid: newPaid, history: history })
    .then(() => {
        alert("Malipo yamepokelewa!");
        document.getElementById('payAmt').value = "";
        openDashboard(currentClientId);
    });
};

// 5. Enrollment (1.25x Automation)
document.getElementById('clientForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const idNo = document.getElementById('f-idNumber').value;
    const loan = parseFloat(document.getElementById('f-loan').value);

    const newClient = {
        name: document.getElementById('f-name').value,
        idNumber: idNo,
        phone: document.getElementById('f-phone').value,
        location: document.getElementById('f-location').value,
        loan: loan,
        totalPaid: 0,
        history: [{
            date: new Date().toLocaleDateString('en-GB'),
            time: "08:00",
            act: "New Loan",
            det: "Loan Issued (1.25x Rule)",
            by: currentUserEmail.split('@')[0]
        }]
    };

    set(ref(db, `jml_data/${idNo}`), newClient).then(() => {
        alert("Mteja amesajiliwa!");
        e.target.reset();
        showSection('clients-sec');
    });
});

// 6. Debts Render
window.renderDebts = () => {
    const tbody = document.getElementById('debts-body');
    tbody.innerHTML = clients.filter(c => ((c.loan * 1.25) - (c.totalPaid || 0)) > 0).map(c => `
        <tr>
            <td>${c.name}</td>
            <td>${c.idNumber}</td>
            <td>KSh ${Number(c.loan).toLocaleString()}</td>
            <td style="color:red">KSh ${((c.loan * 1.25) - (c.totalPaid || 0)).toLocaleString()}</td>
            <td><button class="view-btn" onclick="openDashboard('${c.idNumber}')">View</button></td>
        </tr>
    `).join('');
};

// Sidebar Toggle
window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if(id === 'financials-sec') updateFinancials();
    if(id === 'debts-sec') renderDebts();
};

window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('open');
window.closeDetails = () => document.getElementById('detailWindow').classList.add('hidden');
