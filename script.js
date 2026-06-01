console.log("Miss Haru Website Loaded");

const lessonButtons = document.querySelectorAll(".card button");

lessonButtons.forEach(button => {

    button.addEventListener("click", () => {

        alert("Lesson page coming soon!");

    });

});
