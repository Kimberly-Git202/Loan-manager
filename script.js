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

// SYNC ALL DATA
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

// INITIALIZE DROPDOWNS
function populateDropdowns() {
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthHtml = months.map((m, i) => `<option value="${i+1}">${m} 2026</option>`).join('');
    ['f-month-sel', 'loan-month', 'settle-month'].forEach(id => {
        document.getElementById(id).innerHTML = monthHtml;
    });
}
populateDropdowns();

// NAVIGATION
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

// ENROLL CLIENT
window.enrollClient = () => {
    const id = document.getElementById('e-id').value;
    const princ = parseFloat(document.getElementById('e-princ').value);
    if(!id || isNaN(princ)) return alert("Error: ID and Principal required.");

    db.ref('jml_master_records/' + id).set({
        name: document.getElementById('e-name').value,
        idNo: id, phone: document.getElementById('e-phone').value,
        location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value,
        referral: document.getElementById('e-ref').value,
        officer: document.getElementById('e-off').value || "Unassigned",
        principal: princ, balance: princ, totalPaid: 0,
        startDate: document.getElementById('e-start').value,
        status: 'Active', history: {}
    }).then(() => { alert("Client Registered!"); showSec('list-sec'); });
};

// REPORT & OFFICER LOGIC (FROM SKETCHES)
function populateOfficers() {
    const offSet = new Set(clients.map(c => c.officer));
    const select = document.getElementById('off-filter');
    select.innerHTML = '<option value="All">All Officers</option>';
    offSet.forEach(off => {
        if(off) select.innerHTML += `<option value="${off}">${off}</option>`;
    });
    filterByOfficer(); 
}

window.filterByOfficer = () => {
    const officer = document.getElementById('off-filter').value;
    const body = document.getElementById('report-body');
    const filtered = officer === "All" ? clients : clients.filter(c => c.officer === officer);
    
    body.innerHTML = filtered.map(c => {
        const perf = c.principal > 0 ? ((c.totalPaid / c.principal) * 100).toFixed(1) : 0;
        return `<tr>
            <td><strong>${c.officer || 'N/A'}</strong></td>
            <td>${c.name}</td>
            <td>KSH ${c.principal}</td>
            <td>KSH ${c.totalPaid}</td>
            <td><progress value="${perf}" max="100"></progress> ${perf}%</td>
        </tr>`;
    }).join('');
};

// LOAN FILTERING (SATURDAYS & MONTHS)
window.renderSaturdayLoans = () => {
    const m = parseInt(document.getElementById('loan-month').value);
    const w = parseInt(document.getElementById('loan-week').value);
    const body = document.getElementById('saturday-body');
    
    body.innerHTML = clients.filter(c => {
        const d = new Date(c.startDate);
        const isSat = d.getDay() === 5; // Friday is 5, Saturday is 6. Adjust based on locale
        const isMonth = (d.getMonth() + 1) === m;
        const weekNum = Math.ceil(d.getDate() / 7);
        return (d.getDay() === 6) && isMonth && weekNum === w;
    }).map(c => `<tr><td>${c.name}</td><td>${c.idNo}</td><td>${c.officer}</td><td>${c.principal}</td><td>${c.startDate}</td></tr>`).join('');
};

// SETTLED LOANS FILTERING
window.renderSettled = () => {
    const m = parseInt(document.getElementById('settle-month').value);
    const body = document.getElementById('settled-body');
    body.innerHTML = clients.filter(c => {
        if(c.status !== 'Inactive') return false;
        const d = new Date(c.lastUpdated || c.startDate);
        return (d.getMonth() + 1) === m;
    }).map(c => `<tr><td>${c.name}</td><td>${c.idNo}</td><td>${c.officer}</td><td>${c.totalPaid}</td><td>${c.lastUpdated || 'N/A'}</td></tr>`).join('');
};

// DEBT MANUAL
window.addManualDebt = () => {
    const name = document.getElementById('d-name').value;
    const amt = document.getElementById('d-amt').value;
    if(!name || !amt) return alert("Fill debt details");
    db.ref('jml_manual_debts').push({ name, idNo: document.getElementById('d-id').value, amount: amt, status: 'Default' });
};

function renderDebts() {
    document.getElementById('debt-body').innerHTML = debts.map(d => `
        <tr><td>${d.name}</td><td>${d.idNo}</td><td>KSH ${d.amount}</td><td><span class="text-red">Unpaid</span></td>
        <td><button onclick="db.ref('jml_manual_debts/${d.key}').remove()" class="btn btn-red">Clear</button></td></tr>
    `).join('');
}

// VIEW PANEL & CALCULATIONS (RE-OPTIMIZED)
window.openView = (key) => {
    activeKey = key;
    const c = clients.find(x => x.key === key);
    showSec('view-sec');
    document.getElementById('v-title-name').innerText = c.name;
    document.getElementById('v-info-phone').innerText = c.phone;
    document.getElementById('v-info-loc').innerText = c.location;
    document.getElementById('v-princ').innerText = `KSH ${c.principal}`;
    document.getElementById('v-bal').innerText = `KSH ${c.balance}`;
    document.getElementById('v-paid').innerText = `KSH ${c.totalPaid}`;
    document.getElementById('v-history-body').innerHTML = c.history ? Object.values(c.history).map(h => `
        <tr class="${h.time > '18:00' ? 'late-row' : ''}"><td>${h.date}</td><td>${h.activity}</td><td>${h.details}</td><td>${h.time}</td><td>Admin</td></tr>
    `).join('') : '';
};

function renderMainList() {
    document.getElementById('clientsTableBody').innerHTML = clients.map((c, i) => `
        <tr><td>${i+1}</td><td>${c.name}</td><td>${c.idNo}</td><td>${c.phone}</td><td>${c.totalPaid}</td><td>${c.balance}</td>
        <td><span class="${c.status==='Active'?'text-green':'text-red'}">${c.status}</span></td>
        <td><button class="btn btn-p" onclick="openView('${c.key}')">VIEW</button></td></tr>
    `).join('');
}

window.process = (type) => {
    const amt = parseFloat(document.getElementById('act-amt').value) || 0;
    const c = clients.find(x => x.key === activeKey);
    let up = { lastUpdated: new Date().toLocaleDateString() };
    if(type === 'Payment') { up.totalPaid = (c.totalPaid || 0) + amt; up.balance = c.balance - amt; }
    if(type === 'Settle') { up.status = 'Inactive'; up.balance = 0; }
    db.ref('jml_master_records/' + activeKey).update(up);
    db.ref(`jml_master_records/${activeKey}/history`).push({ date: new Date().toLocaleDateString(), activity: type, details: `KSH ${amt}`, time: document.getElementById('act-time').value });
};

function runCalculations() {
    let out = 0, monthPaid = 0;
    const mSel = parseInt(document.getElementById('f-month-sel').value);
    clients.forEach(c => {
        out += parseFloat(c.principal || 0);
        if(c.history) Object.values(c.history).forEach(h => {
            const d = new Date(h.date);
            if((d.getMonth()+1) === mSel) monthPaid += (parseFloat(h.details.replace('KSH ', '')) || 0);
        });
    });
    document.getElementById('f-total-out').innerText = `KSH ${out.toLocaleString()}`;
    document.getElementById('f-paid-monthly').innerText = `KSH ${monthPaid.toLocaleString()}`;
    document.getElementById('f-profit').innerText = `KSH ${(monthPaid * 0.15).toLocaleString()}`; // Est 15% interest
}
