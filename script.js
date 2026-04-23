const firebaseConfig = {
    apiKey: "AIzaSyAEMpC9oczMDYybbkZirDkY9a25d8ZqjJw",
    authDomain: "jml-loans-560d8.firebaseapp.com",
    databaseURL: "https://jml-loans-560d8-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "jml-loans-560d8"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
let clients = [];
let debts = [];
let activeKey = null;

// REAL-TIME DATA SYNC
db.ref('jml_master_records').on('value', snap => {
    const data = snap.val();
    clients = data ? Object.keys(data).map(k => ({ key: k, ...data[k] })) : [];
    renderMainList();
    populateOfficers();
    runCalculations();
});

db.ref('jml_manual_debts').on('value', snap => {
    const data = snap.val();
    debts = data ? Object.keys(data).map(k => ({ key: k, ...data[k] })) : [];
    renderDebts();
});

// DROPDOWNS INIT
function populateDropdowns() {
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthHtml = months.map((m, i) => `<option value="${i+1}">${m} 2026</option>`).join('');
    ['f-month-sel', 'loan-month', 'settle-month'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.innerHTML = monthHtml;
    });
}
populateDropdowns();

// NAVIGATION CORE
window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('minimized');
window.toggleTheme = () => document.body.classList.toggle('dark-mode');
window.showSec = (id, el) => {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if(el) {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        el.classList.add('active');
    }
};

// OFFICER / REPORT LOGIC (SKETCH BASED)
function populateOfficers() {
    const officers = [...new Set(clients.map(c => c.officer))].filter(Boolean);
    const select = document.getElementById('off-filter');
    select.innerHTML = '<option value="All">All Registered Officers</option>';
    officers.forEach(off => select.innerHTML += `<option value="${off}">${off}</option>`);
    filterByOfficer(); 
}

window.filterByOfficer = () => {
    const officer = document.getElementById('off-filter').value;
    const body = document.getElementById('report-body');
    const filtered = officer === "All" ? clients : clients.filter(c => c.officer === officer);
    
    body.innerHTML = filtered.map(c => {
        const recovered = parseFloat(c.totalPaid || 0);
        const loaned = parseFloat(c.principal || 0);
        const rate = loaned > 0 ? ((recovered / loaned) * 100).toFixed(1) : 0;
        return `<tr>
            <td><strong>${c.officer || 'Unassigned'}</strong></td>
            <td>${c.name}</td>
            <td>KSH ${loaned.toLocaleString()}</td>
            <td>KSH ${recovered.toLocaleString()}</td>
            <td class="${rate > 80 ? 'text-green' : 'text-red'}"><strong>${rate}% Recovery</strong></td>
        </tr>`;
    }).join('');
};

// DEBT MANUAL (SKETCH LOGIC)
window.addManualDebt = () => {
    const name = document.getElementById('d-name').value;
    const amt = document.getElementById('d-amt').value;
    const id = document.getElementById('d-id').value;
    if(!name || !amt) return alert("Professional Error: Please fill debtor details.");
    
    db.ref('jml_manual_debts').push({ name, idNo: id, amount: amt, status: 'Default' })
    .then(() => {
        document.getElementById('d-name').value = '';
        document.getElementById('d-amt').value = '';
        document.getElementById('d-id').value = '';
    });
};

function renderDebts() {
    document.getElementById('debt-body').innerHTML = debts.map(d => `
        <tr><td><strong>${d.name}</strong></td><td>${d.idNo}</td><td class="text-red">KSH ${d.amount}</td>
        <td><span class="badge badge-red">DEFAULTER</span></td>
        <td><button onclick="db.ref('jml_manual_debts/${d.key}').remove()" class="btn btn-red btn-sm">CLEAR RECORD</button></td></tr>
    `).join('');
}

// ENROLL & MAIN LIST
window.enrollClient = () => {
    const id = document.getElementById('e-id').value;
    const princ = parseFloat(document.getElementById('e-princ').value);
    if(!id || isNaN(princ)) return alert("Authorization Denied: Valid ID & Principal Required.");

    db.ref('jml_master_records/' + id).set({
        name: document.getElementById('e-name').value,
        idNo: id, phone: document.getElementById('e-phone').value,
        location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value,
        referral: document.getElementById('e-ref').value,
        officer: document.getElementById('e-off').value || "Unassigned",
        principal: princ, balance: princ, totalPaid: 0,
        startDate: document.getElementById('e-start').value,
        status: 'Active', lastUpdated: new Date().toLocaleDateString()
    }).then(() => { alert("Client Registered Successfully."); showSec('list-sec'); });
};

function renderMainList() {
    document.getElementById('clientsTableBody').innerHTML = clients.map((c, i) => `
        <tr><td>${i+1}</td><td><strong>${c.name}</strong></td><td>${c.idNo}</td><td>${c.phone}</td>
        <td>${c.totalPaid.toLocaleString()}</td><td class="text-red">${c.balance.toLocaleString()}</td>
        <td><span class="status-pill ${c.status === 'Active' ? 'bg-green' : 'bg-red'}">${c.status}</span></td>
        <td><button class="btn btn-p btn-sm" onclick="openView('${c.key}')">DOSSIER</button></td></tr>
    `).join('');
}

// FINANCIAL CALCULATIONS
function runCalculations() {
    let principalOut = 0; let monthlyTotal = 0;
    const currentMonth = parseInt(document.getElementById('f-month-sel').value);
    
    clients.forEach(c => {
        principalOut += parseFloat(c.principal || 0);
        // Calculation logic for payments within histories if applicable
    });

    document.getElementById('f-total-out').innerText = `KSH ${principalOut.toLocaleString()}`;
    document.getElementById('f-profit').innerText = `KSH ${(principalOut * 0.2).toLocaleString()}`; // 20% estimated
    document.getElementById('f-loss').innerText = `KSH ${clients.reduce((acc, curr) => acc + (parseFloat(curr.balance)||0), 0).toLocaleString()}`;
}

// Ensure professional filtering for loans/settled
window.renderSaturdayLoans = () => { /* Filter Logic */ };
window.renderSettled = () => { /* Settlement Logic */ };
