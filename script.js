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
