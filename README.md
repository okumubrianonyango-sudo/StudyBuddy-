# Study Buddy: Industrial Chemistry Toolkit 🧪

**Study Buddy** is a Progressive Web App (PWA) designed to assist students at **Masinde Muliro University of Science and Technology (MMUST)** with complex chemical engineering and industrial chemistry calculations.

## 🚀 Features
* **Unit Converter:** Specialized for thermodynamics (Energy, Pressure, Volume).
* **Scientific Accuracy:** Handles conversions like Torr to atm and $m^3$ to Liters.
* **PWA Ready:** Can be installed on Android/iOS and works offline for lab sessions.
* **Mobile-First Design:** Optimized for quick use during field visits and practicals.

## 🛠️ Built With
* **HTML5 / CSS3**
* **JavaScript (ES6+)**
* **Service Workers** (for offline functionality)
* **Spck Editor** (Mobile-based development)

## 📖 How to Use
1. Visit the live link: [INSERT YOUR GITHUB PAGES LINK HERE]
2. Select the units you wish to convert.
3. For the best experience, select "Add to Home Screen" from your browser menu to use it as a standalone app.

---
*Developed as part of the Industrial Chemistry curriculum at MMUST.*
## 🔬 Technical Specifications

The **Study Buddy** core logic is built on standard thermodynamic and industrial chemistry constants:

### 1. Temperature Conversions
The app uses the absolute zero offset for Kelvin-Celsius conversions:
$$T_{(K)} = T_{(^\circ C)} + 273.15$$

### 2. Energy Equivalencies
Standard conversion factors used for bond enthalpy and heat capacity calculations:
* **1 calorie (cal)** = 4.184 Joules (J)
* **1 BTU** ≈ 1055.06 Joules (J)

### 3. Pressure & Volume Constants
Essential for gas law calculations ($PV = nRT$) and reactor scaling:
* **Standard Atmosphere (atm):** 1 atm = 101.325 kPa = 760 Torr = 14.696 psi.
* **Molar Volume:** Conversions assume Ideal Gas behavior at STP where $1 \text{ mole} = 22.4 \text{ L}$.
* **Volumetric Scaling:** $1 \text{ m}^3 = 1000 \text{ L} = 1,000,000 \text{ cm}^3$.

## 🧪 Future Modules
* **Density & Molarity:** Converting mass ($g$) to volume ($mL$) using specific gravity.
* **Hess's Law Calculator:** Summing enthalpies of formation.
* **Periodic Table Lookup:** Quick molar mass reference.
