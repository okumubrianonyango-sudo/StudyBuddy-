function showTab(tabId) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('d-none');
    });

    // Show the targeted tab
    const activeTab = document.getElementById(tabId);
    if (activeTab) {
        activeTab.classList.remove('d-none');
        window.scrollTo(0, 0);
    } else {
        console.error("Could not find tab with ID:", tabId);
    }
}


// ==========================================
// 1. INITIALIZATION & SERVICE WORKER
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Offline Mode Ready!', reg))
            .catch(err => console.log('Offline Setup Failed', err));
    });
}

window.onload = () => {
    // Check theme
    if (localStorage.getItem('theme') === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        if (document.getElementById('themeSwitch')) document.getElementById('themeSwitch').checked = true;
    }
    
    // Start on the Lab tab
    showTab('chemTab');
    displayConstants();
};


// ==========================================
// 2. GLOBAL DATA & DATABASE SETUP
// ==========================================
const CHEM_CONSTANTS = [
    { name: "Gas Constant (R)", value: "8.314", unit: "J/(mol·K)", label: "SI Units" },
    { name: "Gas Constant (R)", value: "0.08206", unit: "L·atm/(mol·K)", label: "Atmospheres" },
    { name: "Gas Constant (R)", value: "62.364", unit: "L·torr/(mol·K)", label: "Torr/mmHg" },
    { name: "Avogadro's (Nₐ)", value: "6.022e23", unit: "mol⁻¹", label: "Entities" },
    { name: "Boltzmann (kᵦ)", value: "1.381e-23", unit: "J/K", label: "Energy/Temp" },
    { name: "STP Temp", value: "273.15", unit: "K", label: "Standard Temp" },
    { name: "STP Pressure", value: "1.000", unit: "atm", label: "Standard Press" }
];

const ATOMIC_WEIGHTS = {
    H: 1.008, He: 4.003, B: 10.81, C: 12.01, N: 14.01, O: 16.00, F: 19.00, Ne: 20.18,
    P: 30.97, S: 32.06, Cl: 35.45, Ar: 39.95, Se: 78.97, Br: 79.90, Kr: 83.80, I: 126.90,
    Li: 6.94, Na: 22.99, K: 39.10, Rb: 85.47, Cs: 132.91,
    Be: 9.01, Mg: 24.31, Ca: 40.08, Sr: 87.62, Ba: 137.33,
    Ti: 47.87, V: 50.94, Cr: 52.00, Mn: 54.94, Fe: 55.85, Co: 58.93, Ni: 58.69, 
    Cu: 63.55, Zn: 65.38, Mo: 95.95, Pd: 106.42, Ag: 107.87, Cd: 112.41, 
    Pt: 195.08, Au: 196.97, Hg: 200.59, Pb: 207.2, W: 183.84,
    Al: 26.98, Si: 28.09, Sn: 118.71, Sb: 121.76
};

let db;
const dbRequest = indexedDB.open("StudyBuddyDB", 1);
dbRequest.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("labPhotos")) {
        db.createObjectStore("labPhotos", { keyPath: "noteId" });
    }
};
dbRequest.onsuccess = (e) => {
    db = e.target.result;
    displayNotes(); 
};

// ==========================================
// 3. CORE NAVIGATION & UI
// ==========================================


function toggleTheme() {
    const isDark = document.getElementById('themeSwitch').checked;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.innerText = message;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

function displayConstants() {
    const table = document.getElementById('constantsTable');
    if (!table) return;
    table.innerHTML = CHEM_CONSTANTS.map(c => `
        <tr class="border-bottom">
            <td>
                <div class="fw-bold text-primary">${c.name}</div>
                <div class="text-muted" style="font-size: 0.7rem;">${c.label}</div>
            </td>
            <td class="text-end">
                <code class="fw-bold text-dark">${c.value}</code><br>
                <small class="text-secondary">${c.unit}</small>
            </td>
            <td class="text-end">
                <button class="btn btn-sm p-0 text-info" onclick="copyToNote('${c.value}')">📋</button>
            </td>
        </tr>
    `).join('');
}

function copyToNote(value) {
    const noteArea = document.getElementById('noteContent');
    if (noteArea) {
        noteArea.value += (noteArea.value ? ' ' : '') + value;
        showToast("Constant added to note!");
    } else {
        showTab('notesTab');
        showToast("Switch to Logs to use this!");
    }
}

// ==========================================
// 4. NOTES & LOGS ENGINE
// ==========================================
async function saveNote() {
    const title = document.getElementById('noteTitle').value.trim();
    const content = document.getElementById('noteContent').value.trim();
    const photoInput = document.getElementById('labPhotoInput');
    const photoFile = photoInput ? photoInput.files[0] : null;

    if (!title || !content) {
        showToast("Please enter a title and content!");
        return;
    }

    const noteId = Date.now();
    const notes = JSON.parse(localStorage.getItem('studyNotes')) || [];
    notes.unshift({ id: noteId, title, content, date: new Date().toLocaleString() });
    localStorage.setItem('studyNotes', JSON.stringify(notes));

    if (photoFile && db) {
        const transaction = db.transaction(["labPhotos"], "readwrite");
        transaction.objectStore("labPhotos").add({ noteId: noteId, image: photoFile });
    }

    document.getElementById('noteTitle').value = "";
    document.getElementById('noteContent').value = "";
    if (photoInput) photoInput.value = "";
    displayNotes();
    showToast("Session Saved!");
}

function displayNotes() {
    const list = document.getElementById('notesList');
    if (!list) return;
    const notes = JSON.parse(localStorage.getItem('studyNotes')) || [];
    if (notes.length === 0) {
        list.innerHTML = `<p class="text-center text-muted p-4">No logs yet.</p>`;
        return;
    }
    list.innerHTML = notes.map(n => `
        <div class="card p-3 mb-2 shadow-sm border-0">
            <div class="d-flex justify-content-between">
                <h6 class="fw-bold text-primary mb-1">${n.title}</h6>
                <button class="btn btn-sm text-danger border-0 p-0" onclick="deleteNote(${n.id})">🗑️</button>
            </div>
            <p class="small text-secondary mb-2">${n.content}</p>
            <button class="btn btn-sm btn-outline-info w-100" onclick="viewPhoto(${n.id})">🖼️ View Photo</button>
        </div>
    `).join('');
}

function deleteNote(noteId) {
    if (!confirm("Delete this log?")) return;
    let notes = JSON.parse(localStorage.getItem('studyNotes')) || [];
    notes = notes.filter(n => n.id !== noteId);
    localStorage.setItem('studyNotes', JSON.stringify(notes));
    if (db) {
        const transaction = db.transaction(["labPhotos"], "readwrite");
        transaction.objectStore("labPhotos").delete(noteId);
    }
    displayNotes();
}

function viewPhoto(noteId) {
    if (!db) return;
    const transaction = db.transaction(["labPhotos"], "readonly");
    const request = transaction.objectStore("labPhotos").get(noteId);
    request.onsuccess = () => {
        if (request.result) {
            const url = URL.createObjectURL(request.result.image);
            window.open(url, '_blank');
        } else { showToast("No photo found."); }
    };
}

// ==========================================
// 5. CHEMISTRY TOOLS & CALCULATIONS
// ==========================================

function calculateMolarMass() {
    const formulaInput = document.getElementById('chemFormula');
    const resultDisplay = document.getElementById('chemResult');
    const solMMInput = document.getElementById('solMM');
    let formula = formulaInput.value.trim();

    if (!formula) {
        showToast("Enter a formula first!");
        return;
    }

    let totalMass = 0;
    const bracketRegex = /\(([^)]+)\)(\d*)/g;
    let bracketMatch;
    
    while ((bracketMatch = bracketRegex.exec(formula)) !== null) {
        const innerFormula = bracketMatch[1];
        const multiplier = parseInt(bracketMatch[2]) || 1;
        const innerMass = calculateSimpleMass(innerFormula);
        if (innerMass === null) {
            resultDisplay.innerHTML = `<span class="text-danger small">Error in brackets</span>`;
            return;
        }
        totalMass += (innerMass * multiplier);
    }

    const remainingFormula = formula.replace(/\(([^)]+)\)(\d*)/g, '');
    const restMass = calculateSimpleMass(remainingFormula);
    
    if (restMass === null) {
        resultDisplay.innerHTML = `<span class="text-danger small">Invalid Element</span>`;
        return;
    }
    
    totalMass += restMass;
    const formattedMass = totalMass.toFixed(3);
    resultDisplay.innerHTML = `<span class="fw-bold text-info">${formattedMass} g/mol</span>`;
    if (solMMInput) solMMInput.value = formattedMass;
}

function calculateSimpleMass(subFormula) {
    const elementRegex = /([A-Z][a-z]*)(\d*)/g;
    let mass = 0;
    let match;
    let found = false;
    while ((match = elementRegex.exec(subFormula)) !== null) {
        found = true;
        const element = match[1];
        const count = parseInt(match[2]) || 1;
        if (ATOMIC_WEIGHTS[element]) {
            mass += ATOMIC_WEIGHTS[element] * count;
        } else {
            return null;
        }
    }
    return found ? mass : 0;
}

function calculateMolarity() {
    const mass = parseFloat(document.getElementById('solMass').value);
    const mm = parseFloat(document.getElementById('solMM').value);
    const vol = parseFloat(document.getElementById('solVol').value);
    const resDiv = document.getElementById('solResult');

    if (isNaN(mass) || isNaN(mm) || isNaN(vol)) {
        showToast("Fill Mass, Molar Mass, and Volume!");
        return;
    }
    const molarity = (mass / mm) / (vol / 1000);
    resDiv.innerHTML = `Molarity: <span class="text-dark">${molarity.toFixed(4)} M</span>`;
}

function calculateDilution() {
    const m1 = parseFloat(document.getElementById('dilM1').value);
    const v1 = parseFloat(document.getElementById('dilV1').value);
    const m2 = parseFloat(document.getElementById('dilM2').value);
    const v2 = parseFloat(document.getElementById('dilV2').value);
    const resDiv = document.getElementById('solResult');

    let resText = "";
    if (isNaN(m1)) resText = `M1 = ${(m2 * v2) / v1} M`;
    else if (isNaN(v1)) resText = `V1 = ${(m2 * v2) / m1} mL`;
    else if (isNaN(m2)) resText = `M2 = ${(m1 * v1) / v2} M`;
    else if (isNaN(v2)) resText = `V2 = ${(m1 * v1) / m2} mL`;
    else {
        showToast("Leave one field empty!");
        return;
    }
    resDiv.innerHTML = `Result: <span class="text-dark">${resText}</span>`;
}

function calculateGasLaw() {
    const P = parseFloat(document.getElementById('gasP').value);
    const V = parseFloat(document.getElementById('gasV').value);
    const n = parseFloat(document.getElementById('gasN').value);
    const T = parseFloat(document.getElementById('gasT').value);
    const pUnit = document.getElementById('gasPUnit').value;
    const resDiv = document.getElementById('gasResult');

    const R_VALUES = { atm: 0.08206, kPa: 8.314, bar: 0.08314 };
    const R = R_VALUES[pUnit];

    let resultText = "";
    if (isNaN(P)) resultText = `P = ${((n * R * T) / V).toFixed(3)} ${pUnit}`;
    else if (isNaN(V)) resultText = `V = ${((n * R * T) / P).toFixed(3)} L`;
    else if (isNaN(n)) resultText = `n = ${((P * V) / (R * T)).toFixed(3)} mol`;
    else if (isNaN(T)) resultText = `T = ${((P * V) / (n * R)).toFixed(2)} K`;
    else {
        showToast("Leave one field empty!");
        return;
    }
    resDiv.innerHTML = `Result: <span class="text-dark">${resultText}</span>`;
}

function convertUnits() {
    const val = parseFloat(document.getElementById('unitValue').value);
    const from = document.getElementById('unitFrom').value;
    const to = document.getElementById('unitTo').value;
    const display = document.getElementById('unitResult');

    if (isNaN(val)) return;

    // 1. Temperature Logic (Non-multiplicative)
    if ((from === 'C' || from === 'K') && (to === 'C' || to === 'K')) {
        let res = (from === 'C' && to === 'K') ? val + 273.15 : (from === 'K' && to === 'C' ? val - 273.15 : val);
        display.innerHTML = `<b>${res.toFixed(2)} ${to}</b>`;
        return;
    }

    // 2. Multiplicative Factors (Relative to base units: J, atm, L)
    const energyFactors = { J: 1, kJ: 1000, cal: 4.184, kcal: 4184 };
    const pressureFactors = { atm: 1, psi: 0.068046, bar: 0.986923, kPa: 0.009869, torr: 0.00131579 };
    const volumeFactors = { L: 1, mL: 0.001, m3: 1000 };

    // 3. Match the Category
    let factors = null;
    if (energyFactors[from] && energyFactors[to]) factors = energyFactors;
    else if (pressureFactors[from] && pressureFactors[to]) factors = pressureFactors;
    else if (volumeFactors[from] && volumeFactors[to]) factors = volumeFactors;

    if (!factors) {
        display.innerHTML = `<span class="text-danger small">Category Mismatch</span>`;
        return;
    }

    // 4. Calculate: (Value * From-Factor) / To-Factor
    const result = (val * factors[from]) / factors[to];
    
    // Using toPrecision(5) is better for very small or very large chemistry values
    display.innerHTML = `<b>${result.toPrecision(5)} ${to}</b>`;
}


// ==========================================
// 6. AI, VOICE & OCR
// ==========================================

async function scanImage() {
    const status = document.getElementById('scanStatus');
    const file = document.getElementById('cameraInput').files[0];
    if (!file) return;
    status.innerText = "⏳ AI Reading...";
    try {
        const worker = await Tesseract.createWorker('eng');
        const { data: { text } } = await worker.recognize(file);
        document.getElementById('noteContent').value += (document.getElementById('noteContent').value ? '\n' : '') + text;
        status.innerText = "✅ Done";
        await worker.terminate();
    } catch (e) {
        status.innerText = "❌ Scan Failed";
    }
}

function toggleDictation() {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) return showToast("Not supported in this browser.");
    const rec = new Speech();
    rec.onresult = (e) => { 
        document.getElementById('noteContent').value += " " + e.results[0][0].transcript; 
    };
    rec.start();
    showToast("Listening...");
}

function generateAIQuiz() {
    const notes = JSON.parse(localStorage.getItem('studyNotes')) || [];
    if (notes.length === 0) return showToast("Save lab notes first!");
    const container = document.getElementById('quizContainer');
    const content = document.getElementById('quizContent');
    container.classList.remove('d-none');
    const latest = notes[0];
    content.innerHTML = `
        <p class="small text-muted">Quiz on: <b>${latest.title}</b></p>
        <p>Based on: <i>"${latest.content.substring(0, 60)}..."</i></p>
        <p class="fw-bold">What is the safety protocol for this?</p>
        <textarea id="quizAnswer" class="form-control mb-2"></textarea>
        <button class="btn btn-sm btn-success w-100" onclick="checkQuiz()">Submit</button>
    `;
}

function checkQuiz() {
    if (document.getElementById('quizAnswer').value.length < 5) showToast("Write more!");
    else { showToast("Great job!"); closeQuiz(); }
}

function closeQuiz() { document.getElementById('quizContainer').classList.add('d-none'); }

function predictOutcome() {
    const temp = parseFloat(document.getElementById('predTemp').value);
    const conc = parseFloat(document.getElementById('predConc').value);
    const time = parseFloat(document.getElementById('predTime').value);
    const resultDiv = document.getElementById('predictionResult');
    if (isNaN(temp) || isNaN(conc) || isNaN(time)) return showToast("Fill all fields!");
    resultDiv.innerHTML = `<div class="spinner-border spinner-border-sm text-success"></div> Analyzing...`;
    setTimeout(() => {
        const yieldVal = Math.min((conc * time * Math.pow(1.15, (temp - 273.15) / 10) * 0.12), 99.9).toFixed(2);
        resultDiv.innerHTML = `<div class="p-3 bg-light border-start border-success border-4 mt-2 h3">${yieldVal}% Yield</div>`;
    }, 1200);
}
async function exportLogsToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const notes = JSON.parse(localStorage.getItem('studyNotes')) || [];

    if (notes.length === 0) {
        showToast("No logs to export!");
        return;
    }

    // Header Styles
    doc.setFontSize(18);
    doc.setTextColor(13, 110, 253); // Professional Blue
    doc.text("Study Buddy: Industrial Chemistry Logs", 10, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 10, 28);
    doc.line(10, 30, 200, 30); // Horizontal line

    let yOffset = 40;

    notes.forEach((note, index) => {
        // Check if we need a new page
        if (yOffset > 270) {
            doc.addPage();
            yOffset = 20;
        }

        // Note Title
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.setFont("helvetica", "bold");
        doc.text(`${index + 1}. ${note.title}`, 10, yOffset);
        
        // Date
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(150);
        doc.text(`Date: ${note.date}`, 10, yOffset + 7);

        // Content
        doc.setTextColor(50);
        const splitText = doc.splitTextToSize(note.content, 180);
        doc.text(splitText, 10, yOffset + 15);

        yOffset += (splitText.length * 7) + 25; // Dynamic spacing
    });

    doc.save(`Chemistry_Logs_${Date.now()}.pdf`);
    showToast("PDF Downloaded!");
}
// 1. Load cards from LocalStorage or use defaults if empty
let thermoCards = JSON.parse(localStorage.getItem('myStudyCards')) || [
    { q: "First Law of Thermodynamics", a: "Energy cannot be created or destroyed, only transformed (ΔU = Q - W)." },
    { q: "Hess's Law", a: "The total enthalpy change for a reaction is the same regardless of the number of steps." },
    { q: "Nitrogen Boiling Point", a: "Approximately -195.8°C (Used in fractional distillation)." }
];
// --- MISSING ENGINE PIECES ---
let currentCardIndex = 0;
let showingAnswer = false;

function updateCard() {
    const display = document.getElementById('card-text');
    if (!display) return; // Safety check
    
    if (showingAnswer) {
        display.innerText = thermoCards[currentCardIndex].a;
        display.classList.add('text-info');
    } else {
        display.innerText = thermoCards[currentCardIndex].q;
        display.classList.remove('text-info');
    }
}

// Logic to flip the card when you tap it
document.addEventListener('DOMContentLoaded', () => {
    const cardElement = document.getElementById('flashcard');
    if (cardElement) {
        cardElement.addEventListener('click', () => {
            showingAnswer = !showingAnswer;
            updateCard();
        });
    }
    // Initialize the first card display
    updateCard();
});

function nextCard() {
    currentCardIndex = (currentCardIndex + 1) % thermoCards.length;
    showingAnswer = false;
    updateCard();
}

function prevCard() {
    currentCardIndex = (currentCardIndex - 1 + thermoCards.length) % thermoCards.length;
    showingAnswer = false;
    updateCard();
}
// -----------------------------

function addNewCard() {
    const qInput = document.getElementById('new-q');
    const aInput = document.getElementById('new-a');

    if (qInput.value.trim() !== "" && aInput.value.trim() !== "") {
        // Add to the list
        thermoCards.push({ q: qInput.value, a: aInput.value });

        // 2. SAVE the updated list to LocalStorage
        localStorage.setItem('myStudyCards', JSON.stringify(thermoCards));

        // UI Updates
        qInput.value = "";
        aInput.value = "";
        currentCardIndex = thermoCards.length - 1;
        showingAnswer = false;
        updateCard();
        alert("Card saved permanently!");
    } else {
        alert("Please fill in both fields.");
    }
    {Enter}function resetCards() {
    if(confirm("Delete all custom cards and reset to defaults?")) {
        localStorage.removeItem('myStudyCards');
        location.reload(); // Refresh to reload defaults
    }
}
function deleteCurrentCard() {
    if (thermoCards.length <= 1) {
        alert("You must keep at least one card in your deck!");
        return;
    }

    if (confirm("Are you sure you want to delete this card?")) {
        // Remove 1 item at the current index
        thermoCards.splice(currentCardIndex, 1);

        // Save the new, smaller list to LocalStorage
        localStorage.setItem('myStudyCards', JSON.stringify(thermoCards));

        // Adjust index if we deleted the last card
        if (currentCardIndex >= thermoCards.length) {
            currentCardIndex = thermoCards.length - 1;
        }

        showingAnswer = false;
        updateCard();
    }
}
// Display the current date/time the app script initialized
const updateEl = document.getElementById('last-update');
if(updateEl) {
    updateEl.innerText = "Updated: " + new Date().toLocaleString();
}

