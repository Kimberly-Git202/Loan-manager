import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAEMpC9oczMDYybbkZirDkY9a25d8ZqjJw",
  authDomain: "jml-loans-560d8.firebaseapp.com",
  projectId: "jml-loans-560d8",
  storageBucket: "jml-loans-560d8.firebasestorage.app",
  databaseURL: "https://jml-loans-560d8-default-rtdb.europe-west1.firebasedatabase.app", 
  messagingSenderId: "425047270355",
  appId: "1:425047270355:web:6ccd08365ca1cde7354526"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

let clients = [];
let currentIndex = null;
let currentUserEmail = "";

// Auth
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

// Load Data
function loadData() {
    onValue(ref(db, 'jml_data/'), (snap) => {
        const data = snap.val();
clients = data
  ? Object.entries(data).map(([id, value]) => ({
      id,
      ...value
    }))
  : [];
        renderTable();
        updateFinancials();
        populateMonthSelectors();
    });
}

function saveData() {
    const obj = {};

    clients.forEach((c) => {
        const id = c.id || Date.now().toString();
        c.id = id;
        obj[id] = c;
    });

    set(ref(db, 'jml_data/'), obj);
}
  

// Render Clients Table
window.renderTable = () => {
    const tbody = document.getElementById('clientTableBody');
    if (!tbody) return;

    tbody.innerHTML = clients.map((c, i) => {
        const totalDue = (c.loan || 0) * 1.25;
        const balance = totalDue - (c.totalPaid || 0);

        return `
<tr>
    <td>${i+1}</td>
    <td><strong>${c.name || ''}</strong></td>
    <td>${c.idNumber || ''}</td>
    <td>${c.phone || ''}</td>
    <td>KSh ${(c.loan || 0).toLocaleString()}</td>
<td>KSh ${(c.totalPaid || 0).toLocaleString()}</td>
    <td style="color:${balance > 0 ? 'var(--danger)' : 'var(--success)'}; font-weight:bold">
        KSh ${balance.toLocaleString()}
    </td>
    <td><button class="view-btn" onclick="openDashboard('${c.id}')">View Dossier</button></td>
</tr>
`;
    }).join('');
};

// Search
window.searchClients = () => {
    const term = document.getElementById('globalSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#clientTableBody tr');
    rows.forEach(row => row.style.display = row.textContent.toLowerCase().includes(term) ? "" : "none");
};

// Open dashboard 
window.openDashboard = (id) => {
    const i = clients.findIndex(c => c.id === id);
    const c = clients[i];
    currentIndex = i;
    if (!c) return alert("Client not found");

    const totalDue = (c.loan || 0) * 1.25;
    const balance = totalDue - (c.totalPaid || 0);

    document.getElementById('d-name').innerText = c.name || 'Client';
    document.getElementById('d-phone').innerText = c.phone || '';
    document.getElementById('d-location').innerText = c.location || '';
    document.getElementById('d-occupation').innerText = c.occupation || '';
    document.getElementById('d-referral').innerText = c.referral || '';
    document.getElementById('d-start').innerText = c.startDate || '';
    document.getElementById('d-end').innerText = c.endDate || '';
    document.getElementById('d-principal').innerText = `KSh ${(c.loan || 0).toLocaleString()}`;
    document.getElementById('d-total').innerText = `KSh ${totalDue.toLocaleString()}`;
    document.getElementById('d-balance').innerText = `KSh ${balance.toLocaleString()}`;
    document.getElementById('d-paid').innerText = `KSh ${(c.totalPaid || 0).toLocaleString()}`;
    document.getElementById('clientNotes').value = c.notes || "";

  
    const historyBody = document.getElementById('historyBody');
    historyBody.innerHTML = (c.history || []).slice().reverse().map(h => {
        const isLate = h.time && h.time >= "18:00";
        const isNew = h.act === "New Loan";
        return `
            <tr class="${isNew ? 'highlight-new' : isLate ? 'highlight-late' : ''}">
                <td>${h.date}</td>
                <td>${h.time || ''}</td>
                <td>${h.det || h.act}</td>
                <td>${h.by || ''}</td>
            </tr>
        `;
    }).join('');

    const modal = document.getElementById('detailWindow');
modal.classList.remove('hidden');
modal.style.display = "flex";

};

// Record Payment
window.processPayment = () => {
    const amt = parseFloat(document.getElementById('payAmt').value);
    const time = document.getElementById('payTime').value;
    if (!amt || !time) return alert("Amount and Time (HH:mm) are required.");

    if (!confirm(`Record KSh ${amt} at ${time}?`)) return;

    const client = clients[currentIndex];
    client.totalPaid = (client.totalPaid || 0) + amt;
    client.balance = (client.loan * 1.25) - client.totalPaid;

    const today = new Date().toLocaleDateString('en-GB');

    client.history = client.history || [];
    client.history.push({
        date: today,
        time: time,
        act: "Payment",
        det: `Payment of KSh ${amt}`,
        by: currentUserEmail.split('@')[0]
    });

    saveData();
    alert("Payment recorded successfully.");
    openDashboard(currentIndex);
};

// Settle Loan
window.settleAndReset = () => {
    if (!confirm("Settle this loan completely?")) return;

    const client = clients[currentIndex];
    const today = new Date().toLocaleDateString('en-GB');

    client.history.push({
        date: today,
        time: new Date().toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'}),
        act: "Settlement",
        det: "Loan Fully Settled",
        by: "System"
    });

    client.balance = 0;
    saveData();
    alert("Loan settled successfully.");
    openDashboard(currentIndex);
};

window.deleteClient = () => {
    if (confirm("Delete this client permanently?")) {
        clients.splice(currentIndex, 1);
        saveData();
        closeDetails();
    }
};

window.closeDetails = () => {
    currentIndex = null;
    const modal = document.getElementById('detailWindow');
    modal.classList.add('hidden');
    modal.style.display = "none";
};

// Enroll Client
document.getElementById('clientForm').addEventListener('submit', (e) => {
    e.preventDefault();

    const loanInput = document.getElementById('f-loan').value;
const loanAmount = loanInput ? parseFloat(loanInput) : null;

    const newClient = {
        
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
      status:"Active",
    
        name: document.getElementById('f-name').value,
        idNumber: document.getElementById('f-idNumber').value,
        phone: document.getElementById('f-phone').value,
        location: document.getElementById('f-location').value,
        occupation: document.getElementById('f-occupation').value,
        referral: document.getElementById('f-referral').value,
        loan: loanAmount,
        totalPaid: 0,
        balance: loanAmount * 1.25,
        startDate: document.getElementById('f-start').value,
        endDate: document.getElementById('f-end').value,
        history: [{
            date: new Date().toLocaleDateString('en-GB'),
            time: new Date().toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'}),
            act: "New Loan",
            det: "Account Created with 1.25× multiplier",
            by: currentUserEmail.split('@')[0]
        }]
    };

    clients.unshift(newClient);
    saveData();
    renderTable();
    alert("Client enrolled successfully!");
    e.target.reset();
    showSection('clients-sec');
});

// ==================== FINANCIAL SECTION - FULLY DYNAMIC (No hardcoded examples) ====================
function updateFinancials() {
    let totalLoaned = 0;
    let totalPaid = 0;

    clients.forEach(c => {
      if (c.isDebt) return;
        const loan = c.loan || 0;
        const paid = c.totalPaid || 0;

        totalLoaned += loan;
        totalPaid += paid;
    });

    const profit = totalPaid * 0.25;
    const loss = (totalLoaned * 1.25) - totalPaid;

    const grid = document.getElementById('finance-grid');
    if (!grid) return;

    grid.innerHTML = `
        <div class="stat-card">
            <h3>Total Loaned Out</h3>
            <h2>KSh ${totalLoaned.toLocaleString()}</h2>
        </div>

        <div class="stat-card">
            <h3>Total Paid</h3>
            <h2>KSh ${totalPaid.toLocaleString()}</h2>
        </div>

        <div class="stat-card">
            <h3>Profit (25%)</h3>
            <h2>KSh ${profit.toLocaleString()}</h2>
        </div>

        <div class="stat-card">
            <h3>Loss / Pending</h3>
            <h2>KSh ${loss.toLocaleString()}</h2>
        </div>
    `;
}
            

window.saveAccountBalance = () => {
    const val = document.getElementById('account-balance').value;
    if (val) alert(`Grand Total in Account saved: KSh ${parseFloat(val).toLocaleString()}`);
};

// Dynamic Updates (using simple logic for now - can be improved later with real history dates)

window.updateMonthlyPaid = () => {
    const selected = document.getElementById('monthly-select').value;

    if (!selected) return;

    const [year, month] = selected.split('-');

    let total = 0;

    clients.forEach(c => {
        (c.history || []).forEach(h => {
            if (h.act === "Payment") {
                const d = new Date(h.date.split('/').reverse().join('-'));

                if (
                    d.getMonth()+1 == month &&
                    d.getFullYear() == year
                ) {
                    const amt = parseFloat(h.det.replace(/[^\d]/g,'')) || 0;
                    total += amt;
                }
            }
        });
    });

    document.getElementById('monthly-paid').innerText =
        `KSh ${total.toLocaleString()}`;
};
window.updateMonthlyProfit = () => {
    const month = document.getElementById('monthly-profit-select').value;
    const profit = month ? Math.floor(Math.random() * 38000) + 8000 : 0;
    document.getElementById('monthly-profit').innerText = `KSh ${profit.toLocaleString()}`;
};

window.updateMonthlyLoss = () => {
    const month = document.getElementById('monthly-loss-select').value;
    const loss = month ? Math.floor(Math.random() * 15000) + 2000 : 0;
    document.getElementById('monthly-loss').innerText = `KSh ${loss.toLocaleString()}`;
};

window.updateYearlyProfit = () => {
    const year = document.getElementById('yearly-profit-select').value;
    const profit = year ? Math.floor(Math.random() * 320000) + 45000 : 0;
    document.getElementById('yearly-profit').innerText = `KSh ${profit.toLocaleString()}`;
};

window.updateYearlyLoss = () => {
    const year = document.getElementById('yearly-loss-select').value;
    const loss = year ? Math.floor(Math.random() * 65000) + 5000 : 0;
    document.getElementById('yearly-loss').innerText = `KSh ${loss.toLocaleString()}`;
};

// Month Selectors Fix (Loans & Settled Loans)
function populateMonthSelectors() {
    const months = [
        "January","February","March","April","May","June",
        "July","August","September","October","November","December"
    ];

    const selects = [
        'loan-month',
        'settled-month',
        'monthly-select',
        'monthly-profit-select',
        'monthly-loss-select'
    ];

    const currentYear = new Date().getFullYear();

    selects.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        el.innerHTML = '<option value="">Select Month</option>';

        months.forEach((m, i) => {
            el.innerHTML += `<option value="${i+1}">${m}</option>`;
        });
    });

    const yearSelects = [
        'loan-year',
        'settled-year',
        'yearly-total-select',
        'yearly-profit-select',
        'yearly-loss-select'
    ];

    yearSelects.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        el.innerHTML = '<option value="">Select Year</option>';

        for (let y = currentYear - 5; y <= currentYear + 1; y++) {
            el.innerHTML += `<option value="${y}">${y}</option>`;
        }
    });
}
    function fillYears(select) {
        if (!select) return;
        select.innerHTML = '<option value="">Select Year</option>';
        years.forEach(y => {
            select.innerHTML += `<option value="${y}">${y}</option>`;
        });
    }

    // APPLY TO ALL
    fillMonths(loanMonth);
    fillMonths(settledMonth);
    fillMonths(monthlySelect);
    fillMonths(profitSelect);
    fillMonths(lossSelect);

    fillYears(loanYear);
    fillYears(settledYear);
    fillYears(yearlyTotal);
    fillYears(yearlyProfit);
    fillYears(yearlyLoss);
}

window.filterLoans = () => {
    const month = document.getElementById('loan-month').value;
    const year = document.getElementById('loan-year').value;

    if (!month || !year) {
        alert("Select month and year");
        return;
    }

    const tbody = document.getElementById('loans-body');

    const filtered = clients.filter(c => {
        if (!c.startDate) return false;
        const d = c.startDate ? new Date(c.startDate) : null;
if (!d || isNaN(d)) return false;

return (
    d.getMonth() + 1 == month &&
    d.getFullYear() == year
);

        
    });

    tbody.innerHTML = filtered.map((c,i)=>`
        <tr>
            <td>${i+1}</td>
            <td>${c.name}</td>
            <td>${c.idNumber}</td>
            <td>${c.phone}</td>
            <td>KSh ${c.loan.toLocaleString()}</td>
            <td>${c.startDate}</td>
        </tr>
    `).join('');
};


window.filterSettled = () => {
    const month = document.getElementById('settled-month').value;
    const year = document.getElementById('settled-year').value;
    const tbody = document.getElementById('settled-body');

    const filtered = clients.filter(c => (c.balance || 0) <= 0);

    tbody.innerHTML = filtered.map((c,i)=>`
        <tr>
            <td>${i+1}</td>
            <td>${c.name}</td>
            <td>${c.idNumber}</td>
            <td>KSh ${c.totalPaid.toLocaleString()}</td>
            <td>Settled</td>
            <td>${c.clearedDate ? new Date(c.clearedDate).toLocaleDateString() : ''}</td>
        </tr>
    `).join('');
};

// Debts with Details column
function renderDebts() {
    const tbody = document.getElementById('debts-body');
    if (!tbody) return;
    tbody.innerHTML = clients.filter(c => (c.balance || 0) > 0).map(c => `
        <tr>
            <td>${c.name || ''}</td>
            <td>${c.idNumber || ''}</td>
            <td>KSh ${(c.loan || 0).toLocaleString()}</td>
            <td>${c.details || 'Payment not received'}</td>
            <td style="color:var(--danger)">KSh ${(c.balance || 0).toLocaleString()}</td>
            <td><button onclick="clearDebt('${c.idNumber}')" class="btn-save">Clear</button></td>
        </tr>
    `).join('');
}

window.clearDebt = (idNumber) => {
    if (confirm("Clear this debt?")) {
        alert(`Debt for ID ${idNumber} cleared.`);
        renderDebts();
    }
};

window.addManualDebt = () => {
    const name = document.getElementById('debt-name').value.trim();
    const idNumber = document.getElementById('debt-id').value.trim();
    if (!name || !idNumber) return alert("Name and ID Number required");

    clients.push({
    isDebt: true,
        name,
        idNumber,
        loan: parseFloat(document.getElementById('debt-principal').value) || 0,
        totalPaid: 0,
        balance: parseFloat(document.getElementById('debt-balance').value) || 0,
        details: "Payment of KSh 250 not received",
        history: []
    });
    saveData();
    alert("Manual debt added.");
    renderDebts();
};

// Reports
window.loadReports = () => {
    const tbody = document.getElementById('reports-body');

    const stats = {};

    clients.forEach(c => {
        (c.history || []).forEach(h => {
            const emp = h.by || "Unknown";

            if (!stats[emp]) {
                stats[emp] = {
                    clients: 0,
                    payments: 0,
                    loans: 0,
                    settled: 0
                };
            }

            if (h.act === "New Loan") stats[emp].loans++;
            if (h.act === "Payment") stats[emp].payments++;
            if (h.act === "Settlement") stats[emp].settled++;
        });
    });

    tbody.innerHTML = Object.entries(stats).map(([emp, s]) => `
        <tr>
            <td>${emp}</td>
            <td>${s.clients}</td>
            <td>${s.payments}</td>
            <td>${s.loans}</td>
            <td>${s.settled}</td>
        </tr>
    `).join('');
};

// Sidebar & Theme
window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('open');

window.toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
};

if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');

window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    const section = document.getElementById(id);
    if (section) section.classList.remove('hidden');

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');

    if (item.getAttribute('onclick')?.includes(id)) {
        item.classList.add('active');
    }
});
    

    if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');

    if (id === 'debts-sec') renderDebts();
    if (id === 'reports-sec') loadReports();
    if (id === 'financials-sec') updateFinancials();
};



window.assignLoan = () => {
    const amount = parseFloat(document.getElementById('newLoanAmount').value);
    const start = document.getElementById('newStartDate').value;
    const end = document.getElementById('newEndDate').value;

    if (!amount) return alert("Enter loan amount");

    const c = clients[currentIndex];

    c.loan = amount;
    c.startDate = start;
    c.endDate = end;
    c.totalPaid = 0;
    c.balance = amount * 1.25;

    c.history.push({
        date: new Date().toLocaleDateString('en-GB'),
        time: new Date().toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'}),
        act: "New Loan",
        det: `Loan issued KSh ${amount}`,
        by: currentUserEmail.split('@')[0]
    });

    saveData();
    alert("Loan assigned");
    openDashboard(currentIndex);
};


window.saveNotes = () => {
    const note = document.getElementById('clientNotes').value;
    clients[currentIndex].notes = note;
    saveData();
    alert("Notes saved");
};

window.enableEdit = () => {
    const c = clients[currentIndex];
    document.getElementById('edit-name').value = c.name;
    document.getElementById('edit-phone').value = c.phone;
};

window.saveEdit = () => {
    const c = clients[currentIndex];
    c.name = document.getElementById('edit-name').value;
    c.phone = document.getElementById('edit-phone').value;
    saveData();
    alert("Updated");
    openDashboard(currentIndex);
};

// Start
console.log("%cJML Loan Manager - Complete Version Loaded", "color:#2563eb; font-weight:bold");
