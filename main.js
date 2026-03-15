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
    <div class="card p-3 mb-2 shadow-sm border-0 position-relative">
        <button class="btn btn-sm text-danger position-absolute top-0 end-0 m-1" 
                onclick="deleteNote(${n.id})" style="z-index: 5;">
            <i class="fas fa-trash"></i>
        </button>
        
        <h6 class="fw-bold text-primary mb-1 pe-4">${n.title}</h6>
        <p class="small text-secondary mb-2">${n.content.substring(0, 100)}${n.content.length > 100 ? '...' : ''}</p>
        
        <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-info flex-grow-1" onclick="viewPhoto(${n.id})">🖼️ View Photo</button>
        </div>
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

    if ((from === 'C' || from === 'K') && (to === 'C' || to === 'K')) {
        let res = (from === 'C' && to === 'K') ? val + 273.15 : (from === 'K' && to === 'C' ? val - 273.15 : val);
        display.innerHTML = `<b>${res.toFixed(2)} ${to}</b>`;
        return;
    }

    const energyFactors = { J: 1, kJ: 1000, cal: 4.184, kcal: 4184 };
    const pressureFactors = { atm: 1, psi: 0.068046, bar: 0.986923, kPa: 0.009869, torr: 0.00131579 };
    const volumeFactors = { L: 1, mL: 0.001, m3: 1000 };

    let factors = null;
    if (energyFactors[from] && energyFactors[to]) factors = energyFactors;
    else if (pressureFactors[from] && pressureFactors[to]) factors = pressureFactors;
    else if (volumeFactors[from] && volumeFactors[to]) factors = volumeFactors;

    if (!factors) {
        display.innerHTML = `<span class="text-danger small">Category Mismatch</span>`;
        return;
    }

    const result = (val * factors[from]) / factors[to];
    display.innerHTML = `<b>${result.toPrecision(5)} ${to}</b>`;
}

// ==========================================
// 6. AI, VOICE & OCR
// ==========================================
async function scanImage() {
    const status = document.getElementById('scanStatus');
    const cameraInput = document.getElementById('cameraInput');
    const file = cameraInput.files[0];
    
    if (!file) return;

    status.innerHTML = `<span class="spinner-border spinner-border-sm text-primary"></span> AI Processing...`;
    
    try {
        // We create the worker with specific parameters for better accuracy
        const worker = await Tesseract.createWorker('eng', 1, {
            logger: m => {
                if(m.status === 'recognizing text') {
                    status.innerText = `Reading: ${Math.round(m.progress * 100)}%`;
                }
            }
        });

        // Set parameters to handle "blocks" of text better (PSM 1 or 3)
        await worker.setParameters({
            tessedit_pageseg_mode: Tesseract.PSM.AUTO, 
        });

        const { data: { text } } = await worker.recognize(file);
        
        if (text.trim().length > 0) {
            const noteArea = document.getElementById('noteContent');
            noteArea.value += (noteArea.value ? '\n\n' : '') + "[Scanned Data]:\n" + text.trim();
            status.innerHTML = "✅ Scan Successful";
            // If in full screen, ensure it's visible
            noteArea.dispatchEvent(new Event('input')); 
        } else {
            status.innerHTML = "⚠️ No text found. Try closer/brighter.";
        }

        await worker.terminate();
    } catch (e) {
        console.error("OCR Error:", e);
        status.innerHTML = "❌ Scan Failed. Check lighting.";
    } finally {
        cameraInput.value = ""; // Clear input for next scan
    }
}

let recognition; // Global variable to track state

function toggleDictation() {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) return alert("Speech recognition is not supported in this browser.");

    if (recognition) {
        recognition.stop();
        return;
    }

    recognition = new Speech();
    recognition.lang = 'en-US';
    recognition.continuous = false; // Stops when you stop talking
    recognition.interimResults = false;

    recognition.onstart = () => {
        showToast("🎤 Listening for your lab notes...");
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const noteArea = document.getElementById('noteContent');
        noteArea.value += (noteArea.value ? ' ' : '') + transcript;
        showToast("✅ Added!");
        // Refresh full screen view if needed
    };

    recognition.onerror = (event) => {
        console.error("Speech Error:", event.error);
        showToast("❌ Mic Error: " + event.error);
    };

    recognition.onend = () => {
        recognition = null;
    };

    recognition.start();
}

// ==========================================
// MULTI-QUESTION AI QUIZ GENERATOR
// ==========================================
function generateAIQuiz() {
    const notes = JSON.parse(localStorage.getItem('studyNotes')) || [];
    if (notes.length === 0) return showToast("Save lab notes first!");
    
    const container = document.getElementById('quizContainer');
    const content = document.getElementById('quizContent');
    const latest = notes[0];
    const text = latest.content.toLowerCase();

    // Categorized Knowledge Base 
    const knowledgeBase = {
        thermodynamics: {
            keywords: ["enthalpy", "entropy", "gibbs", "exothermic", "endothermic", "isothermal", "adiabatic", "calorimetry", "hess"],
            templates: [
                "How does the change in {subject} drive the spontaneity of this reaction?",
                "Explain the energy transfer associated with the {subject} observed in your notes."
            ]
        },
        organic: {
            keywords: ["alkane", "alkene", "benzene", "alcohol", "phenol", "carboxylic", "ester", "polymer", "nucleophile", "substitution"],
            templates: [
                "Identify the role of the {subject} functional group or mechanism in this reaction.",
                "How does the molecular structure of the {subject} affect its chemical properties?"
            ]
        },
        blockElements: {
            keywords: ["alkali", "transition metal", "lanthanide", "halogen", "electronegativity", "oxidation state", "ligand"],
            templates: [
                "Based on periodic trends, why does the {subject} exhibit these specific properties?",
                "Explain the role of the {subject} in complex formation or overall reactivity."
            ]
        },
        colloidal: {
            keywords: ["colloid", "aerosol", "emulsion", "micelle", "adsorption", "surfactant", "tyndall"],
            templates: [
                "What factors stabilize the {subject} mentioned in your observation?",
                "How would changing temperature or pressure affect the {subject} in an industrial setting?"
            ]
        },
        kinetics: {
            keywords: ["rate", "catalyst", "activation energy", "half-life", "equilibrium", "arrhenius"],
            templates: [
                "How did the {subject} influence the overall speed of the chemical reaction?",
                "Based on your notes, describe the rate-determining step involving the {subject}."
            ]
        },
        separation: {
            keywords: ["distillation", "fractional", "chromatography", "extraction", "filtration", "crystallization"],
            templates: [
                "Why was {subject} the most appropriate technique for this specific mixture?",
                "What physical property does {subject} primarily exploit in this scenario?"
            ]
        }
    };

    let allMatches = [];

    // Step 1: Find ALL matching keywords across all categories
    for (const [category, data] of Object.entries(knowledgeBase)) {
        const matches = data.keywords.filter(word => text.includes(word));
        matches.forEach(match => {
            allMatches.push({ category: category, keyword: match, templates: data.templates });
        });
    }

    // Step 2: Shuffle the matches so the quiz is different every time
    allMatches = allMatches.sort(() => 0.5 - Math.random());

    // Step 3: Pick up to 3 unique questions
    let generatedQuestions = [];
    let maxQuestions = 3; 
    let selectedKeywords = new Set(); // To prevent asking about the same word twice

    for (let i = 0; i < allMatches.length; i++) {
        let match = allMatches[i];
        if (!selectedKeywords.has(match.keyword)) {
            selectedKeywords.add(match.keyword);
            let rawQ = match.templates[Math.floor(Math.random() * match.templates.length)];
            generatedQuestions.push(rawQ.replace("{subject}", `<span class="text-primary fw-bold">${match.keyword}</span>`));
        }
        if (generatedQuestions.length >= maxQuestions) break;
    }

    // Step 4: Fallback if notes are too short/don't have keywords
    if (generatedQuestions.length === 0) {
        generatedQuestions.push(`What are the key sources of error for "<b>${latest.title}</b>"?`);
        generatedQuestions.push(`What is the most important industrial application of this procedure?`);
    }

    // Step 5: Build the UI for Multiple Questions
    container.classList.remove('d-none');
    
    let quizHTML = `
        <div class="p-3 bg-light border-start border-primary border-4 mb-3 shadow-sm">
            <p class="small text-muted mb-3"><i class="fas fa-brain"></i> AI Analysis of: <b>${latest.title}</b></p>
    `;

    // Loop through and create a text box for each question
    generatedQuestions.forEach((q, index) => {
        quizHTML += `
            <div class="mb-3">
                <p class="mb-1 fw-bold" style="font-size: 1.05rem;">Q${index + 1}: ${q}</p>
                <textarea id="quizAnswer_${index}" class="form-control border-secondary" style="height: 80px; resize: none;" placeholder="Type your answer..."></textarea>
            </div>
        `;
    });

    quizHTML += `
        </div>
        <button class="btn btn-primary w-100 fw-bold shadow-sm" onclick="checkMultipleQuiz(${generatedQuestions.length})">
            Submit Exam (${generatedQuestions.length} Questions)
        </button>
    `;

    content.innerHTML = quizHTML;
}

// ==========================================
// VALIDATE MULTIPLE ANSWERS
// ==========================================
function checkMultipleQuiz(questionCount) {
    let allValid = true;

    // Loop through all generated text boxes to check if they are filled
    for (let i = 0; i < questionCount; i++) {
        let answerBox = document.getElementById(`quizAnswer_${i}`);
        let answerText = answerBox.value.trim();

        if (answerText.length < 10) {
            allValid = false;
            answerBox.classList.add('border-danger'); // Highlight empty boxes in red
        } else {
            answerBox.classList.remove('border-danger');
            answerBox.classList.add('border-success'); // Highlight good answers in green
        }
    }

    if (!allValid) {
        showToast("Please provide a detailed explanation for ALL questions!");
        return;
    }
    
    showToast("Excellent analysis! 100% Score.");
    setTimeout(closeQuiz, 1500);
}

// ==========================================
// 2. SINGLE & BULK NOTE DELETION
// ==========================================

// Deletes one specific log
function deleteNote(noteId) {
    if (!confirm("Delete this specific log?")) return;

    let notes = JSON.parse(localStorage.getItem('studyNotes')) || [];
    notes = notes.filter(n => n.id !== noteId);
    localStorage.setItem('studyNotes', JSON.stringify(notes));

    // Also remove the associated photo from database
    if (db) {
        const transaction = db.transaction(["labPhotos"], "readwrite");
        transaction.objectStore("labPhotos").delete(noteId);
    }

    displayNotes();
    showToast("Log removed.");
}

// Clears all logs at once
function clearAllNotes() {
    if (!confirm("CRITICAL: This will delete ALL lab logs permanently. Proceed?")) return;

    localStorage.removeItem('studyNotes');
    
    if (db) {
        const transaction = db.transaction(["labPhotos"], "readwrite");
        transaction.objectStore("labPhotos").clear();
    }

    displayNotes();
    showToast("Notebook cleared.");
}

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
    if (typeof window.jspdf === 'undefined') {
        showToast("PDF library is loading or unavailable.");
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const notes = JSON.parse(localStorage.getItem('studyNotes')) || [];

    if (notes.length === 0) {
        showToast("No logs to export!");
        return;
    }

    doc.setFontSize(18);
    doc.setTextColor(13, 110, 253); 
    doc.text("Study Buddy: Industrial Chemistry Logs", 10, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 10, 28);
    doc.line(10, 30, 200, 30); 

    let yOffset = 40;

    notes.forEach((note, index) => {
        if (yOffset > 270) {
            doc.addPage();
            yOffset = 20;
        }

        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.setFont("helvetica", "bold");
        doc.text(`${index + 1}. ${note.title}`, 10, yOffset);
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(150);
        doc.text(`Date: ${note.date}`, 10, yOffset + 7);

        doc.setTextColor(50);
        const splitText = doc.splitTextToSize(note.content, 180);
        doc.text(splitText, 10, yOffset + 15);

        yOffset += (splitText.length * 7) + 25; 
    });

    doc.save(`Chemistry_Logs_${Date.now()}.pdf`);
    showToast("PDF Downloaded!");
}

// ==========================================
// CATEGORIZED FLASHCARD SYSTEM
// ==========================================

let currentCategory = 'thermodynamics';
let currentCardIndex = 0;
let isShowingAnswer = false;

// Initial Data Structure
let flashcardData = JSON.parse(localStorage.getItem('studyBuddyCards')) || {
    thermodynamics: [
        { q: "First Law of Thermodynamics?", a: "Energy cannot be created or destroyed, only transformed." }
    ],
    organic: [
        { q: "What is a Nucleophile?", a: "A chemical species that donates an electron pair to form a chemical bond." }
    ],
    general: [
        { q: "Avogadro's Number?", a: "6.022 x 10^23 molecules/mol" }
    ]
};

function switchDeck(category) {
    currentCategory = category;
    currentCardIndex = 0;
    isShowingAnswer = false;
    document.getElementById('target-deck-name').innerText = category;
    updateCardUI();
}

function updateCardUI() {
    const deck = flashcardData[currentCategory];
    const display = document.getElementById('card-display-text');
    const counter = document.getElementById('card-counter');

    if (deck.length === 0) {
        display.innerText = "No cards in this deck yet!";
        counter.innerText = "0 / 0";
        return;
    }

    const currentCard = deck[currentCardIndex];
    display.innerText = isShowingAnswer ? currentCard.a : currentCard.q;
    counter.innerText = `${currentCardIndex + 1} / ${deck.length}`;
    
    // Change color based on side
    display.classList.toggle('text-primary', !isShowingAnswer);
    display.classList.toggle('text-success', isShowingAnswer);
}

function flipCard() {
    isShowingAnswer = !isShowingAnswer;
    updateCardUI();
}

function nextCard() {
    const deck = flashcardData[currentCategory];
    if (currentCardIndex < deck.length - 1) {
        currentCardIndex++;
        isShowingAnswer = false;
        updateCardUI();
    }
}

function prevCard() {
    if (currentCardIndex > 0) {
        currentCardIndex--;
        isShowingAnswer = false;
        updateCardUI();
    }
}

function addNewCard() {
    const q = document.getElementById('new-q').value.trim();
    const a = document.getElementById('new-a').value.trim();

    if (!q || !a) return alert("Please fill both sides!");

    // Add to the active category
    flashcardData[currentCategory].push({ q, a });
    
    // Save to LocalStorage
    localStorage.setItem('studyBuddyCards', JSON.stringify(flashcardData));

    // Clear and Refresh
    document.getElementById('new-q').value = "";
    document.getElementById('new-a').value = "";
    updateCardUI();
    showToast(`Added to ${currentCategory}!`);
    
function deleteCurrentCard() {
    const deck = flashcardData[currentCategory];
    
    if (deck.length === 0) return;

    if (confirm(`Delete this ${currentCategory} card permanently?`)) {
        // Remove the card from the specific category array
        deck.splice(currentCardIndex, 1);

        // Save the updated object to LocalStorage
        localStorage.setItem('studyBuddyCards', JSON.stringify(flashcardData));

        // Adjust index if we just deleted the last card in the list
        if (currentCardIndex >= deck.length && currentCardIndex > 0) {
            currentCardIndex = deck.length - 1;
        }

        isShowingAnswer = false;
        updateCardUI();
        showToast("Card deleted.");
    }
}
}

// Display the current date/time the app script initialized
const updateEl = document.getElementById('last-update');
if(updateEl) {
    updateEl.innerText = "Updated: " + new Date().toLocaleString();
}
function toggleFullScreenNote() {
    const noteArea = document.getElementById('noteContent');
    const btn = event.currentTarget;

    if (!noteArea.classList.contains('full-screen-note')) {
        noteArea.classList.add('full-screen-note');
        // Update button text and style
        btn.innerHTML = '<i class="fas fa-compress"></i> Exit & Save';
        btn.classList.replace('btn-light', 'btn-danger');
        
        // This is the fix: make the button float on top of the full screen
        btn.style.position = 'fixed';
        btn.style.top = '10px';
        btn.style.right = '10px';
        btn.style.zIndex = '10000'; 
    } else {
        noteArea.classList.remove('full-screen-note');
        btn.innerHTML = '<i class="fas fa-expand"></i> Full Screen';
        btn.classList.replace('btn-danger', 'btn-light');
        
        // Reset button back to its normal spot in the card
        btn.style.position = 'absolute';
        btn.style.top = '0';
        btn.style.right = '0';
        btn.style.zIndex = '10';
    }
}
