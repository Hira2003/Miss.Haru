(() => {
  "use strict";

  const CONFIG_URL = window.MISS_HARU_SUPABASE_URL || "";
  const CONFIG_KEY = window.MISS_HARU_SUPABASE_PUBLISHABLE_KEY || "";
  const configured = CONFIG_URL.startsWith("https://") &&
    CONFIG_KEY && !CONFIG_KEY.includes("YOUR_SUPABASE");
  const client = configured && window.supabase
    ? window.supabase.createClient(CONFIG_URL, CONFIG_KEY)
    : null;

  const $ = (selector) => document.querySelector(selector);
  const message = (text, type = "info") => {
    const target = $("#portalMessage");
    if (!target) return;
    target.textContent = text;
    target.className = "portal-message " + type;
    target.hidden = false;
  };
  const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  const categoryLabels = {
    lesson: "Lesson", exercise: "Exercise", exam: "Exam", resource: "Resource"
  };

  if (!client) {
    document.addEventListener("DOMContentLoaded", () => {
      message("Connect Supabase first: edit supabase-config.js and add your Project URL and publishable key.", "warning");
      document.querySelectorAll("[data-requires-supabase]").forEach(el => el.disabled = true);
    });
    return;
  }

  // getSession() is the right check for an optional visitor session.
  // getUser() can return AuthSessionMissingError when a visitor is signed out,
  // which must not break the public document library.
  async function currentUser() {
    const { data: { session }, error } = await client.auth.getSession();
    if (error) throw error;
    return session ? session.user : null;
  }

  async function requireUser() {
    const user = await currentUser();
    if (!user) {
      location.href = "auth.html?next=" + encodeURIComponent(location.pathname.split("/").pop());
      return null;
    }
    return user;
  }

  async function getProfile(user) {
    const { data, error } = await client.from("profiles")
      .select("id, full_name, role").eq("id", user.id).single();
    if (error) throw error;
    return data;
  }

  async function renderSession() {
    const slot = $("#sessionStatus");
    if (!slot) return;
    try {
      const user = await currentUser();
      if (!user) {
        slot.innerHTML = '<a href="auth.html">Sign in / Register</a>';
        return;
      }
      const profile = await getProfile(user);
      slot.innerHTML = '<span>Signed in as ' + escapeHtml(profile.full_name || user.email) +
        '</span> · <button type="button" id="signOutBtn" class="text-button">Sign out</button>';
      $("#signOutBtn").addEventListener("click", async () => {
        const { error } = await client.auth.signOut();
        if (error) return message(error.message, "error");
        location.href = "index.html";
      });
      const adminLink = $("#adminNavLink");
      if (adminLink && profile.role === "admin") adminLink.hidden = false;
    } catch (error) {
      message(error.message, "error");
    }
  }

  async function initAuth() {
    const form = $("#authForm");
    if (!form) return;
    const params = new URLSearchParams(location.search);
    const next = params.get("next");
    const safeNext = ["library.html", "admin.html", "index.html"].includes(next) ? next : "library.html";
    $("#authMode")?.addEventListener("change", () => {
      const registering = $("#authMode").value === "register";
      $("#nameField").hidden = !registering;
      $("#authSubmit").textContent = registering ? "Create account" : "Sign in";
    });
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const mode = $("#authMode").value;
      const email = $("#authEmail").value.trim();
      const password = $("#authPassword").value;
      const fullName = $("#authName").value.trim();
      const submit = $("#authSubmit");
      submit.disabled = true;
      try {
        if (mode === "register") {
          if (!fullName) throw new Error("Please enter your name.");
          const { data, error } = await client.auth.signUp({
            email, password, options: {
              data: { full_name: fullName },
              emailRedirectTo: location.origin + location.pathname.replace(/[^/]*$/, "library.html")
            }
          });
          if (error) throw error;
          if (!data.session) {
            message("Account created. Check your email to confirm it, then sign in.", "success");
          } else {
            location.href = safeNext;
          }
        } else {
          const { error } = await client.auth.signInWithPassword({ email, password });
          if (error) throw error;
          location.href = safeNext;
        }
      } catch (error) {
        message(error.message, "error");
      } finally {
        submit.disabled = false;
      }
    });
  }

  async function initUpload() {
    const form = $("#uploadForm");
    if (!form) return;
    const user = await requireUser();
    if (!user) return;
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const file = $("#documentFile").files[0];
      const title = $("#documentTitle").value.trim();
      const teacherName = $("#teacherName").value.trim();
      const schoolName = $("#schoolName").value.trim();
      const category = $("#documentCategory").value;
      const semesterValue = $("#documentSemester").value;
      const allowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
      if (!file || !allowed.includes(file.type)) return message("Choose a PDF or DOCX file.", "error");
      if (file.size > 20 * 1024 * 1024) return message("The maximum file size is 20 MB.", "error");
      const submit = $("#uploadSubmit");
      submit.disabled = true;
      try {
        const cleanName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
        const path = user.id + "/" + crypto.randomUUID() + "-" + cleanName;
        const { error: uploadError } = await client.storage.from("teacher-submissions")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        const { error: insertError } = await client.from("documents").insert({
          title, teacher_name: teacherName, school_name: schoolName,
          category, semester: semesterValue ? Number(semesterValue) : null,
          file_path: path, file_name: file.name, mime_type: file.type,
          uploaded_by: user.id, status: "pending"
        });
        if (insertError) {
          await client.storage.from("teacher-submissions").remove([path]);
          throw insertError;
        }
        form.reset();
        message("Your document has been submitted for review. It will appear in the public library after approval.", "success");
        await loadMySubmissions(user);
      } catch (error) {
        message(error.message, "error");
      } finally {
        submit.disabled = false;
      }
    });
    await loadMySubmissions(user);
  }

  async function fileLink(doc, download = false) {
    const { data, error } = await client.storage.from("teacher-submissions")
      .createSignedUrl(doc.file_path, 900, { download });
    if (error) throw error;
    return data.signedUrl;
  }

  async function loadMySubmissions(user) {
    const target = $("#mySubmissions");
    if (!target) return;
    const { data, error } = await client.from("documents")
      .select("id,title,category,status,created_at")
      .eq("uploaded_by", user.id).order("created_at", { ascending: false });
    if (error) return message(error.message, "error");
    target.innerHTML = data.length ? data.map(doc =>
      '<li><strong>' + escapeHtml(doc.title) + '</strong><span class="status-pill status-' +
      escapeHtml(doc.status) + '">' + escapeHtml(doc.status) + '</span><small>' +
      escapeHtml(categoryLabels[doc.category] || doc.category) + ' · ' +
      new Date(doc.created_at).toLocaleDateString() + '</small></li>'
    ).join("") : "<li>You have not submitted any documents yet.</li>";
  }

  async function loadPublicLibrary() {
    const target = $("#publicDocuments");
    if (!target) return;
    const { data, error } = await client.from("documents")
      .select("id,title,teacher_name,school_name,category,semester,file_name,file_path,mime_type,created_at")
      .eq("status", "approved").order("created_at", { ascending: false });
    if (error) throw error;
    const filter = $("#libraryCategory")?.value || "all";
    const filtered = filter === "all" ? data : data.filter(doc => doc.category === filter);
    if (!filtered.length) {
      target.innerHTML = '<p class="empty-state">No approved documents here yet. Check back soon!</p>';
      return;
    }
    target.innerHTML = "";
    for (const doc of filtered) {
      const url = await fileLink(doc, doc.mime_type !== "application/pdf");
      const card = document.createElement("article");
      card.className = "document-card";
      const heading = document.createElement("h3");
      heading.textContent = doc.title;
      const meta = document.createElement("p");
      meta.textContent = (categoryLabels[doc.category] || doc.category) +
        (doc.semester ? " · Semester " + doc.semester : "") +
        " · " + doc.teacher_name + " · " + doc.school_name;
      const link = document.createElement("a");
      link.className = "btn";
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = doc.mime_type === "application/pdf" ? "Preview / Open PDF" : "Download DOCX";
      card.append(heading, meta, link);
      target.append(card);
    }
  }

  async function initLibrary() {
    if (!$("#publicDocuments")) return;
    await renderSession();
    const filter = $("#libraryCategory");
    filter?.addEventListener("change", () => loadPublicLibrary().catch(error => message(error.message, "error")));
    await loadPublicLibrary();
    const user = await currentUser();
    if (user && $("#uploadForm")) {
      await initUpload();
    } else if ($("#uploadForm")) {
      $("#uploadForm").hidden = true;
      const prompt = document.createElement("p");
      prompt.className = "portal-note";
      prompt.innerHTML = 'To submit a document, <a href="auth.html?next=library.html">sign in or create a teacher account</a>. You can browse approved resources without signing in.';
      $("#uploadForm").before(prompt);
      $("#mySubmissions").innerHTML = '<li>Sign in to view your submissions.</li>';
    }
  }

  async function initAdmin() {
    const target = $("#pendingDocuments");
    if (!target) return;
    await renderSession();
    const user = await requireUser();
    if (!user) return;
    const profile = await getProfile(user);
    if (profile.role !== "admin") {
      message("This page is only available to the Miss Haru administrator.", "error");
      target.innerHTML = "";
      return;
    }
    async function refresh() {
      const { data, error } = await client.from("documents")
        .select("*").eq("status", "pending").order("created_at", { ascending: true });
      if (error) throw error;
      target.innerHTML = "";
      if (!data.length) {
        target.innerHTML = '<p class="empty-state">All caught up — no pending submissions.</p>';
        return;
      }
      for (const doc of data) {
        const card = document.createElement("article");
        card.className = "document-card";
        const title = document.createElement("h3");
        title.textContent = doc.title;
        const details = document.createElement("p");
        details.textContent = doc.teacher_name + " · " + doc.school_name + " · " +
          (categoryLabels[doc.category] || doc.category) +
          (doc.semester ? " · Semester " + doc.semester : "");
        const preview = document.createElement("button");
        preview.className = "btn";
        preview.textContent = doc.mime_type === "application/pdf" ? "Preview PDF" : "Download DOCX";
        preview.addEventListener("click", async () => {
          try {
            const url = await fileLink(doc, doc.mime_type !== "application/pdf");
            window.open(url, "_blank", "noopener");
          } catch (error) { message(error.message, "error"); }
        });
        const approve = document.createElement("button");
        approve.className = "btn";
        approve.textContent = "Approve";
        approve.addEventListener("click", () => review(doc, "approved"));
        const reject = document.createElement("button");
        reject.className = "btn btn-secondary";
        reject.textContent = "Reject";
        reject.addEventListener("click", () => review(doc, "rejected"));
        card.append(title, details, preview, approve, reject);
        target.append(card);
      }
    }
    async function review(doc, status) {
      try {
        const { error } = await client.from("documents").update({
          status, reviewed_at: new Date().toISOString(), reviewed_by: user.id
        }).eq("id", doc.id);
        if (error) throw error;
        message('"' + doc.title + '" was ' + status + ".", "success");
        await refresh();
      } catch (error) { message(error.message, "error"); }
    }
    await refresh();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      await initAuth();
      await initLibrary();
      await initAdmin();
    } catch (error) {
      message(error.message, "error");
    }
  });
})();