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

// SYNC & INIT DROPDOWNS
db.ref('jml_master_records').on('value', snap => {
    const data = snap.val();
    clients = data ? Object.keys(data).map(k => ({ key: k, ...data[k] })) : [];
    renderMainList();
    populateDropdowns();
    runCalculations();
});

function populateDropdowns() {
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthHtml = months.map((m, i) => `<option value="${i+1}">${m} 2026</option>`).join('');
    document.getElementById('f-month-sel').innerHTML = monthHtml;
    document.getElementById('loan-month').innerHTML = monthHtml;
    document.getElementById('settle-month').innerHTML = monthHtml;
}

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

// VIEW CLIENT (INTEGRATED)
window.openView = (key) => {
    activeKey = key;
    const c = clients.find(x => x.key === key);
    showSec('view-sec'); // Show the view section beside sidebar

    document.getElementById('v-title-name').innerText = c.name;
    document.getElementById('v-title-id').innerText = c.idNo;
    document.getElementById('v-info-name').innerText = c.name;
    document.getElementById('v-info-id').innerText = c.idNo;
    document.getElementById('v-info-phone').innerText = c.phone;
    document.getElementById('v-info-loc').innerText = c.location;
    document.getElementById('v-info-occ').innerText = c.occupation;
    document.getElementById('v-info-ref').innerText = c.referral;
    document.getElementById('v-princ').innerText = `KSH ${c.principal}`;
    document.getElementById('v-paid').innerText = `KSH ${c.totalPaid || 0}`;
    document.getElementById('v-bal').innerText = `KSH ${c.balance}`;
    document.getElementById('v-next').innerText = c.nextDue || "N/A";
    document.getElementById('v-start').value = c.startDate || "";
    document.getElementById('v-end').value = c.endDate || "";
    
    renderHistory(c.history);
}

function renderHistory(history) {
    const body = document.getElementById('v-history-body');
    body.innerHTML = history ? Object.values(history).map(h => {
        const isLate = h.time > "18:00";
        return `<tr class="${isLate ? 'late-row' : ''}">
            <td>${h.date}</td><td>${h.activity}</td><td>${h.details}</td><td>${h.time}</td><td>Admin</td>
        </tr>`;
    }).join('') : '';
}

// FILTERING LOGIC (APRIL ONLY ETC)
window.renderSaturdayLoans = () => {
    const month = parseInt(document.getElementById('loan-month').value);
    const week = parseInt(document.getElementById('loan-week').value);
    const body = document.getElementById('saturday-body');
    
    body.innerHTML = clients.filter(c => {
        const d = new Date(c.startDate);
        const isSat = d.getDay() === 6;
        const isMonth = (d.getMonth() + 1) === month;
        const isWeek = Math.ceil(d.getDate() / 7) === week;
        return isSat && isMonth && isWeek;
    }).map(c => `<tr><td>${c.name}</td><td>${c.idNo}</td><td>${c.phone}</td><td>KSH ${c.principal}</td><td>${c.startDate}</td></tr>`).join('');
};

window.renderSettled = () => {
    const month = parseInt(document.getElementById('settle-month').value);
    const body = document.getElementById('settled-body');
    body.innerHTML = clients.filter(c => {
        const d = new Date(c.lastUpdated);
        return c.status === 'Inactive' && (d.getMonth() + 1) === month;
    }).map(c => `<tr><td>${c.name}</td><td>${c.idNo}</td><td>${c.totalPaid}</td><td>${c.lastUpdated}</td></tr>`).join('');
};

// ENROLL & PROCESS (UNCHANGED LOGIC, JUST UI SYNC)
window.enrollClient = () => {
    const id = document.getElementById('e-id').value;
    const p = parseFloat(document.getElementById('e-princ').value);
    if(!id || isNaN(p)) return alert("Fill Name and Principal");

    db.ref('jml_master_records/' + id).set({
        name: document.getElementById('e-name').value, idNo: id,
        phone: document.getElementById('e-phone').value, location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value, referral: document.getElementById('e-ref').value,
        principal: p, balance: p, totalPaid: 0, startDate: document.getElementById('e-start').value,
        endDate: document.getElementById('e-end').value, status: 'Active'
    }).then(() => { alert("Saved!"); showSec('list-sec'); });
};

function renderMainList() {
    const body = document.getElementById('clientsTableBody');
    body.innerHTML = clients.map((c, i) => `
        <tr><td>${i+1}</td><td>${c.name}</td><td>${c.idNo}</td><td>${c.phone}</td>
        <td>${c.totalPaid || 0}</td><td>${c.balance}</td>
        <td><button class="btn btn-p" onclick="openView('${c.key}')">VIEW</button></td></tr>
    `).join('');
}
