# 🆔 Universal CV ID

> Your Professional Identity, Everywhere

A fully functional CV builder prototype that generates unique Universal CV IDs, allowing professionals to create, manage, and share their CVs with a portable identity system.

![Universal CV ID](https://img.shields.io/badge/Status-Working%20Prototype-success)
![License](https://img.shields.io/badge/License-MIT-blue)
![Version](https://img.shields.io/badge/Version-1.0.0-orange)

---

## 🌟 **Live Demo**

**🔗 [View Live Demo](https://aarunantony.github.io/universal-cv-id/)**

*(Replace with your actual GitHub Pages URL)*

---

## ✨ **Features**

### 🎯 **Core Functionality**
- ✅ **Universal CV ID Generation** - Unique identifier for each CV (#UCVID-XXXXX)
- ✅ **Real-time Preview** - See your CV as you build it
- ✅ **PDF Export** - Download professional PDFs instantly
- ✅ **Local Storage** - All data saved in your browser (privacy-first)
- ✅ **Multiple CVs** - Create and manage unlimited CVs
- ✅ **Dashboard** - View all your CVs with analytics

### 📋 **CV Builder Features**
- Personal information with validation
- Work experience (add multiple positions)
- Education history
- Skills management with tags
- Professional summary
- Contact information

### 📊 **Dashboard Features**
- View all created CVs
- Simulated analytics (views, saves)
- Profile strength calculator
- Quick edit and delete options
- CV preview modal

### 🎨 **Design**
- Modern, clean interface
- Fully responsive (mobile-friendly)
- Gradient color scheme
- Smooth animations
- Professional templates

---

## 🚀 **Quick Start**

### **Option 1: Use GitHub Pages (Easiest)**

1. **Fork or Clone this repository**
```bash
   git clone https://github.com/aarunantony/universal-cv-id.git
```

2. **Enable GitHub Pages**
   - Go to Settings → Pages
   - Select "main" branch
   - Click Save

3. **Access your site**
   - Your site will be live at: `https://yourusername.github.io/universal-cv-id/`

### **Option 2: Run Locally**

1. **Download the files**
   - index.html
   - cv-builder.html
   - dashboard.html

2. **Open in browser**
   - Double-click `index.html`
   - Or use a local server:
```bash
   python -m http.server 8000
   # Then open http://localhost:8000
```

---

## 📖 **How to Use**

### **1. Create Your First CV**

1. Click **"Create Your CV ID Free"** on the homepage
2. Fill in your personal information
3. Add work experience (click "+ Add Experience")
4. Add education details
5. Add skills (press Enter after each skill)
6. Watch the live preview update in real-time!

### **2. Save Your CV**

Click the **"💾 Save"** button in the top navigation. Your CV is saved locally in your browser.

### **3. Download as PDF**

Click the **"📥 Download PDF"** button to generate and download a professional PDF version of your CV.

### **4. Manage Your CVs**

Visit the **Dashboard** to:
- View all your CVs
- See analytics and stats
- Preview, edit, or delete CVs
- Track profile strength

---

## 🛠️ **Technical Details**

### **Tech Stack**
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **PDF Generation**: jsPDF + html2canvas
- **Storage**: LocalStorage (browser-based)
- **No Backend Required**: 100% client-side

### **File Structure**
```
universal-cv-id/
├── index.html          # Landing page
├── cv-builder.html     # CV creation interface
├── dashboard.html      # CV management dashboard
└── README.md          # Documentation
```

### **Browser Compatibility**
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

### **Storage**
All data is stored in your browser's LocalStorage:
- No server required
- No data sent to external services
- Complete privacy
- Data persists until you clear browser data

---

## 📱 **Screenshots**

### Landing Page
Beautiful gradient homepage with clear call-to-action

### CV Builder
Real-time preview with intuitive form interface

### Dashboard
Manage all your CVs with analytics and quick actions

*(Add actual screenshots when available)*

---

## 🎯 **Use Cases**

### **For Job Seekers**
- Create professional CVs quickly
- Maintain multiple versions for different jobs
- Share via unique CV ID
- Download and email as PDF

### **For Students**
- Build your first CV
- Learn CV best practices
- Free and easy to use
- No registration required

### **For Portfolio**
- Showcase your web development skills
- Demonstrate JavaScript proficiency
- Show understanding of UX/UI
- Add to your GitHub portfolio

---

## 🔧 **Customization**

### **Change Colors**
Edit the CSS variables in each HTML file:
```css
/* Current gradient */
background: linear-gradient(135deg, #667eea, #764ba2);

/* Change to your brand colors */
background: linear-gradient(135deg, #YOUR_COLOR_1, #YOUR_COLOR_2);
```

### **Modify CV Template**
Edit the preview section in `cv-builder.html` to change:
- Layout
- Fonts
- Spacing
- Sections

### **Add Features**
The code is well-commented and modular. Easy to extend with:
- More CV templates
- Additional sections (certifications, languages, etc.)
- QR code generation
- Export to Word format
- Cloud sync (requires backend)

---

## 🐛 **Known Limitations**

This is a **working prototype**, not a production app:

- ❌ No user authentication
- ❌ No cloud storage (data in browser only)
- ❌ No actual analytics (simulated data)
- ❌ No email functionality
- ❌ No multi-device sync
- ❌ Limited PDF customization

**Perfect for:**
- Portfolio projects
- Learning web development
- Quick CV creation
- Demonstrations

**Not suitable for:**
- Production business use
- Multi-user environments
- Enterprise applications

---

## 🚀 **Future Enhancements**

Ideas for expanding this project:

- [ ] User authentication system
- [ ] Cloud storage (Firebase/Supabase)
- [ ] Multiple CV templates
- [ ] Cover letter generator
- [ ] Real analytics tracking
- [ ] Social sharing features
- [ ] QR code generation
- [ ] Mobile app version
- [ ] CV scoring/optimization
- [ ] Job board integration

---

## 🤝 **Contributing**

This is an open prototype! Feel free to:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 **License**

This project is open source and available under the [MIT License](LICENSE).
```
MIT License

Copyright (c) 2024 Aarun Antony

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 👨‍💻 **Author**

**Aarun Antony**
- GitHub: [@aarunantony](https://github.com/aarunantony)
- Project: [Universal CV ID](https://github.com/aarunantony/universal-cv-id)

---

## 🙏 **Acknowledgments**

- Inspired by modern CV builders and talent platforms
- Built as a working prototype for learning and demonstration
- Special thanks to the web development community

---

## 📞 **Support**

If you have questions or need help:

1. Check the [Issues](https://github.com/aarunantony/universal-cv-id/issues) page
2. Create a new issue with your question
3. Or contact via GitHub

---

## ⭐ **Show Your Support**

If you found this project helpful:

- ⭐ Star this repository
- 🍴 Fork it and build something cool
- 📢 Share it with others
- 🐛 Report bugs or suggest features

---

<div align="center">

**Made with ❤️ by [Aarun Antony](https://github.com/aarunantony)**

*Universal CV ID - Your Professional Identity, Everywhere*

[🏠 Homepage](https://aarunantony.github.io/universal-cv-id/) • [🐛 Report Bug](https://github.com/aarunantony/universal-cv-id/issues) • [✨ Request Feature](https://github.com/aarunantony/universal-cv-id/issues)

</div>
