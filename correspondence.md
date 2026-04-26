# Correspondence Log

---

## 1. User
> make a file wherein you write all our correspondance. Inside that file, you put a summary of your responces, max ca. 500 characters.

## Assistant
Created `correspondence.md` in the `haval` directory to log all user messages verbatim and summarize assistant responses in ~500 characters or less.

---

## 2. User
> also write an entry of the changes done in the project

## Assistant
Added a Project Changes section to the correspondence log to track all file modifications made in the project over time.

---

## 3. User
> add a file where you update on how to reach a minimal viable product, call it mvp.md for now it is empty but you will keep update it as we progress

## Assistant
Created `haval/mvp.md` as an empty placeholder with a title and a note that it will be updated as the project progresses.

---

## 4. User
> We will start a frontend app with html/css/js (vanilla). If we ever needed backend, we will use Go lang.

## Assistant
Noted the tech stack. Updated `mvp.md` with a tech stack table (Vanilla HTML/CSS/JS + Go if needed), a status indicator, and placeholder sections for Features and Milestones.

---

## 5. User
> can you add checkpoint: or commit col to the ## Project Changes inside correspondence.md

## Assistant
Added a `Checkpoint` column to the Project Changes table with conventional commit-style messages for each row.

---

## 6. User
> after each change you make, use terminal to make a commit.

## Assistant
Initialized a git repo, made an initial commit of all existing files, and will run `git commit` after every change going forward.

---

## 7. User
> yes (re: looking at existing files)

## Assistant
All four files (`index.html`, `chat-threads.html`, `model-lab.html`, `.gitignore`) are empty placeholders. The file names suggest an AI chat interface with multiple views. Asked user to describe the app so features and milestones can be scoped in `mvp.md`.

---

## 8. User
> whenever i make changes and a commit, please log them to the correspondence.md

## Assistant
Noted. Will log user commits and changes to `correspondence.md` going forward.

---

## 9. User
> update .gitignore as we progress

## Assistant
Added sensible defaults to `.gitignore`: macOS (`.DS_Store`), editors (`.vscode/`, `.idea/`), Go binaries, and env files. Will keep updating it as new tooling is introduced. Committed the change.

---

## 10. User
> you are already doing it here in the chat but we just want the correspondence.md be the summarised version of this chat thread

## Assistant
Understood. Simplified `correspondence.md` to just the chat log — user messages verbatim, assistant responses summarized. Removed the Project Changes table.

---

## 11. User
> from now on, just append the last correspondence, no need to overwrite

## Assistant
Noted. Will only append new entries going forward.

---

## 12. User
> can you make a server using the Go programming language so i can view index.html

## Assistant
Created `server.go` — a minimal Go file server using `net/http` that serves all static files from the current directory on `http://localhost:8080`. Run it with `go run server.go`.