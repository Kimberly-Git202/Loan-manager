import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, addDoc, getDocs, updateDoc, doc, 
    query, where, orderBy, onSnapshot, runTransaction, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyAEMpC9oczMDYybbkZirDkY9a25d8ZqjJw",
    authDomain: "jml-loans-560d8.firebaseapp.com",
    databaseURL: "https://jml-loans-560d8-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "jml-loans-560d8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- APP STATE ---
let currentUserData = null;

// --- AUTHENTICATION GATE ---
onAuthStateChanged(auth, async (user) => {
    const authUI = document.getElementById('auth-container');
    const appUI = document.getElementById('app-container');

    if (user) {
        authUI.classList.add('hidden');
        appUI.classList.remove('hidden');
        // Load initial view
        navigateTo('clients');
    } else {
        authUI.classList.remove('hidden');
        appUI.classList.add('hidden');
    }
});

// --- CORE UTILITIES ---
const navigateTo = (view) => {
    // UI logic to switch views and update Sidebar Active state
    console.log(`Navigating to: ${view}`);
    renderView(view);
};

// --- FINANCIAL CALCULATIONS (The 1.25x Rules) ---
const Financials = {
    calcDebt: (principal) => parseFloat(principal) * 1.25,
    calcProfitFromPay: (payAmount) => parseFloat(payAmount) * 0.20, // 25% interest is 20% of total repaid
};

// --- CLIENT ENROLLMENT ---
window.handleEnrollment = async (event) => {
    event.preventDefault();
    const form = event.target;
    const principal = parseFloat(form.principal.value);
    const totalDue = Financials.calcDebt(principal);

    const clientObj = {
        fullName: form.fullName.value,
        idNumber: form.idNumber.value,
        phone: form.phone.value,
        location: form.location.value,
        occupation: form.occupation.value,
        referral: form.referral.value,
        principal: principal,
        totalToPay: totalDue,
        totalPaid: 0,
        balance: totalDue,
        status: 'Active',
        createdAt: serverTimestamp()
    };

    try {
        const docRef = await addDoc(collection(db, "clients"), clientObj);
        
        // Auto-log the New Loan in History
        await addDoc(collection(db, "payments"), {
            clientId: docRef.id,
            activity: "NEW LOAN",
            details: `Issued KSH ${principal}. Total due: ${totalDue}`,
            date: new Date().toISOString().split('T')[0],
            time: "08:00", // Default start time
            handledBy: auth.currentUser.email,
            isNewLoan: true
        });

        alert("Client Enrolled Successfully!");
        navigateTo('clients');
    } catch (e) {
        console.error("Error adding client: ", e);
    }
};

// --- PAYMENT PROCESSING (Smart Rules) ---
window.processPayment = async (clientId, amount, timeInput) => {
    if (!confirm(`Confirm payment of KSH ${amount}?`)) return;

    const clientRef = doc(db, "clients", clientId);
    const isLate = parseInt(timeInput.split(':')[0]) >= 18;

    try {
        await runTransaction(db, async (transaction) => {
            const clientDoc = await transaction.get(clientRef);
            const data = clientDoc.data();
            const newBalance = data.balance - amount;

            transaction.update(clientRef, {
                balance: newBalance,
                totalPaid: data.totalPaid + amount,
                lastUpdated: serverTimestamp()
            });

            transaction.set(doc(collection(db, "payments")), {
                clientId,
                activity: "REPAYMENT",
                details: `Paid KSH ${amount}`,
                date: new Date().toISOString().split('T')[0],
                time: timeInput,
                handledBy: auth.currentUser.email,
                isLate: isLate
            });

            // Settlement Automation
            if (newBalance <= 0) {
                transaction.set(doc(collection(db, "settled_loans")), {
                    ...data,
                    balance: 0,
                    clearedDate: new Date().toISOString().split('T')[0]
                });
                transaction.update(clientRef, { status: 'Settled' });
            }
        });
        alert("Payment Recorded.");
        renderClientDossier(clientId);
    } catch (e) {
        alert("Transaction failed: " + e.message);
    }
};

// --- DARK/LIGHT MODE ---
window.toggleMode = () => {
    const current = document.documentElement.getAttribute('data-theme');
    const target = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', target);
    localStorage.setItem('theme', target);
};

// Initialize theme on load
document.documentElement.setAttribute('data-theme', localStorage.getItem('theme') || 'light');
