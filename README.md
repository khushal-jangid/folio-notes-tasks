# 📓 Folio — Paper Notes & Daily Tasks

> 📝 A modern paper-inspired productivity app for notes, tasks, habits, focus sessions, reminders, and everyday organization.

**Folio** is a modern, mobile-first productivity web application designed around the feeling of a physical notebook while providing the power and convenience of a digital productivity system.

It brings **notes, tasks, habits, focus sessions, reminders, schedules, and personal organization** together in one clean workspace. The interface uses a warm paper-inspired visual style with modern UI components, making productivity feel simple, focused, and natural.

---

## ✨ Features

### 📝 Notes

* Create and manage daily notes
* Paper-inspired notebook interface
* Organize notes using tags
* View and manage all notes
* Quick note creation

### ✅ Tasks

* Create daily tasks
* Track pending and completed tasks
* Schedule tasks
* View upcoming tasks
* Move completed tasks to the Completed section
* Trash management

### 🔥 Habits & Streaks

* Track daily habits
* Maintain productivity streaks
* Monitor habit progress
* Dedicated Habits & Streaks section

### ⏱️ Focus Timer

* Built-in focus timer
* 25-minute focus session
* Designed for distraction-free productivity
* Helps maintain focused work sessions

### 📅 Daily & Upcoming Planning

* Today's agenda
* Upcoming tasks and schedules
* Daily productivity overview
* Quick access to important activities

### 🔔 Smart Reminders

* Browser notification support
* Task reminder notifications
* Permission-based notification system
* Reminder banner for enabling notifications

### 🔍 Search

* Quick search functionality
* Search palette for faster navigation
* Easy access to notes and productivity data

### 🌙 Themes

* Light theme
* Dark/Moleskine-inspired mode
* Theme toggle available from the interface

### 💾 Data Backup & Export

* Export notebook data
* JSON-based backup
* Download personal productivity data
* Useful for keeping offline backups

### 📱 Progressive Web App

Folio includes PWA support with:

* Installable web application
* Standalone display mode
* Mobile application experience
* App icons
* Mobile and desktop screenshots
* PWA shortcuts
* Service worker support

The manifest defines Folio as a productivity/utility application and includes shortcuts for **New Note**, **New Task**, and **Today's Agenda**.

### 📲 Mobile App Ready

The repository also contains a **Capacitor configuration**, allowing the web application to be packaged for native mobile environments.

---

## 🎨 Design

Folio follows a **paper-first design philosophy**.

The interface combines:

* 📖 Editorial typography
* 📝 Paper-inspired textures
* 🎨 Warm neutral colors
* ✨ Minimal modern UI
* 📱 Mobile-first layouts
* 💻 Responsive desktop experience
* 🧩 Clean navigation
* 🌙 Dark theme support

The application uses **Lora**, **Plus Jakarta Sans**, and **JetBrains Mono** fonts to create a combination of editorial, modern UI, and technical typography.

---

## 🛠️ Tech Stack

| Technology         | Purpose                              |
| ------------------ | ------------------------------------ |
| **HTML5**          | Application structure                |
| **CSS3**           | Custom styling and paper-inspired UI |
| **JavaScript**     | Application logic and interactivity  |
| **Tailwind CSS**   | Utility-based UI styling             |
| **Font Awesome**   | Icons                                |
| **Google Fonts**   | Typography                           |
| **PWA**            | Installable web application          |
| **Service Worker** | Offline/PWA functionality            |
| **Capacitor**      | Native mobile packaging              |

The project uses Tailwind CSS through its CDN and includes Font Awesome 6.5.1 plus Google Fonts.

---

## 📂 Project Structure

```text
folio-notes-tasks/
│
├── .github/
│   └── GitHub configuration
│
├── .well-known/
│   └── Web/app verification files
│
├── css/
│   └── Custom styles
│
├── icons/
│   ├── App icons
│   ├── PWA icons
│   └── Application screenshots
│
├── js/
│   └── Application JavaScript
│
├── index.html
│   └── Main application interface
│
├── download.html
│   └── Download/install page
│
├── manifest.json
│   └── PWA configuration
│
├── capacitor.config.json
│   └── Capacitor configuration
│
├── sw.js
│   └── Service Worker
│
├── CNAME
│   └── Custom domain configuration
│
└── .gitignore
```

The current repository contains the main HTML application, CSS/JS directories, icons, PWA manifest, service worker, Capacitor configuration, download page, and deployment configuration.

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/khushal-jangid/folio-notes-tasks.git
```

### 2. Open the Project

```bash
cd folio-notes-tasks
```

### 3. Run Locally

Because Folio is a web application, you can run it using a local development server.

For example, with VS Code:

1. Open the project in VS Code.
2. Install the **Live Server** extension.
3. Open `index.html`.
4. Click **Go Live**.
5. Open the provided local URL in your browser.

> Running through a local server is recommended for testing PWA and Service Worker functionality.

---

## 🌐 Live Demo

Visit the live version of Folio:

**https://folio-notes-tasks.surge.sh/**

---

## 📱 PWA Installation

Folio is designed as an installable Progressive Web App.

On supported browsers:

1. Open the live website.
2. Look for the **Install** option in the browser.
3. Select **Install Folio**.
4. Launch Folio like a standalone application.

The PWA manifest configures the application for standalone display and portrait mobile orientation.

---

## 📲 Mobile Application

Folio includes a Capacitor configuration with the application ID:

```text
com.folio.notes
```

and application name:

```text
Folio
```

The configured web directory is:

```text
www
```

This provides a foundation for packaging the web application as a native mobile application.

---

## 🎯 Project Goals

Folio was designed around a simple idea:

> **Make digital productivity feel as natural as writing on paper.**

The project aims to provide:

* 📝 Simple note-taking
* ✅ Easy task management
* 🔥 Habit tracking
* ⏱️ Focused work sessions
* 📅 Daily planning
* 🔔 Useful reminders
* 📱 Mobile-friendly productivity
* 💾 Personal data backup
* 🎨 A calm, distraction-free interface

---

## 🔮 Future Improvements

Potential improvements include:

* [ ] Cloud synchronization
* [ ] User authentication
* [ ] Multi-device sync
* [ ] Calendar integration
* [ ] Advanced recurring tasks
* [ ] More notification options
* [ ] Rich text editor
* [ ] File/image attachments
* [ ] AI-powered productivity assistant
* [ ] Advanced analytics
* [ ] Native Android/iOS builds
* [ ] Cloud backup
* [ ] Collaborative notes
* [ ] Custom themes

---

## 📊 Productivity Sections

Folio provides dedicated areas for:

```text
Dashboard
│
├── 📅 Today
├── 📝 All Notes
├── ✅ Tasks
├── 🔥 Habits & Streaks
├── ⏱️ Focus Timer
├── 📆 Upcoming
├── ☑️ Completed
├── 🗑️ Trash
└── ⚙️ Settings
```

---

## 🔐 Privacy & Data

Folio is designed as a client-side productivity application.

Users can export their notebook data as a JSON backup, allowing them to keep a personal copy of their productivity information.

---

## 🤝 Contributing

Contributions, ideas, improvements, and suggestions are welcome.

### Contribution Workflow

```bash
git clone https://github.com/khushal-jangid/folio-notes-tasks.git

cd folio-notes-tasks

git checkout -b feature/your-feature

git add .

git commit -m "Add your feature"

git push origin feature/your-feature
```

Then open a Pull Request on GitHub.

---

## 📜 License

This project is open source.

See the repository's license file for the applicable license terms.

---

## 👨‍💻 Author

### Khushal Jangid

Computer Science student and developer interested in:

* 💻 Web Development
* ☁️ Cloud Computing
* ⚙️ DevOps
* 🔐 DevSecOps
* 🤖 AI & Emerging Technologies

GitHub:

**https://github.com/khushal-jangid**

---

## ⭐ Support

If you like **Folio**, consider giving the repository a ⭐ **Star** on GitHub.

Your support helps the project grow and motivates further development.

---

<div align="center">

### 📓 Folio

**Write. Plan. Focus. Accomplish.**

Made with ❤️ by **Khushal Jangid**

</div>
