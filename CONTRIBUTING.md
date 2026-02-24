# Contributing to DocGenie

First off, thank you for considering contributing to DocGenie! 🧞

## 🌟 Ways to Contribute

- **Bug Reports**: Found a bug? Open an issue with a detailed description
- **Feature Requests**: Have an idea? We'd love to hear it
- **Documentation**: Help improve our docs
- **Code Contributions**: Submit a pull request

## 🛠 Development Setup

### Prerequisites

- Node.js 18+ or Bun
- OpenAI API key (for AI features)

### Getting Started

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/DocGenie.git
cd DocGenie

# Install dependencies
bun install

# Set up environment
cp backend/.env.example backend/.env
# Add your OPENAI_API_KEY

# Start development servers
bun dev
```

### Project Structure

```
DocGenie/
├── backend/           # Express.js API server
│   ├── src/
│   │   ├── db/       # SQLite database operations
│   │   ├── services/ # AI, Git, API docs services
│   │   └── index.js   # Main server
│   └── docs/          # Documentation files
├── frontend/          # React + Vite frontend
│   └── src/
│       ├── components/
│       ├── pages/
│       └── contexts/
└── README.md
```

## 📝 Coding Standards

### JavaScript/TypeScript

- Use ES6+ features
- Use `async/await` over callbacks
- Document complex functions with JSDoc comments

### React

- Functional components with hooks
- Keep components small and focused
- Use CSS-in-JS or inline styles (current approach)

### Git Commits

- Write clear, descriptive commit messages
- Reference issues when applicable: `Fixes #123`

## 🔄 Pull Request Process

1. **Fork** the repository
2. **Create a branch**: `git checkout -b feature/my-feature`
3. **Make changes** and commit
4. **Push** to your fork
5. **Open a Pull Request**

### PR Guidelines

- Describe what your PR does
- Link to any related issues
- Include screenshots for UI changes
- Ensure no lint errors

## 🧪 Testing

Currently, we're working on adding comprehensive tests. For now:

- Manual testing via the the UI
- Test with different codebases
- Verify AI features work correctly

## 📋 Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Accept that different opinions exist

## 🙏 Recognition

All contributors will be recognized in our README. Significant contributions get a special shoutout!

---

Questions? Feel free to open an issue or reach out to the maintainers.
