# Publish to GitHub

Git is initialized locally on the `main` branch. Create an empty repository in your GitHub account. Leave GitHub's README, license and .gitignore options unchecked because this project already contains its setup files.

From PowerShell in the project directory:

```powershell
git status --short
git add .
git diff --cached --stat
git commit -m "Initial StreamSphere demo platform"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Replace `YOUR_USERNAME` and `YOUR_REPOSITORY` with your repository details. Authenticate when Git prompts you. If committing asks for an identity, configure your own name and email for this repository:

```powershell
git config user.name "Your Name"
git config user.email "your-email@example.com"
```

The `.gitignore` excludes `.env`, API keys, dependencies, build output, logs, local database files and editor state. `.env.example` is the credential-free template to commit. Keep `package-lock.json`, application source, public assets, documentation and Supabase SQL scripts in Git.

The GitHub Actions workflow installs locked dependencies, runs tests against isolated PostgreSQL and builds the frontend. It does not need Supabase, Gemini or Agent Platform credentials. It does not deploy the application or modify your live database.

After cloning on another machine:

```powershell
npm ci
npm run setup
```

Fill in the new local `.env` using the setup instructions in the [README](../README.md), then run the API and frontend in separate terminals. Database SQL scripts are provided in `supabase/`; they are not applied automatically when cloning or pushing.
