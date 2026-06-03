console.log("Miss Haru Website Loaded");

// Set default language and direction
let currentLanguage = localStorage.getItem("language") || "en";
document.documentElement.lang = currentLanguage;
document.documentElement.dir = currentLanguage === "ar" ? "rtl" : "ltr";
document.getElementById("languageSelect").value = currentLanguage;

// Initialize translations on page load
updatePageLanguage(currentLanguage);

function showSemester(id, button){

    const semesters =
        document.querySelectorAll(".semester-content");

    semesters.forEach(section => {
        section.classList.add("hidden");
    });

    const buttons =
        document.querySelectorAll(".semester-btn");

    buttons.forEach(btn => {
        btn.classList.remove("active");
    });

    document
        .getElementById(id)
        .classList.remove("hidden");

    button.classList.add("active");
}

// Theme toggle functionality
const themeBtn = document.getElementById("themeBtn");

themeBtn.addEventListener("click", () => {

    document.body.classList.toggle("dark-mode");

    if(document.body.classList.contains("dark-mode")){
        const lightModeText = currentLanguage === "ar" ? "☀️ الوضع الفاتح" : 
                             currentLanguage === "fr" ? "☀️ Mode clair" : "☀️ Light Mode";
        themeBtn.textContent = lightModeText;
        localStorage.setItem("theme", "dark");
    }
    else{
        const darkModeText = currentLanguage === "ar" ? "🌙 الوضع الليلي" : 
                            currentLanguage === "fr" ? "🌙 Mode sombre" : "🌙 Dark Mode";
        themeBtn.textContent = darkModeText;
        localStorage.setItem("theme", "light");
    }

});

// Load theme preference
if(localStorage.getItem("theme") === "dark"){
    document.body.classList.add("dark-mode");
    const lightModeText = currentLanguage === "ar" ? "☀️ الوضع الفاتح" : 
                         currentLanguage === "fr" ? "☀️ Mode clair" : "☀️ Light Mode";
    themeBtn.textContent = lightModeText;
}

// Language selection
const languageSelect = document.getElementById("languageSelect");

languageSelect.addEventListener("change", (e) => {
    const selectedLanguage = e.target.value;
    localStorage.setItem("language", selectedLanguage);
    currentLanguage = selectedLanguage;
    document.documentElement.lang = selectedLanguage;
    document.documentElement.dir = selectedLanguage === "ar" ? "rtl" : "ltr";
    updatePageLanguage(selectedLanguage);
    updateThemeButtonText();
});

// Update all page text based on selected language
function updatePageLanguage(language){
    const elements = document.querySelectorAll("[data-i18n]");
    
    elements.forEach(element => {
        const key = element.getAttribute("data-i18n");
        if(translations[language] && translations[language][key]){
            element.textContent = translations[language][key];
        }
    });
    
    // Update page title
    document.title = translations[language].title || document.title;
}

// Update theme button text when language changes
function updateThemeButtonText(){
    if(document.body.classList.contains("dark-mode")){
        const lightModeText = currentLanguage === "ar" ? "☀️ الوضع الفاتح" : 
                             currentLanguage === "fr" ? "☀️ Mode clair" : "☀️ Light Mode";
        themeBtn.textContent = lightModeText;
    }
    else{
        const darkModeText = currentLanguage === "ar" ? "🌙 الوضع الليلي" : 
                            currentLanguage === "fr" ? "🌙 Mode sombre" : "🌙 Dark Mode";
        themeBtn.textContent = darkModeText;
    }
}