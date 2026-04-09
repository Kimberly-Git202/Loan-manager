let clients = JSON.parse(localStorage.getItem('jml_clients')) || [];
let activeIdx = null;

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('minimized'); }

function showSection(id) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelector(`[onclick="showSection('${id}')"]`).classList.add('active');
}

document.getElementById('clientForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const loan = parseFloat(document.getElementById('f-loan').value);
    const newClient = {
        name: document.getElementById('f-name').value,
        occupation: document.getElementById('f-occ').value || "---",
        idNum: document.getElementById('f-id').value || "---",
        referral: document.getElementById('f-ref').value || "---",
        phone: document.getElementById('f-phone').value || "---",
        address: document.getElementById('f-addr').value || "---",
        loan: loan,
        balance: loan,
        status: "Active",
        notes: "",
        history: [{ date: new Date().toLocaleDateString('en-GB'), activity: "Account Created", details: `Loan of KSh ${loan.toLocaleString()}`, handledBy: "Admin" }]
    };
    clients.push(newClient);
    saveAll();
    renderTable();
    showSection('list-sec');
    this.reset();
});

function renderTable() {
    const tbody = document.getElementById('clientTableBody');
    tbody.innerHTML = clients.map((c, i) => `
        <tr>
            <td>${i + 1}</td>
            <td><strong>${c.name}</strong></td>
            <td>${c.phone}</td>
            <td>KSh ${c.balance.toLocaleString()}</td>
            <td><button onclick="viewDetails(${i})" style="color:var(--primary); cursor:pointer; background:none; border:1px solid var(--primary); padding:5px 10px; border-radius:5px;">Dashboard</button></td>
        </tr>
    `).join('');
}

function viewDetails(i) {
    activeIdx = i;
    const c = clients[i];
    document.getElementById('d-name').innerText = c.name;
    document.getElementById('d-occ').innerText = c.occupation;
    document.getElementById('d-idnum').innerText = c.idNum;
    document.getElementById('d-ref').innerText = c.referral;
    document.getElementById('d-phone').innerText = c.phone;
    document.getElementById('d-addr').innerText = c.address;
    document.getElementById('d-status').value = c.status;
    document.getElementById('d-loan').innerText = `KSh ${c.loan.toLocaleString()}`;
    document.getElementById('d-bal-input').value = c.balance;
    document.getElementById('d-notes').value = c.notes;
    
    renderActivity();
    document.getElementById('detailWindow').classList.remove('hidden');
}

function renderActivity() {
    const tbody = document.getElementById('activityTableBody');
    tbody.innerHTML = clients[activeIdx].history.slice().reverse().map(h => `
        <tr>
            <td>${h.date}</td>
            <td><strong>${h.activity}</strong></td>
            <td>${h.details}</td>
            <td>${h.handledBy}</td>
        </tr>
    `).join('');
}

function updatePayment() {
    const val = parseFloat(document.getElementById('dailyPay').value);
    if (val > 0) {
        clients[activeIdx].balance -= val;
        clients[activeIdx].history.push({
            date: new Date().toLocaleDateString('en-GB'),
            activity: "Payment",
            details: `KSh ${val.toLocaleString()} Paid`,
            handledBy: "Admin"
        });
        saveAll();
        viewDetails(activeIdx);
        renderTable();
        document.getElementById('dailyPay').value = "";
    } else {
        alert("Please enter a valid payment amount.");
    }
}

function saveManualBalance() {
    const newVal = parseFloat(document.getElementById('d-bal-input').value);
    const oldVal = clients[activeIdx].balance;
    if (newVal !== oldVal) {
        clients[activeIdx].history.push({
            date: new Date().toLocaleDateString('en-GB'),
            activity: "Adjustment",
            details: `Manually changed to KSh ${newVal.toLocaleString()}`,
            handledBy: "Admin"
        });
        clients[activeIdx].balance = newVal;
        saveAll();
        renderTable();
    }
}

function updateClientField(field, value) {
    clients[activeIdx][field] = value;
    saveAll();
    renderTable();
}

function markAsCleared() {
    if(confirm("Confirm this loan is fully cleared?")) {
        clients[activeIdx].balance = 0;
        clients[activeIdx].status = "Cleared";
        clients[activeIdx].history.push({
            date: new Date().toLocaleDateString('en-GB'),
            activity: "Loan Cleared",
            details: "Client completed all payments",
            handledBy: "Admin"
        });
        saveAll();
        viewDetails(activeIdx);
        renderTable();
    }
}

function searchClients() {
    const term = document.getElementById('globalSearch').value.toLowerCase();
    const tbody = document.getElementById('clientTableBody');
    const filtered = clients.filter(c => c.name.toLowerCase().includes(term));
    tbody.innerHTML = filtered.map((c, i) => {
        const originalIndex = clients.indexOf(c);
        return `
            <tr>
                <td>${originalIndex + 1}</td>
                <td><strong>${c.name}</strong></td>
                <td>${c.phone}</td>
                <td>KSh ${c.balance.toLocaleString()}</td>
                <td><button onclick="viewDetails(${originalIndex})" style="color:var(--primary); cursor:pointer; background:none; border:1px solid var(--primary); padding:5px 10px; border-radius:5px;">Dashboard</button></td>
            </tr>
        `;
    }).join('');
}

function saveAll() { localStorage.setItem('jml_clients', JSON.stringify(clients)); }
function closeDetails() { document.getElementById('detailWindow').classList.add('hidden'); }
window.onload = renderTable;
