import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, onValue, get } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
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
let activeID = null;

// --- AUTH CHECK ---
onAuthStateChanged(auth, user => {
    if (user) {
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        document.getElementById('user-display').innerText = `Staff: ${user.email}`;
        loadData();
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
    }
});

// --- DATA LOADING ---
function loadData() {
    console.log("Attempting to fetch data from Firebase...");
    const dataRef = ref(db, 'jml_data');
    onValue(dataRef, (snap) => {
        const data = snap.val();
        console.log("Data Received:", data);
        if (data) {
            allClients = Object.values(data);
            renderTable(allClients);
            calculateFinancials();
        } else {
            console.log("No clients found in database.");
            document.getElementById('clientTableBody').innerHTML = "<tr><td colspan='7'>No clients enrolled yet.</td></tr>";
        }
    });
}

// --- ENROLLMENT ---
window.enrollClient = async () => {
    const idNum = document.getElementById('e-id').value.trim();
    const name = document.getElementById('e-name').value.trim();
    
    if(!idNum || !name) return alert("Error: Name and ID Number are mandatory!");

    const clientData = {
        name: name,
        phone: document.getElementById('e-phone').value,
        idNumber: idNum,
        location: document.getElementById('e-loc').value,
        occupation: document.getElementById('e-occ').value,
        referral: document.getElementById('e-ref').value,
        principal: parseFloat(document.getElementById('e-princ').value) || 0,
        balance: parseFloat(document.getElementById('e-princ').value) || 0,
        totalPaid: 0,
        startDate: document.getElementById('e-start').value || new Date().toISOString().split('T')[0],
        endDate: document.getElementById('e-end').value || "Ongoing",
        status: "Active",
        history: [{
            date: new Date().toLocaleDateString('en-GB'),
            activity: 'Loan Started',
            details: `Initial Loan KSh ${document.getElementById('e-princ').value || 0}`,
            time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            by: auth.currentUser.email.split('@')[0]
        }]
    };

    console.log("Saving client:", idNum);
    try {
        await set(ref(db, 'jml_data/' + idNum), clientData);
        alert("Success: " + name + " has been enrolled!");
        
        // Reset Form
        document.querySelectorAll('#add-sec input').forEach(input => input.value = "");
        window.showSection('list-sec');
    } catch (err) {
        console.error("Enrollment failed:", err);
        alert("Firebase Error: " + err.message);
    }
};

// --- SEARCH FUNCTION ---
window.doSearch = () => {
    const term = document.getElementById('globalSearch').value.toLowerCase();
    const filtered = allClients.filter(c => 
        c.name.toLowerCase().includes(term) || 
        c.idNumber.toLowerCase().includes(term)
    );
    renderTable(filtered);
};

// --- TABLE RENDERING ---
window.renderTable = (list) => {
    const tbody = document.getElementById('clientTableBody');
    const todayStr = new Date().toLocaleDateString('en-GB');
    const now = new Date();
    const isPast6PM = now.getHours() >= 18;

    if (list.length === 0) {
        tbody.innerHTML = "<tr><td colspan='7'>No results found.</td></tr>";
        return;
    }

    tbody.innerHTML = list.map((c, i) => {
        const history = c.history || [];
        const hasPaidToday = history.some(h => h.date === todayStr && h.activity === 'Payment');
        
        // Highlight in red if past 6pm and hasn't paid
        let rowClass = (isPast6PM && !hasPaidToday) ? "late-row" : "";

        return `
            <tr class="${rowClass}">
                <td>${i + 1}</td>
                <td><strong>${c.name || 'Unknown'}</strong></td>
                <td>${c.idNumber}</td>
                <td>${c.phone || 'N/A'}</td>
                <td>KSh ${c.totalPaid || 0}</td>
                <td>KSh ${(c.balance || 0).toLocaleString()}</td>
                <td><button class="btn-post" onclick="openDashboard('${c.idNumber}')">View</button></td>
            </tr>
        `;
    }).join('');
};

// --- DASHBOARD ---
window.openDashboard = (id) => {
    const c = allClients.find(x => x.idNumber === id);
    if(!c) return;
    activeID = id;

    document.getElementById('v-name').innerText = c.name;
    document.getElementById('v-id').innerText = c.idNumber;
    document.getElementById('vi-name').innerText = c.name;
    document.getElementById('vi-id').innerText = c.idNumber;
    document.getElementById('vi-phone').innerText = c.phone;
    document.getElementById('vi-loc').innerText = c.location;
    document.getElementById('vl-princ').innerText = `KSh ${c.principal}`;
    document.getElementById('vl-bal').innerText = `KSh ${c.balance}`;
    document.getElementById('vl-next').innerText = c.nextPaymentStr || "Not set";
    
    const hBody = document.getElementById('historyBody');
    hBody.innerHTML = (c.history || []).map(h => `
        <tr>
            <td>${h.date}</td>
            <td>${h.activity}</td>
            <td>${h.details}</td>
            <td>${h.time}</td>
            <td>${h.by}</td>
        </tr>
    `).join('');

    document.getElementById('detailWindow').classList.remove('hidden');
};

// --- SIDEBAR NAVIGATION ---
window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    
    // Update active nav style
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    event.currentTarget.classList.add('active');
};

// --- GLOBAL UI ---
window.closeDetails = () => document.getElementById('detailWindow').classList.add('hidden');
window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('active');
window.toggleTheme = () => document.body.classList.toggle('dark-mode');
window.handleLogin = () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, e, p).catch(err => alert("Login Error: " + err.message));
};
window.handleLogout = () => signOut(auth).then(() => location.reload());
