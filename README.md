# PollyGlot - AI Translation App

A sleek and modern AI-powered translation app that leverages OpenAI's GPT-3.5 model for high-quality translations between multiple languages. PollyGlot provides real-time translations with additional features like text-to-speech and automatic language detection.

## Features

- 🌍 Support for multiple languages (French, Spanish, Japanese)
- 🔍 Automatic language detection
- 🗣️ Text-to-speech capability
- 📋 Copy to clipboard functionality
- 📝 Character counter
- 🎨 Beautiful, responsive UI
- 🚀 Powered by OpenAI's GPT-3.5
- ⚡ Real-time translations
- 📱 Mobile-friendly design
- 🔔 Toast notifications for user feedback
- ⌛ Loading animations for better UX

## Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)
- OpenAI API key

## Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd pollyglot
```

2. Install dependencies:
```bash
npm install
```

3. Set up your environment variables:
   - Create a `.env` file in the root directory
   - Add your OpenAI API key:
     ```
     OPENAI_API_KEY=your_api_key_here
     ```

4. Start the server:
```bash
node server.js
```

5. Open `http://localhost:3000` in your browser to start using the app!

## Usage

1. Enter text in the input area
2. Either:
   - Select the source language using the flag icons, or
   - Click "Detect Language" to automatically detect the input language
3. Select the target language using the flag icons
4. Click the "Translate" button to get your translation
5. Use additional features:
   - Click the speaker icon to hear the translation
   - Use the copy button to copy text to clipboard
   - Monitor character count with the built-in counter

## Technologies Used

- Frontend:
  - HTML5
  - CSS3 (with modern features like CSS Grid and Flexbox)
  - JavaScript (ES6+)
  - Web Speech API for text-to-speech
  
- Backend:
  - Node.js
  - Express.js
  - OpenAI GPT-3.5 API

## Project Structure

```
pollyglot/
├── assets/           # Image assets (flags, icons)
├── index.html        # Main HTML file
├── index.css         # Styles
├── index.js          # Client-side JavaScript
├── server.js         # Express server and API handling
├── package.json      # Dependencies and scripts
└── .env             # Environment variables (not in repo)
```

## Planned Features

- Additional language support
- Translation history
- Voice input capability
- Dark mode
- Keyboard shortcuts
- File upload support
- Learning features:
  - Vocabulary builder
  - Flashcards
  - Practice exercises

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- OpenAI for providing the GPT-3.5 API
- Contributors and users of this project