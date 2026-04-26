import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc, query, where, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAEMpC9oczMDYybbkZirDkY9a25d8ZqjJw",
    authDomain: "jml-loans-560d8.firebaseapp.com",
    databaseURL: "https://jml-loans-560d8-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "jml-loans-560d8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Application State
let currentState = {
    user: null,
    view: 'clients',
    clients: []
};

// --- INITIALIZATION ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentState.user = user;
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        loadView('clients');
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
});

// --- CORE FINANCIAL LOGIC ---
const calculateLoanMetrics = (principal) => {
    const totalToPay = principal * 1.25;
    const profitExpected = totalToPay - principal;
    return { totalToPay, profitExpected };
};

// --- MODULE: ENROLL CLIENT ---
async function enrollClient(formData) {
    const { totalToPay } = calculateLoanMetrics(formData.principal);
    
    const clientData = {
        ...formData,
        totalToPay: totalToPay,
        totalPaid: 0,
        balance: totalToPay,
        status: 'Active',
        createdAt: new Date(),
        lastUpdated: new Date(),
        loanOfficer: auth.currentUser.email
    };

    const docRef = await addDoc(collection(db, "clients"), clientData);
    
    // Auto-create first history entry
    await addDoc(collection(db, "payments"), {
        clientId: docRef.id,
        date: new Date().toISOString().split('T')[0],
        activity: "NEW LOAN",
        details: `Initial Loan: KSH ${formData.principal} (Total Due: ${totalToPay})`,
        time: "08:00",
        handledBy: auth.currentUser.email,
        type: 'system'
    });

    loadView('clients');
}

// --- MODULE: CLIENT DOSSIER ---
async function renderClientDossier(clientId) {
    const q = query(collection(db, "payments"), where("clientId", "==", clientId), orderBy("date", "desc"));
    const paymentsSnap = await getDocs(q);
    
    let historyHtml = '';
    paymentsSnap.forEach(p => {
        const data = p.data();
        const isLate = parseInt(data.time.split(':')[0]) >= 18 ? 'row-late' : '';
        const isNew = data.activity === "NEW LOAN" ? 'row-new-loan' : '';
        
        historyHtml += `
            <tr class="${isLate} ${isNew}">
                <td>${data.date}</td>
                <td>${data.activity}</td>
                <td>${data.details}</td>
                <td>${data.time}</td>
                <td>${data.handledBy}</td>
            </tr>
        `;
    });

    // Update UI View Port...
    // (DOM manipulation code for the boxes described in instructions)
}

// --- MODULE: FINANCIALS (PROFIT/LOSS) ---
async function calculateGlobalFinancials() {
    const clientsSnap = await getDocs(collection(db, "clients"));
    let grandLoaned = 0;
    let totalPaid = 0;
    let totalProfit = 0;

    clientsSnap.forEach(doc => {
        const data = doc.data();
        grandLoaned += parseFloat(data.principal);
        totalPaid += parseFloat(data.totalPaid);
        // Profit is calculated from the 1.25x interest collected
        // We calculate what portion of the current payments constitutes profit
        const collectedInterest = data.totalPaid * 0.2; // 0.25/1.25 = 0.2
        totalProfit += collectedInterest;
    });

    // Update Financials Module UI
}

// --- MODES MODULE ---
function toggleTheme() {
    const html = document.documentElement;
    const newTheme = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// --- NAVIGATION CONTROLLER ---
document.querySelectorAll('#main-nav li').forEach(li => {
    li.addEventListener('click', () => {
        document.querySelector('#main-nav li.active').classList.remove('active');
        li.classList.add('active');
        loadView(li.dataset.view);
    });
});

function loadView(viewName) {
    const port = document.getElementById('view-port');
    document.getElementById('view-title').innerText = viewName.toUpperCase();
    
    switch(viewName) {
        case 'clients':
            renderClientsList();
            break;
        case 'enroll':
            renderEnrollForm();
            break;
        // ... Other cases
    }
}
