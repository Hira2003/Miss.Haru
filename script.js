console.log("Miss Haru Website Loaded");

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
const themeBtn = document.getElementById("themeBtn");

themeBtn.addEventListener("click", () => {

    document.body.classList.toggle("dark-mode");

    if(document.body.classList.contains("dark-mode")){
        themeBtn.textContent = "☀️ Light Mode";
    }
    else{
        themeBtn.textContent = "🌙 Dark Mode";
    }

});
