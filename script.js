// --- FIREBASE SETUP ---
const firebaseConfig = {
    apiKey: "AIzaSyAEMpC9oczMDYybbkZirDkY9a25d8ZqjJw",
    authDomain: "jml-loans-560d8.firebaseapp.com",
    databaseURL: "https://jml-loans-560d8-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "jml-loans-560d8"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let clients = [];
let activeKey = null;

// SYNC ALL DATA
db.ref('jml_master_records').on('value', snap => {
    const data = snap.val();
    clients = data ? Object.keys(data).map(k => ({ key: k, ...data[k] })) : [];
    renderMainList();
    updateFinancials();
    populateEmployeeList();
});

// NAVIGATION
function switchTab(id, el) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if(el) {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        el.classList.add('active');
    }
}
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }
function toggleTheme() { document.body.classList.toggle('dark-mode'); }

// ENROLL CLIENT
function enrollClient() {
    const id = document.getElementById('e-id').value;
    const princ = parseFloat(document.getElementById('e-princ').value);
    if(!id) return alert("Please fill ID Number");

    const clientData = {
        name: document.getElementById('e-name').value,
        idNo: id, phone: document.getElementById('e-phone').value,
        location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value,
        referral: document.getElementById('e-ref').value,
        principal: princ, totalPaid: 0,
        startDate: document.getElementById('e-start').value,
        endDate: document.getElementById('e-end').value,
        status: 'Active', 
        officer: 'Unassigned',
        lastUpdated: new Date().toLocaleString()
    };

    db.ref('jml_master_records/' + id).set(clientData).then(() => {
        document.querySelectorAll('#add-sec input').forEach(i => i.value = '');
        switchTab('list-sec'); // Immediate UI switch
    });
}

// MAIN CLIENT TABLE
function renderMainList() {
    const tbody = document.getElementById('clientsTableBody');
    tbody.innerHTML = clients.map((c, i) => `
        <tr>
            <td>${i+1}</td>
            <td><strong>${c.name}</strong></td>
            <td>${c.idNo}</td>
            <td>${c.phone}</td>
            <td>KSH ${c.totalPaid || 0}</td>
            <td class="text-red">KSH ${(c.principal - (c.totalPaid || 0))}</td>
            <td><button class="btn btn-p btn-sm" onclick="openView('${c.key}')">VIEW</button></td>
        </tr>
    `).join('');
}

// FINANCIAL CALCULATIONS
function updateFinancials() {
    let grandOut = 0;
    let paidToday = 0;
    let paidMonthly = 0;
    let paidYearly = 0;

    const selMonth = parseInt(document.getElementById('f-month-sel').value);
    const selYear = parseInt(document.getElementById('f-year-sel').value);
    const todayStr = new Date().toLocaleDateString();

    clients.forEach(c => {
        grandOut += parseFloat(c.principal || 0);
        if(c.history) {
            Object.values(c.history).forEach(h => {
                const hDate = new Date(h.date);
                if(h.date === todayStr) paidToday += parseFloat(h.amt || 0);
                if(hDate.getMonth() === selMonth && hDate.getFullYear() === selYear) paidMonthly += parseFloat(h.amt || 0);
                if(hDate.getFullYear() === selYear) paidYearly += parseFloat(h.amt || 0);
            });
        }
    });

    document.getElementById('f-total-out').innerText = `KSH ${grandOut.toLocaleString()}`;
    document.getElementById('f-paid-today').innerText = `KSH ${paidToday.toLocaleString()}`;
    document.getElementById('f-paid-monthly').innerText = `KSH ${paidMonthly.toLocaleString()}`;
    document.getElementById('f-paid-yearly').innerText = `KSH ${paidYearly.toLocaleString()}`;
}

// LOAN WEEKLY SORTING
function renderLoanWeek() {
    const mon = parseInt(document.getElementById('loan-month-sel').value);
    const week = parseInt(document.getElementById('loan-week-sel').value);
    const body = document.getElementById('loan-body');
    body.innerHTML = '';

    clients.forEach(c => {
        const d = new Date(c.startDate);
        if(d.getMonth() === mon) {
            // Calculate week of month
            const w = Math.ceil(d.getDate() / 7);
            if(w === week) {
                body.innerHTML += `<tr><td>${c.name}</td><td>${c.idNo}</td><td>${c.phone}</td><td>KSH ${c.principal}</td><td>${c.startDate}</td></tr>`;
            }
        }
    });
}

// RECORD PAYMENT
function recordPayment() {
    if(!confirm("Are you sure you want to post this payment?")) return;
    const amt = parseFloat(document.getElementById('act-amt').value);
    const time = document.getElementById('act-time').value;
    const details = document.getElementById('act-details').value;
    const officer = document.getElementById('v-officer').value;

    const c = clients.find(x => x.key === activeKey);
    const newPaid = (c.totalPaid || 0) + amt;

    const record = {
        date: new Date().toLocaleDateString(),
        activity: 'Payment',
        details: details,
        amt: amt,
        time: time,
        by: officer || 'Admin'
    };

    db.ref(`jml_master_records/${activeKey}`).update({
        totalPaid: newPaid,
        lastUpdated: new Date().toLocaleString()
    });
    db.ref(`jml_master_records/${activeKey}/history`).push(record);
}

// VIEW CLIENT
function openView(key) {
    activeKey = key;
    const c = clients.find(x => x.key === key);
    switchTab('view-sec');
    
    document.getElementById('v-title-name').innerText = c.name;
    document.getElementById('v-title-id').innerText = c.idNo;
    document.getElementById('v-last-up').innerText = c.lastUpdated;
    document.getElementById('v-info-name').innerText = c.name;
    document.getElementById('v-info-id').innerText = c.idNo;
    document.getElementById('v-info-phone').innerText = c.phone;
    document.getElementById('v-info-loc').innerText = c.location;
    document.getElementById('v-princ').innerText = c.principal;
    document.getElementById('v-paid').innerText = c.totalPaid || 0;
    document.getElementById('v-bal').innerText = (c.principal - (c.totalPaid || 0));
    
    renderHistoryTable(c);
}

function renderHistoryTable(c) {
    const tbody = document.getElementById('v-history-body');
    tbody.innerHTML = '';
    if(!c.history) return;

    Object.values(c.history).map(h => {
        // Red highlight if past 6pm (18:00)
        const isLate = h.time > "18:00" ? 'late-row' : '';
        tbody.innerHTML += `<tr class="${isLate}"><td>${h.date}</td><td>${h.activity}</td><td>${h.details}</td><td>${h.time}</td><td>${h.by}</td></tr>`;
    });
}
