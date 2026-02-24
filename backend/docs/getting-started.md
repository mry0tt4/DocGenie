---
title: Getting Started
---

# Getting Started with DocGenie

Welcome to DocGenie! This guide will help you get up and running in minutes.

## Quick Setup

1. **Clone and Install**
   ```bash
   git clone https://github.com/yourusername/docgenie.git
   cd docgenie
   bun install
   ```

2. **Configure Environment**
   ```bash
   cp backend/.env.example backend/.env
   # Add your OPENAI_API_KEY to backend/.env
   ```

3. **Start the Server**
   ```bash
   bun dev
   ```

4. **Open Your Browser**
   Navigate to `http://localhost:5173`

## What's Next?

- Add your own markdown files to the `docs/` folder
- Configure API auto-documentation in Settings
- Customize the look and feel with your logo

## Need Help?

- Check out the [[API Reference]] for available endpoints
- Read the [[Configuration]] guide for advanced setup
